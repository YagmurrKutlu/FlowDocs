import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isHeadingNode } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import editorShell from './DocumentEditorShell.module.css';
import {
  extractDocumentOutline,
  outlinesEqual,
  scrollToOutlineHeading,
  type DocumentOutlineEntry,
} from './documentOutline';

interface DocumentOutlinePanelProps {
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

export function DocumentOutlinePanel({ scrollContainerRef }: DocumentOutlinePanelProps) {
  const [editor] = useLexicalComposerContext();
  const [entries, setEntries] = useState<DocumentOutlineEntry[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const lastEntriesRef = useRef<DocumentOutlineEntry[]>([]);

  const syncOutline = useCallback(() => {
    const next = editor.getEditorState().read(() => extractDocumentOutline());
    if (outlinesEqual(lastEntriesRef.current, next)) return;
    lastEntriesRef.current = next;
    setEntries(next);
    setActiveKey((prev) => (prev && next.some((item) => item.key === prev) ? prev : null));
  }, [editor]);

  useEffect(() => {
    syncOutline();

    return mergeRegister(
      editor.registerUpdateListener(() => {
        syncOutline();
      }),
      editor.registerRootListener(() => {
        syncOutline();
      }),
    );
  }, [editor, syncOutline]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const topLevel = selection.anchor.getNode().getTopLevelElementOrThrow();
          if ($isHeadingNode(topLevel)) {
            setActiveKey(topLevel.getKey());
          }
        });
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  const handleSelect = (key: string) => {
    setActiveKey(key);
    scrollToOutlineHeading(editor, key, scrollContainerRef?.current ?? null);
  };

  return (
    <nav className={editorShell.outlineNav} aria-label="İçindekiler">
      {entries.length === 0 ? (
        <p className={editorShell.outlineEmpty}>Henüz başlık yok</p>
      ) : (
        <ul className={editorShell.outlineList}>
          {entries.map((entry) => {
            const levelClass =
              entry.level === 1
                ? editorShell.outlineItemLevel1
                : entry.level === 2
                  ? editorShell.outlineItemLevel2
                  : editorShell.outlineItemLevel3;

            return (
              <li key={entry.key}>
                <button
                  type="button"
                  className={`${editorShell.outlineItem} ${levelClass}${
                    activeKey === entry.key ? ` ${editorShell.outlineItemActive}` : ''
                  }`}
                  onClick={() => handleSelect(entry.key)}
                  title={entry.text || 'Boş başlık'}
                >
                  <span className={editorShell.outlineItemText}>
                    {entry.text || 'Boş başlık'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
