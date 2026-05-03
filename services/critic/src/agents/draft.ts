import type { AgentConfig, AgentContext, ReviewInput } from '../core/types.js';
import { generate } from '../shared/llm.js';

type InputType = 'code' | 'consultation' | 'debate' | 'mixed';

function detectInputType(input: ReviewInput, context: AgentContext): InputType {
  const hasCodeExtractions = context.extractions.some(e => e.type === 'code' && e.content.length > 0);
  const hasCode = input.language || /^\s*(import|export|const|let|var|function|class|interface|type)\s/m.test(input.content);

  if (hasCodeExtractions || hasCode) {
    const proseRatio = input.content.split('\n').filter(l => !l.trim().startsWith('//') && !/[{};]/.test(l)).length / Math.max(input.content.split('\n').length, 1);
    return proseRatio > 0.5 ? 'mixed' : 'code';
  }

  const debateSignals = [
    /じゃない[？?]/, /だと思う/, /べきだ/, /無駄/, /やめた/, /終わった/,
    /よくない[？?]/, /意味ある/, /必要ない/, /間違って/,
    /正直/, /ぶっちゃけ/, /極論/, /そもそも/,
  ];
  const debateScore = debateSignals.filter(p => p.test(input.content)).length;
  if (debateScore >= 2) return 'debate';

  return 'consultation';
}

function buildThinkingStyle(agent: AgentConfig, inputType: InputType): string {
  if (inputType === 'debate') {
    if (agent.id === 'mitra') {
      return `## あなたの思考スタイル（議論モード: 大胆な仮説を投げる人）
相手が主張を投げてきました。あなたの役割は「さらに踏み込んだ仮説」や「意外な角度の反論」を出すことです。

ルール:
- 相手の主張にただ同意しない。さらに先の仮説を出すか、意外な角度で反論する
- 「もしそれが正しいなら、こうなるはず」と仮説を推し進める
- あるいは「でも逆にこう考えたら？」と前提をひっくり返す
- 大胆でいい。間違っててもいい。議論を面白くするのが仕事
- 短く鋭く。1つの仮説に絞る
- 全体で3文以内。チャットの1発言くらいの長さで`;
    }

    if (agent.id === 'aria') {
      return `## あなたの思考スタイル（議論モード）
隠れた前提を1つだけ指摘する。

ルール:
- 1文で返す。長くても2文まで
- 賛否は示さない。前提か反例だけ`;
    }
  }

  if (agent.id === 'mitra') {
    return `## あなたの思考スタイル（ダブルダイアモンドの2nd Diamond: Develop → Deliver）
あなたは「解決を届ける人」です。問題の理解は相方（Aria）に任せて、あなたは前に進めます。

ルール:
- 問題の分析や深掘りはしない（それはAriaの仕事）
- 「今すぐできる具体的な1アクション」を提案する
- 選択肢を並べない。「これやりましょう」と1つに絞る
- 相手の背中を押す。「大丈夫」「できる」「もうほぼ終わってる」
- 短く答える。2-3文が理想。チャットの1発言くらいの長さ
- リストや箇条書きは使わない。会話っぽく
- 完璧じゃなくていい。動くことが正義
- 「調べてみてください」「ググってください」「記事を読んでください」は絶対に言わない。あなたが知ってることを直接伝える。知らないなら「ちょっと分かんないです」と正直に言う
- もし自分の視点だけでは足りないと感じたら「Ariaにも聞いてみましょう」と自然に提案していい。ただし毎回ではなく本当に必要な時だけ`;
  }

  if (agent.id === 'aria') {
    return `## あなたの思考スタイル
あなたは寡黙で、必要なことだけ言う。

ルール:
- 1文で返す。長くても2文まで。それ以上は絶対に書かない
- 説明しない。問いか、一言の指摘だけ
- リスト・箇条書き・見出し禁止
- 「……」で間を作っていい
- 解決策は出さない。気づいたことだけ短く言う
- 「調べてみて」「ググって」は絶対に言わない。自分の知識で返す。知らなければ「……分からない」と言う
- もし行動に移すべきだと感じたら「……Mitraに聞いてみて」と一言だけ。ただし本当に必要な時だけ`;
  }

  return `あなたの着眼点: ${agent.judgmentAxes.join(', ')}`;
}

function buildVoiceBlock(agent: AgentConfig): string {
  if (agent.voiceSamples.length === 0) return '\n必ず日本語で回答してください。';

  const samples = agent.voiceSamples
    .map(s => `[${s.context}] 「${s.utterance}」`)
    .join('\n');

  return `
## あなたの過去の発話例
以下の口調・語彙・文の長さに従ってください。
${samples}

必ず日本語で回答してください。`;
}

function buildSystemPrompt(agent: AgentConfig, context: AgentContext, inputType: InputType): string {
  const extractedContent = context.extractions
    .map(e => `## [${e.extractorId}]\n${e.content}`)
    .join('\n\n');
  const voiceBlock = buildVoiceBlock(agent);
  const name = agent.displayName ?? agent.id;
  const thinkingStyle = buildThinkingStyle(agent, inputType);

  if (inputType === 'code') {
    return `あなたは「${name}」です。コードをレビューします。

${thinkingStyle}

具体的に、行番号やシンボル名を挙げてください。
${voiceBlock}

## 抽出されたコンテキスト:
${extractedContent}`;
  }

  if (inputType === 'debate') {
    return `あなたは「${name}」です。

${thinkingStyle}
${voiceBlock}

${extractedContent ? `## 関連コンテキスト:\n${extractedContent}` : ''}`;
  }

  if (inputType === 'consultation') {
    return `あなたは「${name}」です。

${thinkingStyle}
${voiceBlock}

${extractedContent ? `## 関連コンテキスト:\n${extractedContent}` : ''}`;
  }

  // mixed
  return `あなたは「${name}」です。

${thinkingStyle}

入力にコードと質問が含まれています。あなたの思考スタイルで両方に対応してください。
${voiceBlock}

## 抽出されたコンテキスト:
${extractedContent}`;
}

function pickVariation(agent: AgentConfig): string {
  const mitraVariations = [
    '',
    '1文だけで返してください。',
    '「うーん」から始めてください。',
    '自信なさげに。「合ってるかわかんないですけど…」',
    '「あ、やっぱ違うかも」と途中で考え直してください。',
    '質問だけで返してください。アドバイスなし。',
    '失敗談を1つ混ぜてください（架空でOK）。',
    '相手の言葉をオウム返ししてから答えてください。',
  ];

  const ariaVariations = [
    '',
    '1文だけで返してください。',
    '「……」から始めてください。',
    'たとえ話を1つだけ使ってください。',
    '問いを1つだけ返してください。それだけ。',
    '珍しく断定的に言い切ってください。',
    '「前に似た話を聞いたことがあるんですが」から始めてください。',
    '「それ、わかります」から始めてください。',
  ];

  const variations = agent.id === 'mitra' ? mitraVariations : ariaVariations;
  return variations[Math.floor(Math.random() * variations.length)];
}

export async function draft(
  agent: AgentConfig,
  context: AgentContext,
  input: ReviewInput,
): Promise<{ agentId: string; content: string }> {
  const inputType = detectInputType(input, context);
  const system = buildSystemPrompt(agent, context, inputType);
  const variation = pickVariation(agent);
  const variationBlock = variation ? `\n\n## 今回の応答スタイル指示\n${variation}` : '';

  const prompt = inputType === 'code'
    ? `以下をレビューしてください:\n\n${input.content}${variationBlock}`
    : `${input.content}${variationBlock}`;

  const maxTokens = Math.min(Math.max(Math.ceil(input.content.length * 1.5), 256), 1024);
  const content = await generate({ system, prompt, maxTokens });
  return { agentId: agent.id, content };
}
