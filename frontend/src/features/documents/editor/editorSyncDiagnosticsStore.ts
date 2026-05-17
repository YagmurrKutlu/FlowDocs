export type SyncDiagnosticsSnapshot = {
  socketConnected: boolean;
  documentId: string;
  userRole: string;
  lastDocumentUpdateAt: string | null;
  localUpdateCount: number;
  remoteUpdateCount: number;
  pendingQueueLength: number;
  persistStatus: string;
  collaboratorCount: number;
};

const defaultSnapshot: SyncDiagnosticsSnapshot = {
  socketConnected: false,
  documentId: '',
  userRole: 'viewer',
  lastDocumentUpdateAt: null,
  localUpdateCount: 0,
  remoteUpdateCount: 0,
  pendingQueueLength: 0,
  persistStatus: 'idle',
  collaboratorCount: 0,
};

let snapshot: SyncDiagnosticsSnapshot = { ...defaultSnapshot };
const listeners = new Set<() => void>();

export function getSyncDiagnosticsSnapshot(): SyncDiagnosticsSnapshot {
  return snapshot;
}

export function subscribeSyncDiagnostics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function patchSyncDiagnostics(
  partial: Partial<SyncDiagnosticsSnapshot>,
): void {
  snapshot = { ...snapshot, ...partial };
  listeners.forEach((listener) => listener());
}

export function resetSyncDiagnostics(documentId: string, userRole: string): void {
  snapshot = {
    ...defaultSnapshot,
    documentId,
    userRole,
  };
  listeners.forEach((listener) => listener());
}

export function incrementLocalUpdateCount(): void {
  patchSyncDiagnostics({ localUpdateCount: snapshot.localUpdateCount + 1 });
}

export function incrementRemoteUpdateCount(): void {
  patchSyncDiagnostics({
    remoteUpdateCount: snapshot.remoteUpdateCount + 1,
    lastDocumentUpdateAt: new Date().toISOString(),
  });
}
