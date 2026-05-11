import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getRoot,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { $isImageNode, $selectImageNodeIfPresent } from './nodes/ImageNode';

export type ImageDropPlacement = {
  referenceKey: string;
  insertBefore: boolean;
};

/** Drop indicator in viewport coordinates (thin line inside editor root). */
export type ImageDropIndicator = {
  top: number;
  left: number;
  width: number;
};

function $rootChildOfNode(root: ReturnType<typeof $getRoot>, node: LexicalNode): LexicalNode | null {
  let n: LexicalNode = node;
  while (n.getParent() !== null && n.getParent() !== root) {
    const p = n.getParent();
    if (p === null) return null;
    n = p;
  }
  return n.getParent() === root ? n : null;
}

/**
 * When the pointer only hits the dragged image, pick a root sibling by Y using gaps between blocks.
 */
function $pickPlacementFromRootGaps(
  editor: LexicalEditor,
  root: ReturnType<typeof $getRoot>,
  clientY: number,
  draggedImageKey: string,
): { block: LexicalNode; insertBefore: boolean } | null {
  const children = root.getChildren();
  type Item = { node: LexicalNode; top: number; bottom: number; mid: number };
  const items: Item[] = [];
  for (const child of children) {
    const el = editor.getElementByKey(child.getKey());
    if (!el || !(el instanceof HTMLElement)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) continue;
    items.push({
      node: child,
      top: r.top,
      bottom: r.bottom,
      mid: r.top + r.height / 2,
    });
  }
  if (items.length === 0) return null;
  if (items.length === 1 && items[0]!.node.getKey() === draggedImageKey) return null;

  const y = clientY;

  const chooseRef = (
    block: LexicalNode,
    insertBefore: boolean,
  ): { block: LexicalNode; insertBefore: boolean } | null => {
    if (block.getKey() !== draggedImageKey) {
      return { block, insertBefore };
    }
    const idx = items.findIndex((i) => i.node.getKey() === draggedImageKey);
    if (idx < 0) return null;
    if (insertBefore) {
      if (idx > 0) return { block: items[idx - 1]!.node, insertBefore: false };
      if (idx < items.length - 1) return { block: items[idx + 1]!.node, insertBefore: true };
    } else {
      if (idx < items.length - 1) return { block: items[idx + 1]!.node, insertBefore: true };
      if (idx > 0) return { block: items[idx - 1]!.node, insertBefore: false };
    }
    return null;
  };

  if (y < items[0]!.mid) {
    return chooseRef(items[0]!.node, true);
  }

  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i]!;
    const b = items[i + 1]!;
    if (y < b.mid) {
      const gapMid = (a.bottom + b.top) / 2;
      if (y < gapMid) {
        return chooseRef(a.node, false);
      }
      return chooseRef(b.node, true);
    }
  }

  return chooseRef(items[items.length - 1]!.node, false);
}

function indicatorLine(rootEl: HTMLElement, lineCenterY: number): ImageDropIndicator {
  const rr = rootEl.getBoundingClientRect();
  const inset = 28;
  return {
    top: lineCenterY - 1,
    left: rr.left + inset,
    width: Math.max(40, rr.width - inset * 2),
  };
}

export function $resolveImageDropPlacement(
  editor: LexicalEditor,
  clientX: number,
  clientY: number,
  draggedImageKey: string,
): { placement: ImageDropPlacement; indicator: ImageDropIndicator } | null {
  return editor.getEditorState().read(() => {
    const root = $getRoot();
    const rootEl = editor.getRootElement();
    if (!rootEl) return null;

    const img = $getNodeByKey(draggedImageKey);
    if (!$isImageNode(img)) return null;

    const stack = document.elementsFromPoint(clientX, clientY);
    let targetBlock: LexicalNode | null = null;

    for (const domNode of stack) {
      if (!(domNode instanceof HTMLElement)) continue;
      if (!rootEl.contains(domNode)) continue;
      if (domNode.closest('[data-flowdocs-drop-indicator]')) continue;
      if (domNode.closest('[data-flowdocs-image-toolbar]')) continue;
      if (domNode.closest('[data-flowdocs-image-resize-handle]')) continue;

      let nearest: LexicalNode | null;
      try {
        nearest = $getNearestNodeFromDOMNode(domNode);
      } catch {
        continue;
      }
      if (nearest === null) continue;

      const block = $rootChildOfNode(root, nearest);
      if (!block) continue;
      if ($isImageNode(block) && block.getKey() === draggedImageKey) {
        continue;
      }
      targetBlock = block;
      break;
    }

    let insertBefore: boolean;
    if (!targetBlock) {
      const gap = $pickPlacementFromRootGaps(editor, root, clientY, draggedImageKey);
      if (!gap) return null;
      targetBlock = gap.block;
      insertBefore = gap.insertBefore;
    } else {
      const el = editor.getElementByKey(targetBlock.getKey());
      if (!el || !(el instanceof HTMLElement)) return null;
      const r = el.getBoundingClientRect();
      insertBefore = clientY < r.top + r.height / 2;
    }

    if (targetBlock.getKey() === draggedImageKey) {
      return null;
    }

    const targetEl = editor.getElementByKey(targetBlock.getKey());
    if (!targetEl || !(targetEl instanceof HTMLElement)) return null;
    const tr = targetEl.getBoundingClientRect();
    const lineY = insertBefore ? tr.top - 2 : tr.bottom + 2;

    return {
      placement: {
        referenceKey: targetBlock.getKey(),
        insertBefore,
      },
      indicator: indicatorLine(rootEl, lineY),
    };
  });
}

/** Returns false if the image is already in the requested position (no-op). */
export function $applyImageDropPlacement(
  editor: LexicalEditor,
  draggedImageKey: string,
  placement: ImageDropPlacement,
): boolean {
  if (placement.referenceKey === draggedImageKey) {
    return false;
  }

  let moved = false;
  editor.update(() => {
    const root = $getRoot();
    const img = $getNodeByKey(draggedImageKey);
    const ref = $getNodeByKey(placement.referenceKey);
    if (!$isImageNode(img) || !ref) return;
    if (ref.getKey() === img.getKey()) return;
    if (ref.getParent() !== root || img.getParent() !== root) return;

    const refKey = ref.getKey();
    const imgKey = img.getKey();
    const childKeys = root.getChildren().map((c) => c.getKey());
    const idxImg = childKeys.indexOf(imgKey);
    const idxRef = childKeys.indexOf(refKey);
    if (idxImg < 0 || idxRef < 0) return;

    if (placement.insertBefore) {
      if (idxImg === idxRef - 1) return;
    } else {
      if (idxImg === idxRef + 1) return;
    }

    img.remove();
    if (placement.insertBefore) {
      ref.insertBefore(img);
    } else {
      ref.insertAfter(img);
    }
    moved = true;
    $selectImageNodeIfPresent(draggedImageKey);
  });
  return moved;
}
