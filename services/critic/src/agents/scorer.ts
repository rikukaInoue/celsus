import type { AgentConfig, AgentContext, ScoredDraft } from '../core/types.js';
import type { PipelineDeps } from './pipeline.js';

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

function mean(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i] += v[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    result[i] /= vectors.length;
  }
  return result;
}

export async function score(
  draftResult: { agentId: string; content: string },
  agent: AgentConfig,
  context: AgentContext,
  deps: PipelineDeps,
): Promise<ScoredDraft> {
  const weights = agent.speechPolicy.alphaWeights;

  // Relevance: from extraction quality
  const relevance = context.relevanceScore;

  // Anomaly: how different this draft is from agent's typical output
  let anomaly = 0.5; // default if no history
  try {
    const recentEmbeddings = await deps.getRecentEmbeddings(agent.id, 50);
    if (recentEmbeddings.length > 0) {
      const draftEmbedding = await deps.embed(draftResult.content);
      const mu = mean(recentEmbeddings);
      const similarity = cosineSimilarity(draftEmbedding, mu);
      anomaly = 1 - similarity; // higher anomaly = more different from usual
    }
  } catch {
    // fallback to default
  }

  // Novelty: how different from recent outputs (avoid repetition)
  let novelty = 0.5;
  try {
    const recentEmbeddings = await deps.getRecentEmbeddings(agent.id, 10);
    if (recentEmbeddings.length > 0) {
      const draftEmbedding = await deps.embed(draftResult.content);
      const maxSim = Math.max(
        ...recentEmbeddings.map(e => cosineSimilarity(draftEmbedding, e)),
      );
      novelty = 1 - maxSim;
    }
  } catch {
    // fallback to default
  }

  const alpha = weights.relevance * relevance + weights.anomaly * anomaly + weights.novelty * novelty;

  return {
    agentId: draftResult.agentId,
    content: draftResult.content,
    alpha,
    components: { relevance, anomaly, novelty },
  };
}
