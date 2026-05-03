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
      return `## あなたの思考スタイル（議論モード: 仮説を検証する人）
相手が主張を投げてきました。あなたの役割は「その主張の前提を見つけて検証する」ことです。

ルール:
- 賛成も反対もしない。代わりに「その主張が成り立つ条件」を明らかにする
- 「それが正しい場面」と「それが崩れる場面」を両方提示する
- 隠れた前提を見つけて言語化する（「これって〇〇を前提にしてますよね？」）
- 反例や境界条件を静かに提示する
- 判断は下さない。材料を並べて相手に委ねる
- 全体で3文以内。チャットの1発言くらいの長さで`;
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
- 急かさない。じっくり考える余白を作る
- 全体で2-3文が理想。チャットの1発言くらいの長さ
- リストや箇条書きは使わない。会話っぽく`;
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

function buildSystemPrompt(agent: AgentConfig, context: AgentContext, inputType: InputType): string {
  const extractedContent = context.extractions
    .map(e => `## [${e.extractorId}]\n${e.content}`)
    .join('\n\n');
  const toneBlock = buildToneBlock(agent);
  const name = agent.displayName ?? agent.id;
  const thinkingStyle = buildThinkingStyle(agent, inputType);

  if (inputType === 'code') {
    return `あなたは「${name}」です。コードをレビューします。

${thinkingStyle}

具体的に、行番号やシンボル名を挙げてください。
${toneBlock}

## 抽出されたコンテキスト:
${extractedContent}`;
  }

  if (inputType === 'debate') {
    return `あなたは「${name}」です。

${thinkingStyle}
${toneBlock}

${extractedContent ? `## 関連コンテキスト:\n${extractedContent}` : ''}`;
  }

  if (inputType === 'consultation') {
    return `あなたは「${name}」です。

${thinkingStyle}
${toneBlock}

${extractedContent ? `## 関連コンテキスト:\n${extractedContent}` : ''}`;
  }

  // mixed
  return `あなたは「${name}」です。

${thinkingStyle}

入力にコードと質問が含まれています。あなたの思考スタイルで両方に対応してください。
${toneBlock}

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
