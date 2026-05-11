export const FLOWDOCS_IMAGE_DRAG_MIME = 'application/x-flowdocs-image';

let activeImageDragKey: string | null = null;

export function setFlowdocsImageDragActiveKey(key: string | null): void {
  activeImageDragKey = key;
}

export function getFlowdocsImageDragActiveKey(): string | null {
  return activeImageDragKey;
}
