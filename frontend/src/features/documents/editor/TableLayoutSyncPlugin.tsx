import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import { useEffect } from 'react';
import { syncAllTableWrapperLayouts } from './nodes/FlowDocsTableNode';

/** Keeps table wrapper align/width classes in sync after Yjs restore and remote updates. */
export function TableLayoutSyncPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        syncAllTableWrapperLayouts(editor);
      }),
      editor.registerRootListener(() => {
        syncAllTableWrapperLayouts(editor);
      }),
    );
  }, [editor]);

  return null;
}
