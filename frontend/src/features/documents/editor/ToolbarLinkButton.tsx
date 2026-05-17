import { Button, Group, Popover, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconLink } from '@tabler/icons-react';
import type { LexicalEditor, RangeSelection } from 'lexical';
import { useCallback, useEffect, useState } from 'react';
import editorShell from './DocumentEditorShell.module.css';
import {
  applyLinkInEditor,
  readLinkFromSelection,
  removeLinkInEditor,
  sanitizeLinkUrl,
} from './linkFormatting';

interface ToolbarLinkButtonProps {
  disabled?: boolean;
  active: boolean;
  editor: LexicalEditor;
  lastSelectionRef: React.MutableRefObject<RangeSelection | null>;
}

export function ToolbarLinkButton({
  disabled,
  active,
  editor,
  lastSelectionRef,
}: ToolbarLinkButtonProps) {
  const [opened, setOpened] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [hasExistingLink, setHasExistingLink] = useState(false);

  const syncDraftFromSelection = useCallback(() => {
    editor.getEditorState().read(() => {
      const { url } = readLinkFromSelection();
      setUrlDraft(url ?? '');
      setHasExistingLink(url !== null);
    });
  }, [editor]);

  useEffect(() => {
    if (opened) {
      syncDraftFromSelection();
    }
  }, [opened, syncDraftFromSelection]);

  const handleOpen = () => {
    if (disabled) return;
    syncDraftFromSelection();
    setOpened(true);
  };

  const handleSave = () => {
    const canApply = editor.getEditorState().read(() => {
      const { hasNonCollapsedSelection, url } = readLinkFromSelection();
      return hasNonCollapsedSelection || url !== null;
    });

    if (!canApply) {
      notifications.show({
        title: 'Bağlantı eklenemedi',
        message: 'Önce metin seçin.',
        color: 'orange',
      });
      return;
    }

    if (!sanitizeLinkUrl(urlDraft)) {
      notifications.show({
        title: 'Geçersiz adres',
        message: 'Geçerli bir http(s) URL girin.',
        color: 'red',
      });
      return;
    }

    const applied = applyLinkInEditor(editor, urlDraft, lastSelectionRef.current);
    if (!applied) {
      notifications.show({
        title: 'Geçersiz adres',
        message: 'Geçerli bir http(s) URL girin.',
        color: 'red',
      });
      return;
    }

    setOpened(false);
    editor.focus();
  };

  const handleRemove = () => {
    removeLinkInEditor(editor, lastSelectionRef.current);
    setUrlDraft('');
    setOpened(false);
    editor.focus();
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom"
      withArrow
      shadow="md"
      withinPortal
      zIndex={500}
      disabled={disabled}
    >
      <Popover.Target>
        <Tooltip label="Bağlantı" withArrow position="bottom" openDelay={350}>
          <UnstyledButton
            type="button"
            className={`${editorShell.toolbarIconBtn}${active ? ` ${editorShell.toolbarIconBtnActive}` : ''}`}
            disabled={disabled}
            aria-label="Bağlantı"
            aria-expanded={opened}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleOpen}
          >
            <IconLink size={18} stroke={2} />
          </UnstyledButton>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown className={editorShell.linkPopover}>
        <Text className={editorShell.linkPopoverTitle}>Bağlantı</Text>
        <TextInput
          size="xs"
          placeholder="https://ornek.com"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            }
          }}
          classNames={{ input: editorShell.linkPopoverInput }}
          autoFocus
        />
        <Group className={editorShell.linkPopoverActions} gap={6} mt={10} justify="flex-end">
          <Button
            variant="subtle"
            size="compact-xs"
            color="gray"
            onClick={() => setOpened(false)}
          >
            İptal
          </Button>
          {hasExistingLink ? (
            <Button variant="light" size="compact-xs" color="red" onClick={handleRemove}>
              Kaldır
            </Button>
          ) : null}
          <Button variant="filled" size="compact-xs" onClick={handleSave}>
            Kaydet
          </Button>
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
}
