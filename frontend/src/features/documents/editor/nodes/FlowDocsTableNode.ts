import type { EditorConfig, LexicalEditor, LexicalUpdateJSON, NodeKey } from 'lexical';
import { $nodesOfType } from 'lexical';
import {
  TableNode,
  type SerializedTableNode,
  type TableNode as TableNodeType,
} from '@lexical/table';

export type TableLayoutAlign = 'left' | 'center' | 'right';
export type TableWidthPreset = 'narrow' | 'normal' | 'wide' | 'full';

export type SerializedFlowDocsTableNode = SerializedTableNode & {
  layoutAlign?: TableLayoutAlign;
  widthPreset?: TableWidthPreset;
};

export const TABLE_ALIGN_CLASSES = [
  'flowdocs-table-align-left',
  'flowdocs-table-align-center',
  'flowdocs-table-align-right',
] as const;

export const TABLE_WIDTH_CLASSES = [
  'flowdocs-table-width-narrow',
  'flowdocs-table-width-normal',
  'flowdocs-table-width-wide',
  'flowdocs-table-width-full',
] as const;

function applyLayoutClassesToWrapper(
  tableWrapper: HTMLDivElement,
  layoutAlign: TableLayoutAlign,
  widthPreset: TableWidthPreset,
): void {
  tableWrapper.classList.remove(...TABLE_ALIGN_CLASSES, ...TABLE_WIDTH_CLASSES);
  tableWrapper.classList.add(`flowdocs-table-align-${layoutAlign}`);
  tableWrapper.classList.add(`flowdocs-table-width-${widthPreset}`);
  tableWrapper.dataset.flowdocsTableAlign = layoutAlign;
  tableWrapper.dataset.flowdocsTableWidth = widthPreset;
}

/** @noInheritDoc */
export class FlowDocsTableNode extends TableNode {
  __layoutAlign: TableLayoutAlign;
  __widthPreset: TableWidthPreset;

  constructor(
    widthPreset: TableWidthPreset = 'normal',
    layoutAlign: TableLayoutAlign = 'left',
    key?: NodeKey,
  ) {
    super(key);
    this.__layoutAlign = layoutAlign;
    this.__widthPreset = widthPreset;
  }

  static getType(): string {
    return 'table';
  }

  static clone(node: FlowDocsTableNode): FlowDocsTableNode {
    return new FlowDocsTableNode(node.__widthPreset, node.__layoutAlign, node.__key);
  }

  afterCloneFrom(prevNode: this): void {
    super.afterCloneFrom(prevNode);
    this.__layoutAlign = prevNode.__layoutAlign;
    this.__widthPreset = prevNode.__widthPreset;
  }

  static importJSON(serialized: SerializedFlowDocsTableNode): FlowDocsTableNode {
    return $createFlowDocsTableNode(
      serialized.widthPreset ?? 'normal',
      serialized.layoutAlign ?? 'left',
    ).updateFromJSON(serialized);
  }

  updateFromJSON(serialized: LexicalUpdateJSON<SerializedFlowDocsTableNode>): this {
    const self = super.updateFromJSON(serialized);
    self.__layoutAlign = serialized.layoutAlign ?? 'left';
    self.__widthPreset = serialized.widthPreset ?? 'normal';
    return self;
  }

  exportJSON(): SerializedFlowDocsTableNode {
    return {
      ...super.exportJSON(),
      layoutAlign: this.__layoutAlign,
      widthPreset: this.__widthPreset,
    };
  }

  getLayoutAlign(): TableLayoutAlign {
    return this.getLatest().__layoutAlign;
  }

  getWidthPreset(): TableWidthPreset {
    return this.getLatest().__widthPreset;
  }

  setLayoutAlign(align: TableLayoutAlign): this {
    const self = this.getWritable();
    self.__layoutAlign = align;
    return self;
  }

  setWidthPreset(preset: TableWidthPreset): this {
    const self = this.getWritable();
    self.__widthPreset = preset;
    return self;
  }

  updateTableWrapper(
    prevNode: this | null,
    tableWrapper: HTMLDivElement,
    tableElement: HTMLTableElement,
    config: EditorConfig,
  ): void {
    super.updateTableWrapper(prevNode, tableWrapper, tableElement, config);
    const layoutAlign = this.getLayoutAlign();
    const widthPreset = this.getWidthPreset();
    const prevAlign = prevNode?.getLayoutAlign();
    const prevWidth = prevNode?.getWidthPreset();
    if (!prevNode || layoutAlign !== prevAlign || widthPreset !== prevWidth) {
      applyLayoutClassesToWrapper(tableWrapper, layoutAlign, widthPreset);
    }
  }
}

export function $createFlowDocsTableNode(
  widthPreset: TableWidthPreset = 'normal',
  layoutAlign: TableLayoutAlign = 'left',
): FlowDocsTableNode {
  return new FlowDocsTableNode(widthPreset, layoutAlign);
}

export function $isFlowDocsTableNode(
  node: TableNodeType | FlowDocsTableNode | null | undefined,
): node is FlowDocsTableNode {
  return node instanceof FlowDocsTableNode;
}

export function syncTableWrapperLayout(
  editor: LexicalEditor,
  tableNode: FlowDocsTableNode,
): void {
  const tableElement = editor.getElementByKey(tableNode.getKey());
  if (!tableElement) return;

  const wrapper = tableElement.closest('.flowdocs-table-scroll');
  if (!(wrapper instanceof HTMLDivElement)) return;

  applyLayoutClassesToWrapper(
    wrapper,
    tableNode.getLayoutAlign(),
    tableNode.getWidthPreset(),
  );
}

export function syncAllTableWrapperLayouts(editor: LexicalEditor): void {
  editor.getEditorState().read(() => {
    for (const table of $nodesOfType(FlowDocsTableNode)) {
      syncTableWrapperLayout(editor, table);
    }
  });
}
