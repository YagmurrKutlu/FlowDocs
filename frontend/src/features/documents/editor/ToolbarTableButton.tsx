import { Button, Group, NumberInput, Popover, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { IconTable } from '@tabler/icons-react';
import { $getRoot, $getSelection, $isRangeSelection } from 'lexical';
import { useState } from 'react';
import editorShell from './DocumentEditorShell.module.css';
import {
  clampTableDimension,
  DEFAULT_TABLE_SIZE,
  logInsertTable,
  MAX_TABLE_SIZE,
  MIN_TABLE_SIZE,
} from './tableUtils';

interface ToolbarTableButtonProps {
  disabled?: boolean;
}

export function ToolbarTableButton({ disabled }: ToolbarTableButtonProps) {
  const [editor] = useLexicalComposerContext();
  const [opened, setOpened] = useState(false);
  const [rows, setRows] = useState(DEFAULT_TABLE_SIZE);
  const [columns, setColumns] = useState(DEFAULT_TABLE_SIZE);

  const handleCreate = () => {
    const rowCount = clampTableDimension(rows);
    const columnCount = clampTableDimension(columns);
    setRows(rowCount);
    setColumns(columnCount);

    editor.focus();
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        const root = $getRoot();
        const lastChild = root.getLastChild();
        if (lastChild) {
          lastChild.selectEnd();
        }
      }
    });

    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      rows: String(rowCount),
      columns: String(columnCount),
      includeHeaders: false,
    });

    logInsertTable(rowCount, columnCount);
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
        <Tooltip label="Tablo" withArrow position="bottom" openDelay={350}>
          <UnstyledButton
            type="button"
            className={editorShell.toolbarIconBtn}
            disabled={disabled}
            aria-label="Tablo"
            aria-expanded={opened}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => !disabled && setOpened((o) => !o)}
          >
            <IconTable size={18} stroke={2} />
          </UnstyledButton>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown className={editorShell.tablePopover}>
        <Text className={editorShell.tablePopoverTitle}>Tablo oluştur</Text>
        <Group gap={10} grow>
          <NumberInput
            label="Satır"
            size="xs"
            min={MIN_TABLE_SIZE}
            max={MAX_TABLE_SIZE}
            value={rows}
            onChange={(value) => setRows(typeof value === 'number' ? value : DEFAULT_TABLE_SIZE)}
            classNames={{ input: editorShell.tablePopoverInput }}
          />
          <NumberInput
            label="Sütun"
            size="xs"
            min={MIN_TABLE_SIZE}
            max={MAX_TABLE_SIZE}
            value={columns}
            onChange={(value) =>
              setColumns(typeof value === 'number' ? value : DEFAULT_TABLE_SIZE)
            }
            classNames={{ input: editorShell.tablePopoverInput }}
          />
        </Group>
        <Group className={editorShell.tablePopoverActions} gap={6} mt={12} justify="flex-end">
          <Button variant="subtle" size="compact-xs" color="gray" onClick={() => setOpened(false)}>
            İptal
          </Button>
          <Button variant="filled" size="compact-xs" onClick={handleCreate}>
            Tablo oluştur
          </Button>
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
}
