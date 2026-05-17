import { useCallback, useEffect, useRef } from 'react';

const TYPING_TRUE_INTERVAL_MS = 1500;
const TYPING_IDLE_MS = 3000;

export function useDocumentMessageTyping(
  onEmitTyping: ((isTyping: boolean) => void) | undefined,
  draft: string,
) {
  const isTypingActiveRef = useRef(false);
  const lastTrueEmitAtRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!onEmitTyping) return;
      if (isTypingActiveRef.current === isTyping) return;
      isTypingActiveRef.current = isTyping;
      onEmitTyping(isTyping);
    },
    [onEmitTyping],
  );

  const stopTyping = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    sendTyping(false);
    lastTrueEmitAtRef.current = 0;
  }, [sendTyping]);

  useEffect(() => {
    if (!onEmitTyping) return undefined;

    const trimmed = draft.trim();
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (!trimmed) {
      stopTyping();
      return undefined;
    }

    const now = Date.now();
    if (now - lastTrueEmitAtRef.current >= TYPING_TRUE_INTERVAL_MS) {
      lastTrueEmitAtRef.current = now;
      sendTyping(true);
    }

    idleTimerRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_IDLE_MS);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [draft, onEmitTyping, sendTyping, stopTyping]);

  useEffect(
    () => () => {
      if (isTypingActiveRef.current) {
        onEmitTyping?.(false);
        isTypingActiveRef.current = false;
      }
    },
    [onEmitTyping],
  );

  return { stopTyping };
}
