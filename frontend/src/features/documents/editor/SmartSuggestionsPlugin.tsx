import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isHeadingNode } from '@lexical/rich-text';
import { Box, Text } from '@mantine/core';
import { IconBulb } from '@tabler/icons-react';
import { $getRoot, $isParagraphNode } from 'lexical';
import { useEffect, useState } from 'react';
import { useExperimentalPreference } from '../../settings/hooks/useSettingsPreferences';
import editorShell from './DocumentEditorShell.module.css';

const LONG_PARAGRAPH_CHARS = 400;

function collectSuggestions(editor: ReturnType<typeof useLexicalComposerContext>[0]): string[] {
  const suggestions: string[] = [];

  editor.getEditorState().read(() => {
    const root = $getRoot();
    let hasH1 = false;
    let hasLongParagraph = false;

    for (const child of root.getChildren()) {
      if ($isHeadingNode(child) && child.getTag() === 'h1') {
        hasH1 = true;
      }
      if ($isParagraphNode(child)) {
        if (child.getTextContent().trim().length >= LONG_PARAGRAPH_CHARS) {
          hasLongParagraph = true;
        }
      }
    }

    if (!hasH1) {
      suggestions.push('Başlık eklemeyi düşünebilirsiniz.');
    }
    if (hasLongParagraph) {
      suggestions.push('Paragrafı bölmek okunabilirliği artırabilir.');
    }
  });

  return suggestions;
}

export function SmartSuggestionsPlugin() {
  const [editor] = useLexicalComposerContext();
  const enabled = useExperimentalPreference('smartSuggestions');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      return;
    }

    const update = () => setSuggestions(collectSuggestions(editor));
    update();
    return editor.registerUpdateListener(() => {
      update();
    });
  }, [editor, enabled]);

  if (!enabled || suggestions.length === 0) {
    return null;
  }

  return (
    <Box className={editorShell.smartSuggestionsBanner} role="status">
      <IconBulb size={16} aria-hidden />
      <div>
        <Text size="xs" fw={600} className={editorShell.smartSuggestionsTitle}>
          Yazım önerileri (beta)
        </Text>
        {suggestions.map((tip) => (
          <Text key={tip} size="xs" className={editorShell.smartSuggestionsText}>
            {tip}
          </Text>
        ))}
      </div>
    </Box>
  );
}
