import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findTableNode } from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import { FORMAT_TEXT_COMMAND } from 'lexical';
import { Group, Tooltip, UnstyledButton } from '@mantine/core';
import {
  IconBold,
  IconHighlight,
  IconItalic,
  IconLink,
  IconUnderline,
} from '@tabler/icons-react';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
  type RangeSelection,
} from 'lexical';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useExperimentalPreference } from '../../settings/hooks/useSettingsPreferences';
import { useDocumentEditorCanEdit } from './DocumentEditorCapabilitiesContext';
import editorShell from './DocumentEditorShell.module.css';
import { getActiveFileAttachmentKey } from './fileAttachmentSelection';
import {
  applyHighlightToSelection,
  DEFAULT_HIGHLIGHT_COLOR,
  readStoredActiveHighlightColor,
} from './highlightFormatting';
import { applyLinkInEditor } from './linkFormatting';
import { $isFlowDocsTableNode } from './nodes/FlowDocsTableNode';

interface FloatingSelectionToolbarProps {
  anchorRef: RefObject<HTMLElement | null>;
}

type ToolbarState = {
  top: number;
  left: number;
};

function $selectionOverlapsTable(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const table = $findTableNode(selection.anchor.getNode());
  return $isFlowDocsTableNode(table);
}

export function FloatingSelectionToolbar({
  anchorRef,
}: FloatingSelectionToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const canEdit = useDocumentEditorCanEdit();
  const enabled = useExperimentalPreference('floatingToolbarBeta');
  const lastSelectionRef = useRef<RangeSelection | null>(null);
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);

  const updateToolbar = useCallback(() => {
    if (!enabled || !canEdit) {
      setToolbar(null);
      return;
    }

    if (getActiveFileAttachmentKey()) {
      setToolbar(null);
      return;
    }

    const anchor = anchorRef.current;
    if (!anchor) {
      setToolbar(null);
      return;
    }

    editor.getEditorState().read(() => {
      if ($selectionOverlapsTable()) {
        setToolbar(null);
        return;
      }

      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        setToolbar(null);
        return;
      }

      const nativeSelection = window.getSelection();
      if (!nativeSelection || nativeSelection.rangeCount === 0) {
        setToolbar(null);
        return;
      }

      const range = nativeSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setToolbar(null);
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      setToolbar({
        top: rect.top - anchorRect.top - 48,
        left: rect.left - anchorRect.left + rect.width / 2,
      });
    });
  }, [anchorRef, canEdit, editor, enabled]);

  useEffect(() => {
    if (!enabled) {
      setToolbar(null);
      return;
    }

    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            lastSelectionRef.current = selection.clone();
          }
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerUpdateListener(() => {
        updateToolbar();
      }),
    );
  }, [editor, enabled, updateToolbar]);

  useEffect(() => {
    const onScroll = () => updateToolbar();
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [updateToolbar]);

  if (!enabled || !toolbar) {
    return null;
  }

  const formatText = (format: 'bold' | 'italic' | 'underline') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const handleHighlight = () => {
    const color = readStoredActiveHighlightColor() || DEFAULT_HIGHLIGHT_COLOR;
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        applyHighlightToSelection(selection, color);
      }
    });
  };

  const handleLink = () => {
    const url = window.prompt('Bağlantı URL adresi');
    if (!url?.trim()) return;
    applyLinkInEditor(editor, url.trim(), lastSelectionRef.current);
  };

  return (
    <div
      className={editorShell.selectionFloatingToolbar}
      style={{
        top: toolbar.top,
        left: toolbar.left,
        transform: 'translateX(-50%)',
      }}
      role="toolbar"
      aria-label="Seçim araç çubuğu"
    >
      <Group gap={4} wrap="nowrap">
        <Tooltip label="Kalın">
          <UnstyledButton className={editorShell.selectionFloatingBtn} onClick={() => formatText('bold')}>
            <IconBold size={16} />
          </UnstyledButton>
        </Tooltip>
        <Tooltip label="İtalik">
          <UnstyledButton className={editorShell.selectionFloatingBtn} onClick={() => formatText('italic')}>
            <IconItalic size={16} />
          </UnstyledButton>
        </Tooltip>
        <Tooltip label="Altı çizili">
          <UnstyledButton className={editorShell.selectionFloatingBtn} onClick={() => formatText('underline')}>
            <IconUnderline size={16} />
          </UnstyledButton>
        </Tooltip>
        <Tooltip label="Bağlantı">
          <UnstyledButton className={editorShell.selectionFloatingBtn} onClick={handleLink}>
            <IconLink size={16} />
          </UnstyledButton>
        </Tooltip>
        <Tooltip label="Vurgu">
          <UnstyledButton className={editorShell.selectionFloatingBtn} onClick={handleHighlight}>
            <IconHighlight size={16} />
          </UnstyledButton>
        </Tooltip>
      </Group>
    </div>
  );
}
