import type { Provider } from '@lexical/yjs';
import type { Doc } from 'yjs';

type ProviderEvent = 'sync' | 'update' | 'status' | 'reload';

export function createLocalPersistenceProvider(_ydoc: Doc): Provider {
  const providerListeners = new Map<ProviderEvent, Set<(...args: unknown[]) => void>>();
  const awarenessListeners = new Set<() => void>();

  const notifyProvider = (type: ProviderEvent, ...args: unknown[]) => {
    providerListeners.get(type)?.forEach((cb) => {
      cb(...args);
    });
  };

  const awareness: Provider['awareness'] = {
    getLocalState: () => null,
    getStates: () => new Map(),
    on: (_type: 'update', cb: () => void) => {
      awarenessListeners.add(cb);
    },
    off: (_type: 'update', cb: () => void) => {
      awarenessListeners.delete(cb);
    },
    setLocalState: () => {},
    setLocalStateField: () => {},
  };

  return {
    awareness,
    connect() {
      queueMicrotask(() => {
        notifyProvider('status', { status: 'connected' });
        notifyProvider('sync', true);
      });
    },
    disconnect() {
      providerListeners.clear();
      awarenessListeners.clear();
    },
    on(type: ProviderEvent, cb: (...args: unknown[]) => void) {
      let set = providerListeners.get(type);
      if (!set) {
        set = new Set();
        providerListeners.set(type, set);
      }
      set.add(cb);
    },
    off(type: ProviderEvent, cb: (...args: unknown[]) => void) {
      providerListeners.get(type)?.delete(cb);
    },
  } as Provider;
}
