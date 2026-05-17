import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findTableNode, $isTableSelection } from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import { Group, Tooltip, UnstyledButton } from '@mantine/core';
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconArrowDown,
  IconArrowUp,
  IconArrowsHorizontal,
} from '@tabler/icons-react';
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
  type NodeKey,
} from 'lexical';
import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useDocumentEditorCanEdit } from './DocumentEditorCapabilitiesContext';
import editorShell from './DocumentEditorShell.module.css';
import {
  $isFlowDocsTableNode,
  type FlowDocsTableNode,
  type TableLayoutAlign,
  type TableWidthPreset,
} from './nodes/FlowDocsTableNode';
import {
  $canMoveFlowDocsTable,
  $moveFlowDocsTable,
  logMoveTable,
  type TableMoveDirection,
} from './tableUtils';

interface TableFloatingToolbarProps {
  anchorRef: RefObject<HTMLElement | null>;
}

type ToolbarState = {
  tableKey: NodeKey;
  top: number;
  left: number;
  layoutAlign: TableLayoutAlign;
  widthPreset: TableWidthPreset;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

function $getActiveFlowDocsTable(): FlowDocsTableNode | null {
  const selection = $getSelection();
  if ($isTableSelection(selection)) {
    const node = $getNodeByKey<FlowDocsTableNode>(selection.tableKey);
    return $isFlowDocsTableNode(node) ? node : null;
  }
  if ($isRangeSelection(selection)) {
    const table = $findTableNode(selection.anchor.getNode());
    return $isFlowDocsTableNode(table) ? table : null;
  }
  return null;
}

const WIDTH_OPTIONS: { value: TableWidthPreset; label: string }[] = [
  { value: 'narrow', label: 'Dar' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Geniş' },
  { value: 'full', label: 'Tam' },
];

export function TableFloatingToolbar({ anchorRef }: TableFloatingToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const canEdit = useDocumentEditorCanEdit();
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);

  const updateToolbar = useCallback(() => {
    if (!canEdit) {
      setToolbar(null);
      return;
    }

    const anchor = anchorRef.current;
    if (!anchor) {
      setToolbar(null);
      return;
    }

    editor.getEditorState().read(() => {
      const table = $getActiveFlowDocsTable();
      if (!table) {
        setToolbar(null);
        return;
      }

      const tableElement = editor.getElementByKey(table.getKey());
      const wrapper = tableElement?.closest('.flowdocs-table-scroll');
      if (!(wrapper instanceof HTMLElement)) {
        setToolbar(null);
        return;
      }

      const wrapperRect = wrapper.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      setToolbar({
        tableKey: table.getKey(),
        top: wrapperRect.top - anchorRect.top - 44,
        left: wrapperRect.left - anchorRect.left,
        layoutAlign: table.getLayoutAlign(),
        widthPreset: table.getWidthPreset(),
        canMoveUp: $canMoveFlowDocsTable(table, 'up'),
        canMoveDown: $canMoveFlowDocsTable(table, 'down'),
      });
    });
  }, [anchorRef, canEdit, editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerUpdateListener(() => {
        updateToolbar();
      }),
    );
  }, [editor, updateToolbar]);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !toolbar) return undefined;

    const onScroll = () => updateToolbar();
    anchor.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      anchor.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [anchorRef, toolbar, updateToolbar]);

  const patchTable = useCallback(
    (patch: { layoutAlign?: TableLayoutAlign; widthPreset?: TableWidthPreset }) => {
      if (!toolbar) return;
      editor.update(() => {
        const node = $getNodeByKey<FlowDocsTableNode>(toolbar.tableKey);
        if (!$isFlowDocsTableNode(node)) return;
        const writable = node.getWritable();
        if (patch.layoutAlign) writable.setLayoutAlign(patch.layoutAlign);
        if (patch.widthPreset) writable.setWidthPreset(patch.widthPreset);
      });
      editor.focus();
    },
    [editor, toolbar],
  );

  const moveTable = useCallback(
    (direction: TableMoveDirection) => {
      if (!toolbar) return;
      if (direction === 'up' && !toolbar.canMoveUp) return;
      if (direction === 'down' && !toolbar.canMoveDown) return;

      editor.update(() => {
        const node = $getNodeByKey<FlowDocsTableNode>(toolbar.tableKey);
        if (!$isFlowDocsTableNode(node)) return;
        if (!$moveFlowDocsTable(node, direction)) return;
        logMoveTable(direction);
      });
      editor.focus();
    },
    [editor, toolbar],
  );

  if (!canEdit || !toolbar) return null;

  return (
    <div
      className={editorShell.tableFloatingToolbar}
      style={{ top: Math.max(8, toolbar.top), left: toolbar.left }}
      role="toolbar"
      aria-label="Tablo düzeni"
    >
      <Group gap={2} wrap="nowrap">
        <Tooltip label="Sola hizala" withArrow position="top" openDelay={300}>
          <UnstyledButton
            type="button"
            className={editorShell.tableFloatingBtn}
            data-active={toolbar.layoutAlign === 'left' || undefined}
            aria-label="Sola hizala"
            aria-pressed={toolbar.layoutAlign === 'left'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => patchTable({ layoutAlign: 'left' })}
          >
            <IconAlignLeft size={16} stroke={2} />
          </UnstyledButton>
        </Tooltip>
        <Tooltip label="Ortala" withArrow position="top" openDelay={300}>
          <UnstyledButton
            type="button"
            className={editorShell.tableFloatingBtn}
            data-active={toolbar.layoutAlign === 'center' || undefined}
            aria-label="Ortala"
            aria-pressed={toolbar.layoutAlign === 'center'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => patchTable({ layoutAlign: 'center' })}
          >
            <IconAlignCenter size={16} stroke={2} />
          </UnstyledButton>
        </Tooltip>
        <Tooltip label="Sağa hizala" withArrow position="top" openDelay={300}>
          <UnstyledButton
            type="button"
            className={editorShell.tableFloatingBtn}
            data-active={toolbar.layoutAlign === 'right' || undefined}
            aria-label="Sağa hizala"
            aria-pressed={toolbar.layoutAlign === 'right'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => patchTable({ layoutAlign: 'right' })}
          >
            <IconAlignRight size={16} stroke={2} />
          </UnstyledButton>
        </Tooltip>
      </Group>
      <span className={editorShell.tableFloatingDivider} aria-hidden />
      <Group gap={2} wrap="nowrap">
        <Tooltip label="Yukarı taşı" withArrow position="top" openDelay={300}>
          <UnstyledButton
            type="button"
            className={editorShell.tableFloatingBtn}
            disabled={!toolbar.canMoveUp}
            aria-label="Yukarı taşı"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => moveTable('up')}
          >
            <IconArrowUp size={16} stroke={2} />
          </UnstyledButton>
        </Tooltip>
        <Tooltip label="Aşağı taşı" withArrow position="top" openDelay={300}>
          <UnstyledButton
            type="button"
            className={editorShell.tableFloatingBtn}
            disabled={!toolbar.canMoveDown}
            aria-label="Aşağı taşı"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => moveTable('down')}
          >
            <IconArrowDown size={16} stroke={2} />
          </UnstyledButton>
        </Tooltip>
      </Group>
      <span className={editorShell.tableFloatingDivider} aria-hidden />
      <Group gap={2} wrap="nowrap">
        {WIDTH_OPTIONS.map((option) => (
          <Tooltip key={option.value} label={option.label} withArrow position="top" openDelay={300}>
            <UnstyledButton
              type="button"
              className={editorShell.tableFloatingWidthBtn}
              data-active={toolbar.widthPreset === option.value || undefined}
              aria-label={`Genişlik: ${option.label}`}
              aria-pressed={toolbar.widthPreset === option.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => patchTable({ widthPreset: option.value })}
            >
              {option.value === 'full' ? (
                <IconArrowsHorizontal size={14} stroke={2} />
              ) : (
                option.label
              )}
            </UnstyledButton>
          </Tooltip>
        ))}
      </Group>
    </div>
  );
}
