import { randomUUID } from 'node:crypto';
import type {
  ReviewInput,
  Message,
  AgentConfig,
  AgentContext,
  ScoredDraft,
  PipelineState,
  Utterance,
} from '../core/types.js';
import { getDomain } from '../core/domain-registry.js';
import { draft } from './draft.js';
import { score } from './scorer.js';
import { refine } from './refiner.js';

type SpeakingMode = 'auto' | 'both' | 'named';

function detectSpeakingMode(input: ReviewInput): SpeakingMode {
  const content = input.content;

  // Explicit "both" trigger
  if (/両方|二人|2人|みんな/.test(content)) return 'both';

  // Explicit name mention
  if (/mitra|ミトラ|aria|アリア/i.test(content)) return 'named';

  return 'auto';
}

function isNamed(agent: AgentConfig, input: ReviewInput): boolean {
  const content = input.content.toLowerCase();
  const id = agent.id.toLowerCase();
  const displayName = (agent.displayName ?? '').toLowerCase();
  return content.includes(id) || content.includes(displayName);
}

export interface PipelineResult {
  turnId: string;
  responses: AgentResponse[];
}

export interface AgentResponse {
  agentId: string;
  content: string;
  alpha: number;
  suppressed: boolean;
  utteranceId: string;
}

export interface PipelineDeps {
  saveUtterance: (u: Omit<Utterance, 'createdAt'>) => Promise<void>;
  getRecentEmbeddings: (agentId: string, limit: number) => Promise<number[][]>;
  embed: (text: string) => Promise<number[]>;
}

export interface PipelineOptions {
  speakingMode?: SpeakingMode;
}

export async function runPipeline(
  input: ReviewInput,
  agents: AgentConfig[],
  deps: PipelineDeps,
  options?: PipelineOptions,
): Promise<PipelineResult> {
  const turnId = randomUUID();

  const domain = getDomain(input.domainId);
  if (!domain) throw new Error(`Unknown domain: ${input.domainId}`);

  // EXTRACTING: run all extractors for each agent in parallel
  const agentContexts: AgentContext[] = await Promise.all(
    agents.map(async (agent) => {
      const extractors = domain.extractorsFor(agent, input.language ? 'code' : 'mixed');
      const results = await Promise.all(extractors.map(e => e.extract(input)));
      const extractions = results.filter((r): r is NonNullable<typeof r> => r !== null);

      const totalTokens = extractions.reduce((sum, e) => sum + e.tokenEstimate, 0);
      const relevanceScore = extractions.reduce((sum, e) => {
        const extractor = extractors.find(ex => ex.id === e.extractorId);
        return sum + (e.metadata.relevanceHint ?? 0.5) * (extractor?.weight ?? 1);
      }, 0) / Math.max(extractors.length, 1);

      return { agentId: agent.id, extractions, totalTokens, relevanceScore };
    }),
  );

  // DRAFTING: call Claude API in parallel for each agent
  const drafts = await Promise.all(
    agents.map((agent, i) => draft(agent, agentContexts[i], input))
  );

  // SCORING: compute alpha for each draft
  const scored: ScoredDraft[] = await Promise.all(
    drafts.map(async (d, i) => {
      const agent = agents[i];
      const context = agentContexts[i];
      return score(d, agent, context, deps);
    }),
  );

  // Determine speaking mode: explicit override > detection from input
  const speakingMode = options?.speakingMode ?? detectSpeakingMode(input);

  // Guaranteed speaker: highest alpha agent always speaks
  const maxAlpha = Math.max(...scored.map(s => s.alpha));

  // REFINING: refine high-alpha drafts, suppress low-alpha
  const responses: AgentResponse[] = await Promise.all(
    scored.map(async (s) => {
      const agent = agents.find(a => a.id === s.agentId)!;
      const utteranceId = randomUUID();

      const isGuaranteed = speakingMode === 'both'
        || (speakingMode === 'named' && isNamed(agent, input))
        || s.alpha === maxAlpha;
      let content: string;
      let suppressed = false;

      if (s.alpha >= agent.speechPolicy.thresholdHigh) {
        content = await refine(s, agent, input);
      } else if (s.alpha < agent.speechPolicy.thresholdLow && !isGuaranteed) {
        content = '';
        suppressed = true;
      } else {
        content = s.content;
      }

      if (!suppressed) {
        await deps.saveUtterance({
          id: utteranceId,
          agentId: s.agentId,
          configVersion: agent.version,
          turnId,
          parentMsgId: input.id,
          content,
          viewContext: { alpha: s.alpha, components: s.components },
        });
      }

      return { agentId: s.agentId, content, alpha: s.alpha, suppressed, utteranceId };
    }),
  );

  return { turnId, responses };
}
