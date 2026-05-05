import { generate } from '../shared/llm.js';
import { queryClient } from '../db/client.js';

export type SpeechAct =
  | 'self_disclosure'  // 自己開示
  | 'question_yesno'   // 質問(YesNo)
  | 'question_what'    // 質問(What)
  | 'response'         // 応答
  | 'backchannel'      // あいづち
  | 'confirmation'     // 確認
  | 'request'          // 要求
  | 'assertion'        // 主張・意見
  | 'code_review';     // コードレビュー

const CLASSIFY_PROMPT = `ユーザーの発話を以下のカテゴリの1つに分類してください。カテゴリ名だけを返してください。

カテゴリ:
- self_disclosure: 自分のことを話している（「最近疲れてる」「5年目のエンジニアです」）
- question_yesno: はい/いいえで答えられる質問（「これって合ってる？」「使ったことある？」）
- question_what: 説明を求める質問（「どうすればいい？」「何が原因？」）
- response: 前の発言への返答（「なるほど」「たしかに」「そうそう」）
- backchannel: あいづち・フィラー（「うん」「へぇ」「ふーん」）
- confirmation: 確認（「つまりこういうこと？」「〜で合ってる？」）
- request: 依頼・要求（「レビューして」「調べて」「教えて」）
- assertion: 主張・意見表明（「〜だと思う」「〜すべき」「〜は無駄」）
- code_review: コードが含まれている

カテゴリ名だけ返してください。`;

export async function classifySpeechAct(text: string): Promise<SpeechAct> {
  const hasCode = /^\s*(import|export|const|let|var|function|class|interface|type)\s/m.test(text);
  if (hasCode) return 'code_review';

  // Short texts: rule-based
  const trimmed = text.trim();
  if (trimmed.length <= 5) {
    if (/^[うはへふ]ー?[んぇ]?$/.test(trimmed)) return 'backchannel';
    if (/^[うは]ん$/.test(trimmed)) return 'backchannel';
  }

  try {
    const result = await generate({
      system: CLASSIFY_PROMPT,
      prompt: trimmed,
      maxTokens: 20,
    });
    const act = result.trim().toLowerCase() as SpeechAct;
    const valid: SpeechAct[] = ['self_disclosure', 'question_yesno', 'question_what', 'response', 'backchannel', 'confirmation', 'request', 'assertion', 'code_review'];
    const classified = valid.includes(act) ? act : 'question_what';
    await logClassification(trimmed, classified);
    return classified;
  } catch {
    return 'question_what';
  }
}

async function logClassification(text: string, act: SpeechAct) {
  try {
    await queryClient`
      INSERT INTO speech_act_logs (input_text, classified_as, input_length)
      VALUES (${text.slice(0, 500)}, ${act}, ${text.length})
    `;
  } catch {}
}
