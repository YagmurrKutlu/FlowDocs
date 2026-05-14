/** Deterministic presence rail gradients (UI only; index order in list). */
export const PRESENCE_INDEX_GRADIENTS = [
  { from: '#5b8af0', to: '#9b7ff0', dot: '#6b93f5' },
  { from: '#3ecf8e', to: '#06b6d4', dot: '#3ecf8e' },
  { from: '#f0a040', to: '#f05b5b', dot: '#f0a040' },
  { from: '#9b7ff0', to: '#c084fc', dot: '#c084fc' },
] as const;

export function presenceGradientCss(index: number): string {
  const g = PRESENCE_INDEX_GRADIENTS[index % PRESENCE_INDEX_GRADIENTS.length]!;
  return `linear-gradient(135deg, ${g.from} 0%, ${g.to} 100%)`;
}

export function presenceDotColor(index: number): string {
  return PRESENCE_INDEX_GRADIENTS[index % PRESENCE_INDEX_GRADIENTS.length]!.dot;
}

export function presenceGradIndexForActor(actorUserId: string | undefined, listIndex: number): number {
  if (!actorUserId) return listIndex % PRESENCE_INDEX_GRADIENTS.length;
  let h = 0;
  for (let i = 0; i < actorUserId.length; i += 1) {
    h = (h * 31 + actorUserId.charCodeAt(i)) >>> 0;
  }
  return h % PRESENCE_INDEX_GRADIENTS.length;
}
