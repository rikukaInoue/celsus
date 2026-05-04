const REACTION_SIGNALS: Record<string, { signal: number; axis: string }> = {
  thumbsup: { signal: 0.5, axis: 'general' },
  '+1': { signal: 0.5, axis: 'general' },
  thumbsdown: { signal: -0.5, axis: 'general' },
  '-1': { signal: -0.5, axis: 'general' },
  heavy_check_mark: { signal: 0.3, axis: 'accuracy' },
  white_check_mark: { signal: 0.3, axis: 'accuracy' },
  thinking_face: { signal: 0, axis: 'clarity' },
  heart: { signal: 0.7, axis: 'general' },
  fire: { signal: 0.7, axis: 'general' },
  eyes: { signal: 0.2, axis: 'interest' },
  raised_hands: { signal: 0.5, axis: 'general' },
  pray: { signal: 0.5, axis: 'general' },
  confused: { signal: -0.3, axis: 'clarity' },
  x: { signal: -0.5, axis: 'general' },
};

export function reactionToSignal(reaction: string): { signal: number; axis: string } | null {
  return REACTION_SIGNALS[reaction as ReactionType] ?? null;
}
