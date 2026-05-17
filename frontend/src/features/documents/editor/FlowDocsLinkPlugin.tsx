import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Button, Group, Popover, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RangeSelection } from 'lexical';
import { useDocumentEditorCanEdit } from './DocumentEditorCapabilitiesContext';
import editorShell from './DocumentEditorShell.module.css';
import {
  applyLinkInEditor,
  findLinkAnchorElement,
  openLinkInNewTab,
  readSafeUrlFromAnchor,
  removeLinkInEditor,
  sanitizeLinkUrl,
  selectLinkFromDom,
} from './linkFormatting';

type LinkClickMode = 'menu' | 'edit';

interface LinkClickAnchor {
  x: number;
  y: number;
}

/** Validates URLs; click handling is in LinkClickPlugin. */
export function FlowDocsLinkPlugin() {
  return (
    <LinkPlugin
      validateUrl={(url) => sanitizeLinkUrl(url) !== null}
      attributes={{
        rel: 'noopener noreferrer',
      }}
    />
  );
}

/** Edit: link click opens action popover. View: opens link in new tab. */
export function LinkClickPlugin() {
  const [editor] = useLexicalComposerContext();
  const canEdit = useDocumentEditorCanEdit();
  const [opened, setOpened] = useState(false);
  const [anchorPos, setAnchorPos] = useState<LinkClickAnchor>({ x: 0, y: 0 });
  const [url, setUrl] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [mode, setMode] = useState<LinkClickMode>('menu');
  const linkSelectionRef = useRef<RangeSelection | null>(null);

  const closePopover = useCallback(() => {
    setOpened(false);
    setMode('menu');
  }, []);

  const openPopoverAt = useCallback(
    (event: MouseEvent, linkAnchor: HTMLAnchorElement, safeUrl: string) => {
      linkSelectionRef.current = selectLinkFromDom(editor, linkAnchor);
      setUrl(safeUrl);
      setUrlDraft(safeUrl);
      setMode('menu');
      setAnchorPos({ x: event.clientX, y: event.clientY });
      setOpened(true);
    },
    [editor],
  );

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const onClick = (event: MouseEvent) => {
      const linkAnchor = findLinkAnchorElement(event.target);
      if (!linkAnchor) return;

      const safeUrl = readSafeUrlFromAnchor(linkAnchor);
      if (!safeUrl) return;

      const openDirect = !canEdit || event.metaKey || event.ctrlKey;
      if (openDirect) {
        event.preventDefault();
        event.stopPropagation();
        openLinkInNewTab(safeUrl);
        closePopover();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openPopoverAt(event, linkAnchor, safeUrl);
    };

    rootElement.addEventListener('click', onClick, true);
    return () => rootElement.removeEventListener('click', onClick, true);
  }, [canEdit, closePopover, editor, openPopoverAt]);

  const handleOpenLink = () => {
    if (!openLinkInNewTab(url)) {
      notifications.show({
        title: 'Geçersiz adres',
        message: 'Bağlantı açılamadı.',
        color: 'red',
      });
      return;
    }
    closePopover();
  };

  const handleEdit = () => {
    setUrlDraft(url);
    setMode('edit');
  };

  const handleSaveEdit = () => {
    const applied = applyLinkInEditor(editor, urlDraft, linkSelectionRef.current);
    if (!applied) {
      notifications.show({
        title: 'Geçersiz adres',
        message: 'Geçerli bir http(s) URL girin.',
        color: 'red',
      });
      return;
    }
    closePopover();
    editor.focus();
  };

  const handleRemove = () => {
    removeLinkInEditor(editor, linkSelectionRef.current);
    closePopover();
    editor.focus();
  };

  if (!canEdit && !opened) {
    return null;
  }

  return (
    <Popover
      opened={opened}
      onChange={(next) => {
        if (!next) closePopover();
      }}
      position="bottom-start"
      withArrow
      shadow="md"
      withinPortal
      zIndex={600}
      closeOnClickOutside
    >
      <Popover.Target>
        <span
          aria-hidden
          style={{
            position: 'fixed',
            left: anchorPos.x,
            top: anchorPos.y,
            width: 1,
            height: 1,
            pointerEvents: 'none',
          }}
        />
      </Popover.Target>
      <Popover.Dropdown className={editorShell.linkPopover}>
        {mode === 'menu' ? (
          <>
            <Text className={editorShell.linkPopoverTitle}>Bağlantı</Text>
            <Text className={editorShell.linkPopoverUrl} truncate title={url}>
              {url}
            </Text>
            <Group className={editorShell.linkPopoverActions} gap={6} mt={10} justify="flex-end">
              <Button variant="light" size="compact-xs" color="red" onClick={handleRemove}>
                Kaldır
              </Button>
              <Button variant="subtle" size="compact-xs" color="gray" onClick={handleEdit}>
                Düzenle
              </Button>
              <Button variant="filled" size="compact-xs" onClick={handleOpenLink}>
                Aç
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Text className={editorShell.linkPopoverTitle}>Bağlantıyı düzenle</Text>
            <TextInput
              size="xs"
              placeholder="https://ornek.com"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveEdit();
                }
              }}
              classNames={{ input: editorShell.linkPopoverInput }}
              autoFocus
            />
            <Group className={editorShell.linkPopoverActions} gap={6} mt={10} justify="flex-end">
              <Button variant="subtle" size="compact-xs" color="gray" onClick={() => setMode('menu')}>
                Geri
              </Button>
              <Button variant="filled" size="compact-xs" onClick={handleSaveEdit}>
                Kaydet
              </Button>
            </Group>
          </>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
