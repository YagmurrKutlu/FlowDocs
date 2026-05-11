import {
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
} from 'lexical';
import { ImageNode, type SerializedImageNode } from './nodes/ImageNode';

/** Inserts a cloned image and returns the live node (caller may apply NodeSelection). */
export function $insertClonedImageFromSerialized(payload: SerializedImageNode): ImageNode {
  const image = ImageNode.importJSON(payload);
  const sel = $getSelection();
  if ($isRangeSelection(sel)) {
    sel.insertNodes([image]);
    return image;
  }
  if ($isNodeSelection(sel)) {
    const nodes = sel.getNodes();
    const last = nodes[nodes.length - 1];
    if (last) {
      last.insertAfter(image);
      return image;
    }
  }
  $getRoot().append(image);
  return image;
}
