import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { setScrollableTablesActive } from '@lexical/table';
import { useEffect } from 'react';
import { TableLayoutSyncPlugin } from './TableLayoutSyncPlugin';

/** Table keyboard navigation, scroll wrapper, and layout sync. */
export function FlowDocsTablePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    setScrollableTablesActive(editor, true);
  }, [editor]);

  return (
    <>
      <TablePlugin hasCellMerge={false} hasTabHandler hasHorizontalScroll />
      <TableLayoutSyncPlugin />
    </>
  );
}
