import * as Y from 'yjs';
import { DocumentStateRecoveryService } from './document-state-recovery.service';

describe('DocumentStateRecoveryService helpers', () => {
  const service = Object.create(
    DocumentStateRecoveryService.prototype,
  ) as DocumentStateRecoveryService;

  const evaluateYDoc = (
    service as unknown as { evaluateYDoc: (ydoc: Y.Doc, serialized?: string) => unknown }
  ).evaluateYDoc.bind(service);

  const pickBetterCandidate = (
    service as unknown as {
      pickBetterCandidate: (
        current: unknown,
        next: unknown,
      ) => unknown;
    }
  ).pickBetterCandidate.bind(service);

  it('detects recoverable ydoc with plain text', () => {
    const ydoc = new Y.Doc();
    ydoc.getText('content').insert(0, 'Merhaba dünya');
    const metrics = evaluateYDoc(ydoc) as { isRecoverable: boolean; rootTextLength: number };
    expect(metrics.isRecoverable).toBe(true);
    expect(metrics.rootTextLength).toBeGreaterThan(0);
  });

  it('prefers newer version candidate', () => {
    const older = {
      source: 'snapshot' as const,
      version: 2,
      metrics: { isRecoverable: true, rootTextLength: 10 },
      ydoc: new Y.Doc(),
      serialized: null,
    };
    const newer = {
      source: 'snapshot' as const,
      version: 5,
      metrics: { isRecoverable: true, rootTextLength: 8 },
      ydoc: new Y.Doc(),
      serialized: null,
    };
    const picked = pickBetterCandidate(older, newer) as { version: number };
    expect(picked.version).toBe(5);
  });
});
