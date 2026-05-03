export type ReactionType = 'thumbsup' | 'thumbsdown' | 'heavy_check_mark' | 'thinking_face';

const REACTION_SIGNALS: Record<ReactionType, { signal: number; axis: string }> = {
  thumbsup: { signal: 0.5, axis: 'general' },
  thumbsdown: { signal: -0.5, axis: 'general' },
  heavy_check_mark: { signal: 0.3, axis: 'accuracy' },
  thinking_face: { signal: 0, axis: 'clarity' },
};

export function reactionToSignal(reaction: string): { signal: number; axis: string } | null {
  return REACTION_SIGNALS[reaction as ReactionType] ?? null;
}
