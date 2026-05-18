export function formatBulkPartialMessage(
  total: number,
  successCount: number,
  successPhrase: string,
): string {
  const failedCount = total - successCount;
  if (failedCount === 0) {
    return total === 1 ? `1 doküman ${successPhrase}.` : `${successCount} doküman ${successPhrase}.`;
  }
  return `${total} dokümandan ${successCount}'i işlendi, ${failedCount}'i işlenemedi.`;
}
