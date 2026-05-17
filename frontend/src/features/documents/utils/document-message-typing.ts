export type DocumentMessageTypingUser = {
  id: string;
  name: string;
  email: string;
};

export function formatTypingIndicatorLabel(
  users: ReadonlyArray<DocumentMessageTypingUser>,
): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0]!.name} yazıyor…`;
  if (users.length === 2) {
    return `${users[0]!.name} ve ${users[1]!.name} yazıyor…`;
  }
  return `${users.length} kişi yazıyor…`;
}
