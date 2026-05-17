import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import { ActionIcon, Badge, Button, Group, Text, Tooltip } from '@mantine/core';
import {
  IconDownload,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFile,
  IconFileSpreadsheet,
  IconFileText,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconTrash,
} from '@tabler/icons-react';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  SELECTION_CHANGE_COMMAND,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { notifications } from '@mantine/notifications';
import { FileAttachmentPdfPreview } from '../FileAttachmentPdfPreview';
import { useDocumentEditorCanEdit } from '../DocumentEditorCapabilitiesContext';
import {
  applyFileAttachmentLayoutClasses,
  FILE_ATTACHMENT_LAYOUT_UPDATE_TAG,
  getFileAttachmentWrapClassName,
  sanitizeFileAttachmentAlign,
  sanitizeFileAttachmentWidthPreset,
  type FileAttachmentLayoutAlign,
  type FileAttachmentWidthPreset,
} from '../fileAttachmentLayout';
import {
  FILE_ATTACHMENT_SELECTION_GUARD_TAG,
  getActiveFileAttachmentKey,
  isFileAttachmentActionTarget,
  persistFileAttachmentSelection,
  subscribeActiveFileAttachmentKey,
  $selectFileAttachmentNode,
} from '../fileAttachmentSelection';
import {
  formatFileSize,
  getFileTypeLabel,
  sanitizeFileDisplayName,
} from '../fileAttachmentUtils';
import {
  downloadAuthenticatedMedia,
  openAuthenticatedMediaInNewTab,
} from '../../utils/authenticated-media-blob';

export type SerializedFileAttachmentNode = Spread<
  {
    type: 'file-attachment';
    version: 1 | 2;
    src: string;
    fileName: string;
    mimeType: string;
    size: number;
    align?: FileAttachmentLayoutAlign;
    widthPreset?: FileAttachmentWidthPreset;
    previewOpen?: boolean;
  },
  SerializedLexicalNode
>;

function fileTypeIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return IconFileTypePdf;
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return IconFileTypeDoc;
  }
  if (mimeType === 'text/csv') return IconFileSpreadsheet;
  if (mimeType === 'text/plain') return IconFileText;
  return IconFile;
}

type FileAttachmentCardProps = {
  nodeKey: NodeKey;
  layoutAlign: FileAttachmentLayoutAlign;
  widthPreset: FileAttachmentWidthPreset;
};

function FileAttachmentCard({ nodeKey, layoutAlign, widthPreset }: FileAttachmentCardProps) {
  const [editor] = useLexicalComposerContext();
  const canEdit = useDocumentEditorCanEdit();
  const [busy, setBusy] = useState<'open' | 'download' | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [layoutState, setLayoutState] = useState<{
    align: FileAttachmentLayoutAlign;
    widthPreset: FileAttachmentWidthPreset;
  }>({ align: 'left', widthPreset: 'normal' });
  const [payload, setPayload] = useState<{
    src: string;
    fileName: string;
    mimeType: string;
    size: number;
  } | null>(null);

  const syncFromEditor = useCallback(() => {
    editor.getEditorState().read(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isFileAttachmentNode(node)) {
        setPayload(null);
        return;
      }
      setPayload({
        src: node.__src,
        fileName: node.__fileName,
        mimeType: node.__mimeType,
        size: node.__size,
      });
      setLayoutState({
        align: node.getLayoutAlign(),
        widthPreset: node.getWidthPreset(),
      });
    });
  }, [editor, nodeKey]);

  const selectNode = useCallback(() => {
    persistFileAttachmentSelection(editor, nodeKey);
  }, [editor, nodeKey]);

  const refreshSelectedState = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      const selected =
        ($isNodeSelection(selection) &&
          selection.getNodes().some((n) => n.getKey() === nodeKey)) ||
        getActiveFileAttachmentKey() === nodeKey;
      setIsSelected(selected);
    });
  }, [editor, nodeKey]);

  useEffect(() => {
    syncFromEditor();
    refreshSelectedState();
    return mergeRegister(
      editor.registerUpdateListener(() => {
        syncFromEditor();
        refreshSelectedState();
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          refreshSelectedState();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      subscribeActiveFileAttachmentKey(() => {
        refreshSelectedState();
      }),
    );
  }, [editor, nodeKey, refreshSelectedState, syncFromEditor]);

  useEffect(() => {
    if (!canEdit) return undefined;
    return editor.registerUpdateListener((updatePayload) => {
      const tags = updatePayload.tags ?? new Set<string>();
      if (tags.has(FILE_ATTACHMENT_SELECTION_GUARD_TAG)) return;
      if (tags.has(FILE_ATTACHMENT_LAYOUT_UPDATE_TAG)) return;
      if (getActiveFileAttachmentKey() !== nodeKey) return;

      const skipRestore = editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isNodeSelection(selection) && selection.has(nodeKey)) return true;
        if ($isRangeSelection(selection)) return true;
        return false;
      });
      if (skipRestore) return;

      queueMicrotask(() => {
        if (getActiveFileAttachmentKey() !== nodeKey) return;
        editor.update(
          () => {
            if (getActiveFileAttachmentKey() !== nodeKey) return;
            const selection = $getSelection();
            if ($isNodeSelection(selection) && selection.has(nodeKey)) return;
            if ($isRangeSelection(selection)) return;
            $selectFileAttachmentNode(nodeKey);
          },
          { tag: FILE_ATTACHMENT_SELECTION_GUARD_TAG },
        );
      });
    });
  }, [canEdit, editor, nodeKey]);

  useEffect(() => {
    if (!previewOpen) return;
    selectNode();
  }, [previewOpen, selectNode]);

  useEffect(() => {
    setLayoutState({ align: layoutAlign, widthPreset });
  }, [layoutAlign, widthPreset]);

  if (!payload?.src) {
    return (
      <div className="flowdocs-file-attachment flowdocs-file-attachment--invalid">
        <Text size="sm" c="dimmed">
          Dosya eklenemedi
        </Text>
      </div>
    );
  }

  const displayName = sanitizeFileDisplayName(payload.fileName);
  const typeLabel = getFileTypeLabel(payload.mimeType);
  const sizeLabel = formatFileSize(payload.size);
  const FileIcon = fileTypeIcon(payload.mimeType);
  const isPdf = payload.mimeType === 'application/pdf';
  const wrapClassName = getFileAttachmentWrapClassName(
    layoutState.align,
    layoutState.widthPreset,
    isSelected ? 'flowdocs-file-attachment-wrap--selected' : undefined,
  );

  const handleOpen = async () => {
    setBusy('open');
    try {
      await openAuthenticatedMediaInNewTab(payload.src);
    } catch {
      notifications.show({
        title: 'Dosya açılamadı',
        message: 'Dosyayı yeni sekmede açarken bir hata oluştu.',
        color: 'red',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    setBusy('download');
    try {
      await downloadAuthenticatedMedia(payload.src, displayName);
    } catch {
      notifications.show({
        title: 'İndirme başarısız',
        message: 'Dosya indirilemedi.',
        color: 'red',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isFileAttachmentNode(node)) {
        node.remove();
      }
    });
  };

  return (
    <div
      className={wrapClassName}
      data-flowdocs-file-attachment
      data-flowdocs-file-attachment-key={nodeKey}
      data-flowdocs-file-attachment-selected={isSelected ? 'true' : undefined}
      data-flowdocs-file-attachment-align={layoutState.align}
      data-flowdocs-file-attachment-width={layoutState.widthPreset}
      onMouseDownCapture={(e) => {
        if (e.button !== 0) return;
        if (isFileAttachmentActionTarget(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        selectNode();
      }}
    >
      <div
        className={`flowdocs-file-attachment${previewOpen ? ' flowdocs-file-attachment--preview-open' : ''}${isSelected ? ' flowdocs-file-attachment--selected' : ''}`}
        role="group"
        aria-label={`Dosya eki: ${displayName}`}
      >
        <div className="flowdocs-file-attachment__icon" aria-hidden>
          <FileIcon size={26} stroke={1.6} />
        </div>
        <div className="flowdocs-file-attachment__body">
          <Text className="flowdocs-file-attachment__name" title={displayName}>
            {displayName}
          </Text>
          <Group gap={6} wrap="nowrap" className="flowdocs-file-attachment__meta">
            <Badge size="xs" variant="light" className="flowdocs-file-attachment__badge">
              {typeLabel}
            </Badge>
            <Text size="xs" c="dimmed" className="flowdocs-file-attachment__size">
              {sizeLabel}
            </Text>
          </Group>
        </div>
        <Group gap={6} wrap="nowrap" className="flowdocs-file-attachment__actions">
          {isPdf ? (
            <Button
              type="button"
              size="compact-xs"
              variant={previewOpen ? 'filled' : 'light'}
              color={previewOpen ? 'blue' : undefined}
              leftSection={previewOpen ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setPreviewOpen((open) => !open)}
            >
              {previewOpen ? 'Önizlemeyi kapat' : 'Önizle'}
            </Button>
          ) : null}
          <Button
            type="button"
            size="compact-xs"
            variant="light"
            leftSection={<IconExternalLink size={14} />}
            loading={busy === 'open'}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => void handleOpen()}
          >
            Aç
          </Button>
          <Button
            type="button"
            size="compact-xs"
            variant="default"
            leftSection={<IconDownload size={14} />}
            loading={busy === 'download'}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => void handleDownload()}
          >
            İndir
          </Button>
          {canEdit ? (
            <Tooltip label="Dosyayı kaldır" withArrow position="top">
              <ActionIcon
                type="button"
                className="flowdocs-file-attachment__delete"
                size="sm"
                variant="light"
                color="red"
                aria-label="Dosyayı kaldır"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleDelete}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Group>
      </div>
      {isPdf && previewOpen ? (
        <FileAttachmentPdfPreview
          src={payload.src}
          fileName={displayName}
          onClose={() => setPreviewOpen(false)}
          onSelectBlock={selectNode}
        />
      ) : null}
    </div>
  );
}

export class FileAttachmentNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __fileName: string;
  __mimeType: string;
  __size: number;
  __align: FileAttachmentLayoutAlign;
  __widthPreset: FileAttachmentWidthPreset;

  static getType(): string {
    return 'file-attachment';
  }

  static clone(node: FileAttachmentNode): FileAttachmentNode {
    return new FileAttachmentNode(
      node.__src,
      node.__fileName,
      node.__mimeType,
      node.__size,
      node.__align,
      node.__widthPreset,
      node.__key,
    );
  }

  afterCloneFrom(prevNode: this): void {
    super.afterCloneFrom(prevNode);
    this.__align = prevNode.__align;
    this.__widthPreset = prevNode.__widthPreset;
  }

  static importJSON(serializedNode: SerializedFileAttachmentNode): FileAttachmentNode {
    const src = typeof serializedNode.src === 'string' ? serializedNode.src.trim() : '';
    const fileName =
      typeof serializedNode.fileName === 'string'
        ? sanitizeFileDisplayName(serializedNode.fileName)
        : 'dosya';
    const mimeType =
      typeof serializedNode.mimeType === 'string' ? serializedNode.mimeType.trim() : '';
    const size =
      typeof serializedNode.size === 'number' && Number.isFinite(serializedNode.size)
        ? Math.max(0, Math.round(serializedNode.size))
        : 0;
    return new FileAttachmentNode(
      src,
      fileName,
      mimeType,
      size,
      sanitizeFileAttachmentAlign(serializedNode.align),
      sanitizeFileAttachmentWidthPreset(serializedNode.widthPreset),
    );
  }

  constructor(
    src: string,
    fileName: string,
    mimeType: string,
    size: number,
    align: FileAttachmentLayoutAlign = 'left',
    widthPreset: FileAttachmentWidthPreset = 'normal',
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__fileName = sanitizeFileDisplayName(fileName);
    this.__mimeType = mimeType;
    this.__size = size;
    this.__align = sanitizeFileAttachmentAlign(align);
    this.__widthPreset = sanitizeFileAttachmentWidthPreset(widthPreset);
  }

  exportJSON(): SerializedFileAttachmentNode {
    return {
      ...super.exportJSON(),
      type: 'file-attachment',
      version: 2,
      src: this.__src,
      fileName: this.__fileName,
      mimeType: this.__mimeType,
      size: this.__size,
      align: this.__align,
      widthPreset: this.__widthPreset,
    };
  }

  getLayoutAlign(): FileAttachmentLayoutAlign {
    return this.getLatest().__align;
  }

  getWidthPreset(): FileAttachmentWidthPreset {
    return this.getLatest().__widthPreset;
  }

  setLayoutAlign(align: FileAttachmentLayoutAlign): this {
    const self = this.getWritable();
    self.__align = sanitizeFileAttachmentAlign(align);
    return self;
  }

  setWidthPreset(preset: FileAttachmentWidthPreset): this {
    const self = this.getWritable();
    self.__widthPreset = sanitizeFileAttachmentWidthPreset(preset);
    return self;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    element.className = 'flowdocs-file-attachment-node';
    applyFileAttachmentLayoutClasses(element, this.getLayoutAlign(), this.getWidthPreset());
    const theme = config.theme as { fileAttachment?: string };
    if (theme.fileAttachment) {
      element.classList.add(theme.fileAttachment);
    }
    return element;
  }

  updateDOM(prevNode: FileAttachmentNode, dom: HTMLElement): boolean {
    const layoutAlign = this.getLayoutAlign();
    const widthPreset = this.getWidthPreset();
    if (
      prevNode &&
      layoutAlign === prevNode.getLayoutAlign() &&
      widthPreset === prevNode.getWidthPreset()
    ) {
      return true;
    }
    applyFileAttachmentLayoutClasses(dom, layoutAlign, widthPreset);
    const wrap = dom.querySelector('.flowdocs-file-attachment-wrap');
    if (wrap instanceof HTMLElement) {
      applyFileAttachmentLayoutClasses(wrap, layoutAlign, widthPreset);
    }
    return true;
  }

  isInline(): false {
    return false;
  }

  decorate(): JSX.Element {
    const self = this.getLatest();
    return (
      <FileAttachmentCard
        nodeKey={self.getKey()}
        layoutAlign={self.getLayoutAlign()}
        widthPreset={self.getWidthPreset()}
      />
    );
  }
}

export function $createFileAttachmentNode(
  src: string,
  fileName: string,
  mimeType: string,
  size: number,
  align: FileAttachmentLayoutAlign = 'left',
  widthPreset: FileAttachmentWidthPreset = 'normal',
): FileAttachmentNode {
  return new FileAttachmentNode(src, fileName, mimeType, size, align, widthPreset);
}

export function $isFileAttachmentNode(
  node: LexicalNode | null | undefined,
): node is FileAttachmentNode {
  if (node instanceof FileAttachmentNode) return true;
  return (
    node !== null &&
    node !== undefined &&
    typeof node === 'object' &&
    'getType' in node &&
    typeof node.getType === 'function' &&
    node.getType() === 'file-attachment'
  );
}

export function $selectFileAttachmentNodeIfPresent(key: NodeKey): boolean {
  const node = $getNodeByKey(key);
  if (!$isFileAttachmentNode(node)) return false;
  return $selectFileAttachmentNode(key);
}
