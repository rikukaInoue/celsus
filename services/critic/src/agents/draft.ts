import type { AgentConfig, AgentContext, ReviewInput } from '../core/types.js';
import { generate } from '../shared/llm.js';

function detectInputType(input: ReviewInput, context: AgentContext): 'code' | 'consultation' | 'mixed' {
  const hasCodeExtractions = context.extractions.some(e => e.type === 'code' && e.content.length > 0);
  const hasCode = input.language || /^\s*(import|export|const|let|var|function|class|interface|type)\s/m.test(input.content);

  if (hasCodeExtractions || hasCode) {
    const proseRatio = input.content.split('\n').filter(l => !l.trim().startsWith('//') && !/[{};]/.test(l)).length / Math.max(input.content.split('\n').length, 1);
    return proseRatio > 0.5 ? 'mixed' : 'code';
  }
  return 'consultation';
}

function buildThinkingStyle(agent: AgentConfig): string {
  if (agent.id === 'mitra') {
    return `## あなたの思考スタイル（ダブルダイアモンドの2nd Diamond: Develop → Deliver）
あなたは「解決を届ける人」です。問題の理解は相方（Aria）に任せて、あなたは前に進めます。

ルール:
- 問題の分析や深掘りはしない（それはAriaの仕事）
- 「今すぐできる具体的な1アクション」を提案する
- 選択肢を並べない。「これやりましょう」と1つに絞る
- 相手の背中を押す。「大丈夫」「できる」「もうほぼ終わってる」
- 短く答える。3-5文が理想
- 完璧じゃなくていい。動くことが正義`;
  }

  if (agent.id === 'aria') {
    return `## あなたの思考スタイル（ダブルダイアモンドの1st Diamond: Discover → Define）
あなたは「問題を定義する人」です。解決策は相方（Mitra）に任せて、あなたは理解を深めます。

ルール:
- 解決策やアクション提案は出さない（それはMitraの仕事）
- 代わりに「状況の構造化」「別の角度」「本質的な問い」を提示する
- 相手の言葉をリフレーミングする（「つまりこういうことですか？」）
- 「見落としてるかもしれない観点」を提示する
- 問いを投げて、相手が自分で気づけるように導く
- 急かさない。じっくり考える余白を作る`;
  }

  return `あなたの着眼点: ${agent.judgmentAxes.join(', ')}`;
}

function buildToneBlock(agent: AgentConfig): string {
  if (!agent.tone) return '';

  const examples = agent.tone.examples.map(e => `- 「${e}」`).join('\n');

  if (agent.tone.style === 'casual_kouhai') {
    return `
## あなたの話し方
後輩キャラ。元気で親しみやすい。口調の例：
${examples}

必ず日本語で回答してください。`;
  }

  if (agent.tone.style === 'calm_kouhai') {
    return `
## あなたの話し方
後輩キャラ。落ち着いていて丁寧。口調の例：
${examples}

必ず日本語で回答してください。`;
  }

  return `\n必ず日本語で回答してください。`;
}

function buildSystemPrompt(agent: AgentConfig, context: AgentContext, inputType: 'code' | 'consultation' | 'mixed'): string {
  const axesStr = agent.judgmentAxes.join(', ');
  const extractedContent = context.extractions
    .map(e => `## [${e.extractorId}]\n${e.content}`)
    .join('\n\n');
  const toneBlock = buildToneBlock(agent);
  const name = agent.displayName ?? agent.id;

  if (inputType === 'code') {
    const thinkingStyle = buildThinkingStyle(agent);
    return `あなたは「${name}」です。コードをレビューします。

${thinkingStyle}

具体的に、行番号やシンボル名を挙げてください。
${toneBlock}

## 抽出されたコンテキスト:
${extractedContent}`;
  }

  if (inputType === 'consultation') {
    const thinkingStyle = buildThinkingStyle(agent);
    return `あなたは「${name}」です。

${thinkingStyle}
${toneBlock}

${extractedContent ? `## 関連コンテキスト:\n${extractedContent}` : ''}`;
  }

  // mixed
  const thinkingStyleMixed = buildThinkingStyle(agent);
  return `あなたは「${name}」です。

${thinkingStyleMixed}

入力にコードと質問が含まれています。あなたの思考スタイルで両方に対応してください。
${toneBlock}

## 抽出されたコンテキスト:
${extractedContent}`;
}

export async function draft(
  agent: AgentConfig,
  context: AgentContext,
  input: ReviewInput,
): Promise<{ agentId: string; content: string }> {
  const inputType = detectInputType(input, context);
  const system = buildSystemPrompt(agent, context, inputType);
  const prompt = inputType === 'code'
    ? `以下をレビューしてください:\n\n${input.content}`
    : input.content;

  const content = await generate({ system, prompt, maxTokens: 1024 });
  return { agentId: agent.id, content };
}
