const USER_COLOR_PALETTE = [
  '#7c3aed', // violet
  '#2563eb', // blue
  '#0d9488', // teal
  '#16a34a', // green
  '#ca8a04', // yellow
  '#ea580c', // orange
  '#dc2626', // red
  '#db2777', // pink
];

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getUserColor(userId: string): string {
  if (!userId) return USER_COLOR_PALETTE[0]!;
  const idx = hashUserId(userId) % USER_COLOR_PALETTE.length;
  return USER_COLOR_PALETTE[idx]!;
}
