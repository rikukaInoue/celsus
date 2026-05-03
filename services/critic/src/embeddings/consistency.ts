import Redis from 'ioredis';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380');
  }
  return redis;
}

export interface AgentConsistency {
  agentId: string;
  mu: number[];
  variance: number;
  utteranceCount: number;
  lastUpdated: Date;
}

export async function getConsistency(agentId: string): Promise<AgentConsistency | null> {
  const r = getRedis();
  const data = await r.get(`critic:consistency:${agentId}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function updateConsistency(
  agentId: string,
  embeddings: number[][],
): Promise<AgentConsistency> {
  if (embeddings.length === 0) {
    throw new Error('Cannot compute consistency from empty embeddings');
  }

  const dim = embeddings[0].length;
  const mu = new Array(dim).fill(0);

  for (const e of embeddings) {
    for (let i = 0; i < dim; i++) {
      mu[i] += e[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    mu[i] /= embeddings.length;
  }

  let variance = 0;
  for (const e of embeddings) {
    let dist = 0;
    for (let i = 0; i < dim; i++) {
      dist += (e[i] - mu[i]) ** 2;
    }
    variance += dist;
  }
  variance /= embeddings.length;

  const consistency: AgentConsistency = {
    agentId,
    mu,
    variance,
    utteranceCount: embeddings.length,
    lastUpdated: new Date(),
  };

  const r = getRedis();
  await r.set(
    `critic:consistency:${agentId}`,
    JSON.stringify(consistency),
    'EX',
    3600,
  );

  return consistency;
}
