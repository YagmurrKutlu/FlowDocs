export const DOCUMENT_ACCENTS = [
  'blue',
  'emerald',
  'orange',
  'purple',
  'pink',
  'cyan',
  'amber',
  'indigo',
] as const;

export type DocumentAccent = (typeof DOCUMENT_ACCENTS)[number];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDocumentAccent(documentId: string): DocumentAccent {
  const index = hashString(documentId) % DOCUMENT_ACCENTS.length;
  return DOCUMENT_ACCENTS[index]!;
}
