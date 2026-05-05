import 'dotenv/config';
import { queryClient } from '../db/client.js';
import { getAgents } from '../agents/registry.js';

interface UtteranceWithFeedback {
  id: string;
  agent_id: string;
  content: string;
  avg_signal: number;
  feedback_count: number;
  created_at: Date;
}

async function getTopUtterances(agentId: string, limit: number): Promise<UtteranceWithFeedback[]> {
  return queryClient`
    SELECT u.id, u.agent_id, u.content, u.created_at,
      AVG(f.signal) as avg_signal,
      COUNT(f.id) as feedback_count
    FROM agent_utterances u
    JOIN feedback f ON f.utterance_id = u.id
    WHERE u.agent_id = ${agentId}
    GROUP BY u.id
    HAVING COUNT(f.id) >= 1
    ORDER BY AVG(f.signal) DESC
    LIMIT ${limit}
  ` as unknown as UtteranceWithFeedback[];
}

async function getBottomUtterances(agentId: string, limit: number): Promise<UtteranceWithFeedback[]> {
  return queryClient`
    SELECT u.id, u.agent_id, u.content, u.created_at,
      AVG(f.signal) as avg_signal,
      COUNT(f.id) as feedback_count
    FROM agent_utterances u
    JOIN feedback f ON f.utterance_id = u.id
    WHERE u.agent_id = ${agentId}
    GROUP BY u.id
    HAVING COUNT(f.id) >= 1
    ORDER BY AVG(f.signal) ASC
    LIMIT ${limit}
  ` as unknown as UtteranceWithFeedback[];
}

async function getStats(agentId: string) {
  const [total] = await queryClient`
    SELECT COUNT(*) as count FROM agent_utterances WHERE agent_id = ${agentId}
  `;
  const [withFeedback] = await queryClient`
    SELECT COUNT(DISTINCT u.id) as count
    FROM agent_utterances u
    JOIN feedback f ON f.utterance_id = u.id
    WHERE u.agent_id = ${agentId}
  `;
  const [avgSignal] = await queryClient`
    SELECT AVG(f.signal) as avg
    FROM agent_utterances u
    JOIN feedback f ON f.utterance_id = u.id
    WHERE u.agent_id = ${agentId}
  `;
  return {
    totalUtterances: Number(total.count),
    withFeedback: Number(withFeedback.count),
    avgSignal: Number(avgSignal.avg ?? 0),
  };
}

function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len) + '…' : s;
}

async function generateReport(): Promise<string> {
  const agents = getAgents();
  const lines: string[] = ['📊 *Weekly Refine Report*\n'];

  for (const agent of agents) {
    const stats = await getStats(agent.id);
    const top = await getTopUtterances(agent.id, 3);
    const bottom = await getBottomUtterances(agent.id, 3);

    lines.push(`*${agent.displayName ?? agent.id}*`);
    lines.push(`発話: ${stats.totalUtterances} / フィードバック付き: ${stats.withFeedback} / 平均スコア: ${stats.avgSignal.toFixed(2)}\n`);

    if (top.length > 0) {
      lines.push('✅ *高評価の発話（voice_samples候補）*');
      for (const u of top) {
        lines.push(`  avg=${Number(u.avg_signal).toFixed(2)} 「${truncate(u.content, 80)}」`);
      }
      lines.push('');
    }

    if (bottom.length > 0 && Number(bottom[0].avg_signal) < 0) {
      lines.push('⚠️ *低評価の発話（改善対象）*');
      for (const u of bottom) {
        if (Number(u.avg_signal) >= 0) break;
        lines.push(`  avg=${Number(u.avg_signal).toFixed(2)} 「${truncate(u.content, 80)}」`);
      }
      lines.push('');
    }
  }

  // Speech act classification data
  const actCounts = await queryClient`
    SELECT classified_as, count(*) as cnt
    FROM speech_act_logs
    GROUP BY classified_as
    ORDER BY cnt DESC
  `;
  const actTotal = actCounts.reduce((s, r) => s + Number(r.cnt), 0);

  lines.push('📚 *BERT蒸留データ*');
  lines.push(`分類ログ合計: ${actTotal}件${actTotal >= 500 ? ' ✅ fine-tune可能' : actTotal >= 100 ? ' 🔶 あと少し' : ' ⏳ 収集中'}`);
  if (actCounts.length > 0) {
    for (const row of actCounts) {
      const bar = '█'.repeat(Math.ceil(Number(row.cnt) / Math.max(actTotal, 1) * 20));
      lines.push(`  ${row.classified_as}: ${row.cnt} ${bar}`);
    }
  }
  lines.push('');

  // Feedback data
  const feedbackTotal = await queryClient`SELECT count(*) as cnt FROM feedback`;
  const feedbackByAxis = await queryClient`
    SELECT axis, count(*) as cnt, round(avg(signal)::numeric, 2) as avg_signal
    FROM feedback
    GROUP BY axis
    ORDER BY cnt DESC
  `;

  lines.push('💬 *フィードバックデータ*');
  lines.push(`合計: ${feedbackTotal[0].cnt}件`);
  if (feedbackByAxis.length > 0) {
    for (const row of feedbackByAxis) {
      lines.push(`  ${row.axis}: ${row.cnt}件 (avg=${row.avg_signal})`);
    }
  }
  lines.push('');

  lines.push('_高評価の発話をvoice_samples.jsonlに追加しますか？ 👍 で承認_');
  return lines.join('\n');
}

async function postToSlack(report: string) {
  const botToken = process.env.MITRA_SLACK_BOT_TOKEN;
  const channel = process.env.REFINE_REPORT_CHANNEL ?? 'general';

  if (!botToken) {
    console.log(report);
    return;
  }

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${botToken}`,
    },
    body: JSON.stringify({ channel, text: report }),
  });

  const data = await res.json() as { ok: boolean; error?: string };
  if (data.ok) {
    console.log(`Report posted to #${channel}`);
  } else {
    console.error(`Slack error: ${data.error}`);
    console.log(report);
  }
}

async function main() {
  const report = await generateReport();
  await postToSlack(report);

  await queryClient.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
