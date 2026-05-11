import type { SerializedImageNode } from './nodes/ImageNode';

let flowdocsImageClipboard: SerializedImageNode | null = null;

export function setFlowdocsImageClipboard(data: SerializedImageNode | null): void {
  flowdocsImageClipboard = data;
}

export function getFlowdocsImageClipboard(): SerializedImageNode | null {
  return flowdocsImageClipboard;
}
