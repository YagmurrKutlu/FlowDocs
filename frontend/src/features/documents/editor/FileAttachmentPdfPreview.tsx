import { Box, Button, Group, Skeleton, Text } from '@mantine/core';
import { IconExternalLink, IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  openAuthenticatedMediaInNewTab,
  useAuthenticatedMediaObjectUrl,
} from '../utils/authenticated-media-blob';

interface FileAttachmentPdfPreviewProps {
  src: string;
  fileName: string;
  onClose: () => void;
  onSelectBlock?: () => void;
}

type PreviewRenderer = 'iframe' | 'object' | 'blocked';

const BLOCKED_COPY =
  'Önizleme tarayıcı tarafından engellendi (Opera veya reklam engelleyici). PDF’i yeni sekmede açabilirsiniz.';

function looksLikeBrowserBlockedPreview(doc: Document): boolean {
  const text = (doc.body?.innerText ?? doc.documentElement?.innerText ?? '').toLowerCase();
  if (!text) return false;
  return (
    text.includes('blocked by opera') ||
    text.includes('err_blocked_by_client') ||
    text.includes('this page has been blocked') ||
    text.includes('blocked by client')
  );
}

function canReadBlobIframeDocument(iframe: HTMLIFrameElement): boolean {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return false;
    if (looksLikeBrowserBlockedPreview(doc)) return false;
    return true;
  } catch {
    return false;
  }
}

export function FileAttachmentPdfPreview({
  src,
  fileName,
  onClose,
  onSelectBlock,
}: FileAttachmentPdfPreviewProps) {
  const { objectUrl, loading, error } = useAuthenticatedMediaObjectUrl(
    src,
    true,
    'application/pdf',
  );

  const [renderer, setRenderer] = useState<PreviewRenderer>('iframe');
  const [openBusy, setOpenBusy] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const objectRef = useRef<HTMLObjectElement>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!objectUrl) {
      setRenderer('iframe');
      return;
    }
    setRenderer('iframe');
  }, [objectUrl]);

  useEffect(() => clearFallbackTimer, [clearFallbackTimer]);

  const markBlocked = useCallback(() => {
    clearFallbackTimer();
    setRenderer('blocked');
  }, [clearFallbackTimer]);

  const tryObjectFallback = useCallback(() => {
    clearFallbackTimer();
    setRenderer((current) => (current === 'blocked' ? current : 'object'));
    fallbackTimerRef.current = setTimeout(() => {
      const objectEl = objectRef.current;
      if (!objectEl) {
        markBlocked();
        return;
      }
      try {
        const doc = objectEl.contentDocument;
        if (doc && looksLikeBrowserBlockedPreview(doc)) {
          markBlocked();
        }
      } catch {
        // object/embed may not expose contentDocument; keep object visible
      }
    }, 2500);
  }, [clearFallbackTimer, markBlocked]);

  const handleIframeLoad = useCallback(() => {
    clearFallbackTimer();
    const iframe = iframeRef.current;
    if (!iframe) {
      tryObjectFallback();
      return;
    }
    if (!canReadBlobIframeDocument(iframe)) {
      tryObjectFallback();
      return;
    }
    setRenderer('iframe');
  }, [clearFallbackTimer, tryObjectFallback]);

  const handleIframeError = useCallback(() => {
    tryObjectFallback();
  }, [tryObjectFallback]);

  const handleObjectError = useCallback(() => {
    markBlocked();
  }, [markBlocked]);

  const handleOpenInNewTab = async () => {
    setOpenBusy(true);
    try {
      await openAuthenticatedMediaInNewTab(src);
    } finally {
      setOpenBusy(false);
    }
  };

  const showBlocked = renderer === 'blocked' && objectUrl && !loading && !error;
  const showObject = renderer === 'object' && objectUrl && !loading && !error && !showBlocked;
  const showIframe = renderer === 'iframe' && objectUrl && !loading && !error && !showBlocked;

  return (
    <div className="flowdocs-file-attachment-preview">
      <div className="flowdocs-file-attachment-preview__header">
        {onSelectBlock ? (
          <button
            type="button"
            className="flowdocs-file-attachment-select-handle"
            aria-label="Dosya bloğunu seç"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelectBlock();
            }}
          >
            Dosya bloğunu seç
          </button>
        ) : null}
        <Text size="xs" c="dimmed" className="flowdocs-file-attachment-preview__label">
          PDF önizleme — {fileName}
        </Text>
        <Button
          type="button"
          size="compact-xs"
          variant="subtle"
          leftSection={<IconX size={14} />}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          Önizlemeyi kapat
        </Button>
      </div>
      <div className="flowdocs-file-attachment-preview__frame">
        {loading ? <Skeleton height="100%" radius="md" animate /> : null}
        {error ? (
          <Box className="flowdocs-file-attachment-preview__error">
            <Text size="sm" c="red">
              {error}
            </Text>
          </Box>
        ) : null}
        {showBlocked ? (
          <Box className="flowdocs-file-attachment-preview__error">
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              {BLOCKED_COPY}
            </Text>
            <Group justify="center" mt="md">
              <Button
                type="button"
                size="compact-sm"
                variant="light"
                leftSection={<IconExternalLink size={14} />}
                loading={openBusy}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => void handleOpenInNewTab()}
              >
                Yeni sekmede aç
              </Button>
            </Group>
          </Box>
        ) : null}
        {showIframe ? (
          <iframe
            ref={iframeRef}
            className="flowdocs-file-attachment-preview__iframe"
            src={objectUrl}
            title={`PDF önizleme: ${fileName}`}
            loading="lazy"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        ) : null}
        {showObject ? (
          <object
            ref={objectRef}
            className="flowdocs-file-attachment-preview__embed"
            data={objectUrl}
            type="application/pdf"
            title={`PDF önizleme: ${fileName}`}
            onError={handleObjectError}
          >
            <embed
              className="flowdocs-file-attachment-preview__embed"
              src={objectUrl}
              type="application/pdf"
              title={`PDF önizleme: ${fileName}`}
              onError={handleObjectError}
            />
          </object>
        ) : null}
      </div>
    </div>
  );
}
