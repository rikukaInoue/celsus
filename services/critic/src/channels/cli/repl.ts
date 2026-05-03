import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import { normalizeCliInput } from '../normalizer.js';
import { runPipeline, type PipelineDeps } from '../../agents/pipeline.js';
import { getAgents } from '../../agents/registry.js';
import { recordPreference } from '../../feedback/collector.js';
import { formatResponse, formatPreferencePrompt } from './formatter.js';
import type { ReviewInput } from '../../core/types.js';

export async function startRepl(deps: PipelineDeps) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('critic> '),
  });

  console.log(chalk.bold('\n  @celsus/critic v0.1.0'));
  console.log(chalk.dim('  Type /help for commands, or paste code/text to review.\n'));

  rl.prompt();

  let multilineBuffer: string[] | null = null;
  let processing = false;

  rl.on('line', async (line) => {
    if (processing) return;

    if (multilineBuffer !== null) {
      if (line === '') {
        const content = multilineBuffer.join('\n');
        multilineBuffer = null;
        processing = true;
        await handleReview(content, deps, rl);
        processing = false;
        rl.prompt();
      } else {
        multilineBuffer.push(line);
      }
      return;
    }

    const trimmed = line.trim();

    if (trimmed === '/help') {
      printHelp();
      rl.prompt();
    } else if (trimmed === '/agents') {
      const agents = getAgents();
      for (const a of agents) {
        console.log(`  ${chalk.bold(a.id)}  v${a.version}  axes: [${a.judgmentAxes.join(', ')}]`);
      }
      rl.prompt();
    } else if (trimmed === '/quit' || trimmed === '/exit') {
      console.log(chalk.dim('\n  Goodbye.'));
      rl.close();
      process.exit(0);
    } else if (trimmed === '/review') {
      console.log(chalk.dim('  Paste code to review (end with empty line):'));
      multilineBuffer = [];
    } else if (trimmed.startsWith('/review ')) {
      const filePath = trimmed.slice(8).trim();
      try {
        const content = readFileSync(filePath, 'utf-8');
        processing = true;
        await handleReview(content, deps, rl, filePath);
        processing = false;
      } catch (err) {
        console.log(chalk.red(`  Error reading file: ${(err as Error).message}`));
      }
      rl.prompt();
    } else if (trimmed !== '') {
      processing = true;
      await handleReview(trimmed, deps, rl);
      processing = false;
      rl.prompt();
    } else {
      rl.prompt();
    }
  });

  rl.on('close', () => {
    console.log(chalk.dim('\n  Goodbye.'));
    process.exit(0);
  });
}

async function handleReview(
  content: string,
  deps: PipelineDeps,
  rl: ReturnType<typeof createInterface>,
  filePath?: string,
) {
  const message = normalizeCliInput(content, 'user');
  const agents = getAgents();

  const input: ReviewInput = {
    id: message.id,
    content: message.content,
    language: message.modality === 'code' ? 'typescript' : undefined,
    filePath,
  };

  console.log(chalk.dim('\n  Reviewing...\n'));

  try {
    const result = await runPipeline(input, agents, deps);

    for (const response of result.responses) {
      console.log(formatResponse(response));
    }

    const active = result.responses.filter(r => !r.suppressed);
    if (active.length >= 2) {
      console.log(formatPreferencePrompt(result.responses));
      const answer = await question(rl, chalk.yellow('  > '));
      await handlePreference(answer, active);
    }
  } catch (err) {
    console.log(chalk.red(`  Error: ${(err as Error).message}`));
  }
}

async function handlePreference(
  answer: string,
  responses: { agentId: string; utteranceId: string }[],
) {
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 's' || trimmed === '') return;

  const idx = parseInt(trimmed) - 1;
  if (idx >= 0 && idx < responses.length) {
    const selected = responses[idx];
    const other = responses[1 - idx];
    await recordPreference(selected.utteranceId, other.utteranceId, 'human');
    console.log(chalk.green('  ✓ Feedback recorded.\n'));
  }
}

function question(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function printHelp() {
  console.log(`
  ${chalk.bold('Commands:')}
    /review           Start multiline review input
    /review <file>    Review a file from disk
    /agents           List active agents and their config
    /help             Show this help
    /quit             Exit

  Or just type/paste code directly to review it.
`);
}
