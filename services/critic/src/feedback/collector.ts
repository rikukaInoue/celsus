import { db } from '../db/client.js';
import { feedback } from '../db/schema.js';
import type { Feedback } from '../core/types.js';
import { randomUUID } from 'node:crypto';

export async function recordFeedback(input: {
  utteranceId: string;
  source: string;
  axis?: string;
  signal: number;
  context?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(feedback).values({
    id: randomUUID(),
    utteranceId: input.utteranceId,
    source: input.source,
    axis: input.axis ?? null,
    signal: input.signal,
    context: input.context ?? null,
  });
}

export async function recordPreference(
  selectedUtteranceId: string,
  otherUtteranceId: string,
  source: string,
): Promise<void> {
  await recordFeedback({
    utteranceId: selectedUtteranceId,
    source,
    axis: 'preference',
    signal: 1.0,
    context: { type: 'preference_selection' },
  });

  await recordFeedback({
    utteranceId: otherUtteranceId,
    source,
    axis: 'preference',
    signal: -0.3,
    context: { type: 'preference_not_selected' },
  });
}
