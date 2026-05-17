import type {
  ExportBlock,
  ExportDocument,
  ExportInline,
  ExportLayoutAlign,
  ExportTextAlign,
  ExportWidthPreset,
} from './lexical-export.types';
import { sanitizeCssColor } from './lexical-export.sanitize';

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_STRIKETHROUGH = 4;
const FORMAT_UNDERLINE = 8;
const FORMAT_CODE = 16;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeExportFilename(title: string, extension: string): string {
  const base =
    title
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'flowdocs-document';
  return `${base}.${extension}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const rounded = size >= 10 || unitIndex === 0 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
}

export function getFileTypeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/webp': 'WEBP',
  };
  return map[mimeType] ?? mimeType.split('/').pop()?.toUpperCase() ?? 'FILE';
}

export function parseMediaIdFromSrc(src: string, documentId: string): string | null {
  if (!src?.trim()) return null;
  const patterns = [
    new RegExp(`/documents/${documentId}/media/([^/?#]+)/file`, 'i'),
    /\/media\/([^/?#]+)\/file/i,
  ];
  for (const pattern of patterns) {
    const match = src.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function parseLexicalRoot(editorStateJson: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(editorStateJson) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (record.root && typeof record.root === 'object') {
      return record.root as Record<string, unknown>;
    }
    if (record.editorState && typeof record.editorState === 'object') {
      const inner = record.editorState as Record<string, unknown>;
      if (inner.root && typeof inner.root === 'object') {
        return inner.root as Record<string, unknown>;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function parseStyleColors(style: unknown): { color?: string; backgroundColor?: string } {
  if (typeof style !== 'string' || !style.trim()) return {};
  const colorMatch = style.match(/(?:^|;)\s*color:\s*([^;]+)/i);
  const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/i);
  return {
    color: colorMatch?.[1]?.trim(),
    backgroundColor: bgMatch?.[1]?.trim(),
  };
}

function readTextInlines(node: Record<string, unknown>): ExportInline[] {
  const format = typeof node.format === 'number' ? node.format : 0;
  const { color, backgroundColor } = parseStyleColors(node.style);
  const text = typeof node.text === 'string' ? node.text : '';
  if (!text) return [];
  return [
    {
      text,
      bold: (format & FORMAT_BOLD) !== 0,
      italic: (format & FORMAT_ITALIC) !== 0,
      strikethrough: (format & FORMAT_STRIKETHROUGH) !== 0,
      underline: (format & FORMAT_UNDERLINE) !== 0,
      code: (format & FORMAT_CODE) !== 0,
      color,
      backgroundColor,
    },
  ];
}

function collectInlines(node: Record<string, unknown>): ExportInline[] {
  const type = typeof node.type === 'string' ? node.type : '';
  if (type === 'text') {
    return readTextInlines(node);
  }
  if (type === 'linebreak') {
    return [{ text: '\n' }];
  }
  if (type === 'link' || type === 'autolink') {
    const url =
      typeof node.url === 'string'
        ? node.url
        : typeof node.href === 'string'
          ? node.href
          : undefined;
    const children = Array.isArray(node.children) ? node.children : [];
    return children.flatMap((child) => {
      if (!child || typeof child !== 'object') return [];
      const inlines = collectInlines(child as Record<string, unknown>);
      return inlines.map((inline) => ({ ...inline, link: url ?? inline.link }));
    });
  }
  const children = Array.isArray(node.children) ? node.children : [];
  return children.flatMap((child) =>
    child && typeof child === 'object'
      ? collectInlines(child as Record<string, unknown>)
      : [],
  );
}

function parseTextAlign(node: Record<string, unknown>): ExportTextAlign | undefined {
  const format = node.format;
  if (format === 'center' || format === 'right' || format === 'justify') {
    return format;
  }
  if (format === 'left' || format === 'start' || format === '') {
    return 'left';
  }
  return undefined;
}

function buildCodeHighlightHtml(node: Record<string, unknown>): string {
  const text = typeof node.text === 'string' ? node.text : '';
  if (!text) return '';
  const escaped = escapeHtml(text);
  const { color } = parseStyleColors(node.style);
  const safeColor = sanitizeCssColor(color);
  if (safeColor) {
    return `<span class="flowdocs-code-highlight" style="color:${safeColor}">${escaped}</span>`;
  }
  return escaped;
}

function parseCodeBlock(node: Record<string, unknown>): ExportBlock {
  const children = Array.isArray(node.children) ? node.children : [];
  const codeParts: string[] = [];
  const htmlParts: string[] = [];

  for (const child of children) {
    if (!child || typeof child !== 'object') continue;
    const record = child as Record<string, unknown>;
    if (record.type === 'code-highlight' || record.type === 'text') {
      const text = typeof record.text === 'string' ? record.text : '';
      codeParts.push(text);
      htmlParts.push(
        record.type === 'code-highlight' ? buildCodeHighlightHtml(record) : escapeHtml(text),
      );
    }
  }

  const code = codeParts.join('');
  const codeHtml = htmlParts.join('');
  return {
    type: 'code',
    code,
    codeHtml: codeHtml.length > 0 ? codeHtml : undefined,
  };
}

function sanitizeLayoutAlign(value: unknown): ExportLayoutAlign {
  return value === 'center' || value === 'right' ? value : 'left';
}

function sanitizeWidthPreset(value: unknown): ExportWidthPreset {
  if (value === 'narrow' || value === 'wide' || value === 'full') return value;
  return 'normal';
}

function parseTable(node: Record<string, unknown>): ExportBlock {
  const children = Array.isArray(node.children) ? node.children : [];
  const rows: ExportInline[][][] = [];
  for (const rowNode of children) {
    if (!rowNode || typeof rowNode !== 'object') continue;
    const row = rowNode as Record<string, unknown>;
    if (row.type !== 'tablerow') continue;
    const rowCells: ExportInline[][] = [];
    const cells = Array.isArray(row.children) ? row.children : [];
    for (const cellNode of cells) {
      if (!cellNode || typeof cellNode !== 'object') continue;
      const cell = cellNode as Record<string, unknown>;
      if (cell.type !== 'tablecell') continue;
      rowCells.push(collectInlines(cell));
    }
    if (rowCells.length > 0) rows.push(rowCells);
  }
  return {
    type: 'table',
    rows,
    layoutAlign: sanitizeLayoutAlign(node.layoutAlign),
    widthPreset: sanitizeWidthPreset(node.widthPreset),
  };
}

function parseList(node: Record<string, unknown>): ExportBlock {
  const listType = typeof node.listType === 'string' ? node.listType : 'bullet';
  const items: ExportInline[][] = [];
  const children = Array.isArray(node.children) ? node.children : [];
  for (const itemNode of children) {
    if (!itemNode || typeof itemNode !== 'object') continue;
    const item = itemNode as Record<string, unknown>;
    if (item.type !== 'listitem') continue;
    items.push(collectInlines(item));
  }
  return { type: 'list', ordered: listType === 'number', items };
}

function parseBlock(node: Record<string, unknown>, documentId: string): ExportBlock | null {
  const type = typeof node.type === 'string' ? node.type : '';
  if (type === 'paragraph') {
    return {
      type: 'paragraph',
      inlines: collectInlines(node),
      textAlign: parseTextAlign(node),
    };
  }
  if (type === 'heading') {
    const tag = typeof node.tag === 'string' ? node.tag : 'h1';
    const level = Number.parseInt(tag.replace('h', ''), 10);
    return {
      type: 'heading',
      level: Number.isFinite(level) ? Math.min(6, Math.max(1, level)) : 1,
      inlines: collectInlines(node),
      textAlign: parseTextAlign(node),
    };
  }
  if (type === 'list') return parseList(node);
  if (type === 'code') return parseCodeBlock(node);
  if (type === 'table') return parseTable(node);
  if (type === 'image') {
    const src = typeof node.src === 'string' ? node.src : '';
    return {
      type: 'image',
      altText: typeof node.altText === 'string' ? node.altText : '',
      mediaId: parseMediaIdFromSrc(src, documentId),
      width: typeof node.width === 'string' ? node.width : undefined,
      align: sanitizeLayoutAlign(node.align),
    };
  }
  if (type === 'file-attachment') {
    const src = typeof node.src === 'string' ? node.src : '';
    return {
      type: 'file-attachment',
      fileName: typeof node.fileName === 'string' ? node.fileName : 'dosya',
      mimeType: typeof node.mimeType === 'string' ? node.mimeType : 'application/octet-stream',
      size: typeof node.size === 'number' ? node.size : 0,
      mediaId: parseMediaIdFromSrc(src, documentId),
      align: sanitizeLayoutAlign(node.align),
      widthPreset: sanitizeWidthPreset(node.widthPreset),
    };
  }
  return null;
}

export function parseLexicalEditorState(
  editorStateJson: string,
  title: string,
  documentId: string,
): ExportDocument {
  const root = parseLexicalRoot(editorStateJson);
  const blocks: ExportBlock[] = [];
  if (!root) {
    return { title, blocks };
  }
  const children = Array.isArray(root.children) ? root.children : [];
  for (const child of children) {
    if (!child || typeof child !== 'object') continue;
    const block = parseBlock(child as Record<string, unknown>, documentId);
    if (block) blocks.push(block);
  }
  return { title, blocks };
}
