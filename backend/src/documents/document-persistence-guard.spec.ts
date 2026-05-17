import * as Y from 'yjs';
import {
  documentStoredStateHasContent,
  evaluateDestructiveEmptyRejection,
  hasNonEmptyPreviewContent,
  hasRichLexicalEditorStateJson,
} from './document-persistence-guard';

const NON_EMPTY_LEXICAL = JSON.stringify({
  root: {
    type: 'root',
    version: 1,
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [{ type: 'text', version: 1, text: 'Hello FlowDocs' }],
      },
    ],
  },
});

function ydocWithPlainText(text: string): Y.Doc {
  const ydoc = new Y.Doc();
  ydoc.getText('content').insert(0, text);
  return ydoc;
}

function yjsHasContent(ydoc: Y.Doc): boolean {
  if (ydoc.getText('content').toString().trim().length > 0) return true;
  const serialized = ydoc.getMap<string>('lexicalState').get('serialized');
  return hasRichLexicalEditorStateJson(serialized);
}

describe('document-persistence-guard', () => {
  describe('hasRichLexicalEditorStateJson', () => {
    it('returns true for non-empty Lexical root', () => {
      expect(hasRichLexicalEditorStateJson(NON_EMPTY_LEXICAL)).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(hasRichLexicalEditorStateJson('')).toBe(false);
      expect(hasRichLexicalEditorStateJson(null)).toBe(false);
    });
  });

  describe('hasNonEmptyPreviewContent', () => {
    it('returns true when preview has text', () => {
      expect(hasNonEmptyPreviewContent('preview text')).toBe(true);
    });

    it('returns false for blank preview', () => {
      expect(hasNonEmptyPreviewContent('   ')).toBe(false);
    });
  });

  describe('documentStoredStateHasContent', () => {
    it('detects editorStateJson content', () => {
      expect(documentStoredStateHasContent(NON_EMPTY_LEXICAL, null)).toBe(true);
    });

    it('detects previewContent content', () => {
      expect(documentStoredStateHasContent(null, 'saved preview')).toBe(true);
    });
  });

  describe('evaluateDestructiveEmptyRejection', () => {
    it('rejects when non-empty document would become empty via Yjs', () => {
      const before = ydocWithPlainText('existing');
      const after = new Y.Doc();

      expect(
        evaluateDestructiveEmptyRejection({
          documentEditorStateJson: null,
          documentPreviewContent: null,
          yjsBeforeHasContent: yjsHasContent(before),
          yjsAfterHasContent: yjsHasContent(after),
        }),
      ).toBe(true);
    });

    it('rejects when editorStateJson is non-empty and incoming update is empty', () => {
      expect(
        evaluateDestructiveEmptyRejection({
          documentEditorStateJson: NON_EMPTY_LEXICAL,
          documentPreviewContent: null,
          yjsBeforeHasContent: false,
          yjsAfterHasContent: false,
        }),
      ).toBe(true);
    });

    it('rejects when previewContent is non-empty and update is empty', () => {
      expect(
        evaluateDestructiveEmptyRejection({
          documentEditorStateJson: null,
          documentPreviewContent: 'Saved body',
          yjsBeforeHasContent: false,
          yjsAfterHasContent: false,
        }),
      ).toBe(true);
    });

    it('allows truly empty document to receive empty state', () => {
      expect(
        evaluateDestructiveEmptyRejection({
          documentEditorStateJson: null,
          documentPreviewContent: null,
          yjsBeforeHasContent: false,
          yjsAfterHasContent: false,
        }),
      ).toBe(false);
    });

    it('allows non-empty update on non-empty document', () => {
      const before = ydocWithPlainText('a');
      const after = ydocWithPlainText('ab');

      expect(
        evaluateDestructiveEmptyRejection({
          documentEditorStateJson: NON_EMPTY_LEXICAL,
          documentPreviewContent: 'preview',
          yjsBeforeHasContent: yjsHasContent(before),
          yjsAfterHasContent: yjsHasContent(after),
        }),
      ).toBe(false);
    });

    it('allows empty Yjs when incoming editorStateJson has content', () => {
      expect(
        evaluateDestructiveEmptyRejection({
          documentEditorStateJson: NON_EMPTY_LEXICAL,
          documentPreviewContent: null,
          yjsBeforeHasContent: true,
          yjsAfterHasContent: false,
          incomingEditorStateJson: NON_EMPTY_LEXICAL,
        }),
      ).toBe(false);
    });
  });
});
