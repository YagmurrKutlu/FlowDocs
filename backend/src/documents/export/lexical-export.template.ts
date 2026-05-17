import type {
  ExportBlock,
  ExportBuildContext,
  ExportInline,
  ExportLayoutAlign,
  ExportTextAlign,
  ExportWidthPreset,
} from './lexical-export.types';
import { sanitizeCssColor, sanitizeExportHref } from './lexical-export.sanitize';
import {
  escapeHtml,
  formatFileSize,
  getFileTypeLabel,
} from './lexical-export.utils';

export const FLOWDOCS_EXPORT_STYLES = `
@page {
  size: A4;
  margin: 14mm 12mm;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: #e8eaef;
  font-family: "Segoe UI", "Noto Sans", Arial, Helvetica, sans-serif;
  color: #111827;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.flowdocs-export-shell {
  min-height: 100vh;
  padding: 24px 12px 48px;
}

.flowdocs-export-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 72px 86px;
  border-radius: 4px;
  background: #ffffff;
  color: #111827;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
}

.flowdocs-export-meta {
  margin: 0 0 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  font-size: 0.8125rem;
  color: #64748b;
  letter-spacing: 0.01em;
}

.flowdocs-export-title {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.25;
  margin: 0 0 1.5rem;
  color: #0f172a;
}

.flowdocs-export-body {
  font-size: 1rem;
  line-height: 1.65;
}

.flowdocs-export-body > .flowdocs-export-block:first-child {
  margin-top: 0;
}

.flowdocs-export-block {
  margin: 0 0 0.85em;
}

.flowdocs-export-block.is-empty {
  min-height: 1.65em;
}

.flowdocs-export-body p {
  margin: 0 0 0.75em;
  line-height: 1.65;
  font-size: 1rem;
  color: #111827;
}

.flowdocs-export-body p.flowdocs-align-left,
.flowdocs-export-body h1.flowdocs-align-left,
.flowdocs-export-body h2.flowdocs-align-left,
.flowdocs-export-body h3.flowdocs-align-left,
.flowdocs-export-body h4.flowdocs-align-left,
.flowdocs-export-body h5.flowdocs-align-left,
.flowdocs-export-body h6.flowdocs-align-left {
  text-align: left;
}

.flowdocs-export-body p.flowdocs-align-center,
.flowdocs-export-body h1.flowdocs-align-center,
.flowdocs-export-body h2.flowdocs-align-center,
.flowdocs-export-body h3.flowdocs-align-center,
.flowdocs-export-body h4.flowdocs-align-center,
.flowdocs-export-body h5.flowdocs-align-center,
.flowdocs-export-body h6.flowdocs-align-center {
  text-align: center;
}

.flowdocs-export-body p.flowdocs-align-right,
.flowdocs-export-body h1.flowdocs-align-right,
.flowdocs-export-body h2.flowdocs-align-right,
.flowdocs-export-body h3.flowdocs-align-right,
.flowdocs-export-body h4.flowdocs-align-right,
.flowdocs-export-body h5.flowdocs-align-right,
.flowdocs-export-body h6.flowdocs-align-right {
  text-align: right;
}

.flowdocs-export-body p.flowdocs-align-justify,
.flowdocs-export-body h1.flowdocs-align-justify,
.flowdocs-export-body h2.flowdocs-align-justify,
.flowdocs-export-body h3.flowdocs-align-justify {
  text-align: justify;
}

.flowdocs-export-body h1,
.flowdocs-export-body h2,
.flowdocs-export-body h3,
.flowdocs-export-body h4,
.flowdocs-export-body h5,
.flowdocs-export-body h6 {
  line-height: 1.25;
  margin: 1.35em 0 0.55em;
  font-weight: 700;
  color: #0f172a;
}

.flowdocs-export-body h1 { font-size: 2rem; margin-top: 0; }
.flowdocs-export-body h2 { font-size: 1.5rem; }
.flowdocs-export-body h3 { font-size: 1.25rem; }
.flowdocs-export-body h4 { font-size: 1.125rem; }
.flowdocs-export-body h5 { font-size: 1rem; }
.flowdocs-export-body h6 { font-size: 0.9375rem; color: #334155; }

.flowdocs-export-body ul,
.flowdocs-export-body ol {
  margin: 0 0 0.85em 1.35em;
  padding: 0;
  line-height: 1.65;
}

.flowdocs-export-body li {
  margin: 0.28em 0;
}

.flowdocs-export-body strong { font-weight: 700; }
.flowdocs-export-body em { font-style: italic; }
.flowdocs-export-body u { text-decoration: underline; }
.flowdocs-export-body s { text-decoration: line-through; }

.flowdocs-text-code {
  display: inline;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875em;
  font-weight: 450;
  line-height: inherit;
  letter-spacing: -0.02em;
  vertical-align: baseline;
  background: rgba(15, 23, 42, 0.06);
  color: #1e293b;
  border-radius: 3px;
  padding: 0.05em 0.28em;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.flowdocs-link {
  color: #4f6fd8;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: rgba(79, 111, 216, 0.26);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.flowdocs-link:hover {
  color: #3b5ec4;
}

pre.flowdocs-code-block {
  display: block;
  margin: 0;
  padding: 16px 18px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13.5px;
  font-weight: 400;
  line-height: 1.7;
  letter-spacing: 0;
  tab-size: 2;
  color: #e2e8f0;
  background: #0f172a;
  border: 1px solid rgba(51, 65, 85, 0.88);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  white-space: pre-wrap;
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  word-break: normal;
  overflow-wrap: anywhere;
}

pre.flowdocs-code-block code {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  background: transparent;
  padding: 0;
  border-radius: 0;
}

.flowdocs-code-highlight {
  font-family: inherit;
}

.flowdocs-table-wrap {
  margin: 0;
  overflow-x: auto;
  max-width: 100%;
}

.flowdocs-table-wrap.align-left { margin-left: 0; margin-right: auto; }
.flowdocs-table-wrap.align-center { margin-left: auto; margin-right: auto; }
.flowdocs-table-wrap.align-right { margin-left: auto; margin-right: 0; }
.flowdocs-table-wrap.width-narrow { width: min(58%, 420px); }
.flowdocs-table-wrap.width-normal { width: min(78%, 640px); }
.flowdocs-table-wrap.width-wide { width: min(92%, 820px); }
.flowdocs-table-wrap.width-full { width: 100%; }

table.flowdocs-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  background: #ffffff;
  border: 2.5px solid #94a3b8;
  border-radius: 8px;
  box-shadow:
    0 2px 6px rgba(15, 23, 42, 0.07),
    0 0 0 1px rgba(148, 163, 184, 0.28);
  overflow: hidden;
}

.flowdocs-table td {
  min-width: 64px;
  min-height: 36px;
  padding: 8px 12px;
  vertical-align: top;
  border-right: 1.5px solid #cbd5e1;
  border-bottom: 1.5px solid #cbd5e1;
  color: #111827;
  font-size: 0.9375rem;
  line-height: 1.5;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.flowdocs-table tr:last-child td { border-bottom: none; }
.flowdocs-table td:last-child { border-right: none; }

.flowdocs-table tr:first-child td {
  background: rgba(241, 245, 249, 0.65);
  font-weight: 500;
}

.flowdocs-table .flowdocs-empty-cell {
  color: transparent;
  user-select: none;
}

.flowdocs-image-block {
  margin: 0;
  max-width: 100%;
}

.flowdocs-image-block.align-left { text-align: left; }
.flowdocs-image-block.align-center { text-align: center; }
.flowdocs-image-block.align-right { text-align: right; }

.flowdocs-image-block img {
  display: inline-block;
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  vertical-align: top;
}

.flowdocs-file-attachment-wrap {
  margin: 0;
  max-width: 100%;
}

.flowdocs-file-attachment-wrap.align-left { margin-left: 0; margin-right: auto; }
.flowdocs-file-attachment-wrap.align-center { margin-left: auto; margin-right: auto; }
.flowdocs-file-attachment-wrap.align-right { margin-left: auto; margin-right: 0; }
.flowdocs-file-attachment-wrap.width-narrow { width: min(58%, 420px); }
.flowdocs-file-attachment-wrap.width-normal { width: min(78%, 640px); }
.flowdocs-file-attachment-wrap.width-wide { width: min(92%, 820px); }
.flowdocs-file-attachment-wrap.width-full { width: 100%; }

.flowdocs-file-attachment-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
}

.flowdocs-file-attachment-card__icon {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 9px;
  background: rgba(79, 111, 216, 0.1);
  color: #4f6fd8;
  font-size: 1.35rem;
  line-height: 1;
}

.flowdocs-file-attachment-card__body {
  flex: 1 1 auto;
  min-width: 0;
}

.flowdocs-file-attachment-card__name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flowdocs-file-attachment-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.flowdocs-file-attachment-card__badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(79, 111, 216, 0.1);
  color: #4f6fd8;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.flowdocs-file-attachment-card__size {
  font-size: 0.75rem;
  color: #64748b;
}

@media (max-width: 720px) {
  .flowdocs-export-page {
    margin: 0;
    padding: 36px 24px 48px;
    border-radius: 0;
    box-shadow: none;
  }

  .flowdocs-export-shell {
    padding: 0;
    background: #ffffff;
  }
}

@media print {
  html,
  body {
    background: #ffffff;
  }

  .flowdocs-export-shell {
    padding: 0;
    background: #ffffff;
  }

  .flowdocs-export-page {
    max-width: none;
    margin: 0;
    padding: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .flowdocs-export-meta {
    border-bottom-color: rgba(15, 23, 42, 0.12);
  }

  pre.flowdocs-code-block,
  .flowdocs-table-wrap,
  .flowdocs-file-attachment-wrap,
  .flowdocs-image-block {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  table.flowdocs-table {
    page-break-inside: auto;
  }

  .flowdocs-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`;

function inlineStyleAttr(inline: ExportInline): string {
  const styles: string[] = [];
  const color = sanitizeCssColor(inline.color);
  const backgroundColor = sanitizeCssColor(inline.backgroundColor);
  if (color) styles.push(`color:${color}`);
  if (backgroundColor) styles.push(`background-color:${backgroundColor}`);
  return styles.length > 0 ? ` style="${styles.join(';')}"` : '';
}

function inlineToHtml(inline: ExportInline): string {
  const rawText = inline.text;
  if (!rawText) return '';

  if (inline.code) {
    return `<code class="flowdocs-text-code">${escapeHtml(rawText)}</code>`;
  }

  let inner = escapeHtml(rawText);
  if (inline.bold) inner = `<strong>${inner}</strong>`;
  if (inline.italic) inner = `<em>${inner}</em>`;
  if (inline.underline) inner = `<u>${inner}</u>`;
  if (inline.strikethrough) inner = `<s>${inner}</s>`;

  const styleAttr = inlineStyleAttr(inline);
  if (styleAttr) {
    inner = `<span${styleAttr}>${inner}</span>`;
  }

  if (inline.link) {
    const safeHref = sanitizeExportHref(inline.link);
    if (safeHref) {
      inner = `<a href="${safeHref}" class="flowdocs-link" target="_blank" rel="noopener noreferrer">${inner}</a>`;
    }
  }

  return inner;
}

function inlinesToHtml(inlines: ExportInline[]): string {
  return inlines.map(inlineToHtml).join('');
}

function textAlignClass(textAlign?: ExportTextAlign): string {
  if (textAlign === 'center' || textAlign === 'right' || textAlign === 'justify') {
    return textAlign;
  }
  return 'left';
}

function alignClass(align?: ExportLayoutAlign): string {
  return align === 'center' || align === 'right' ? align : 'left';
}

function widthClass(preset?: ExportWidthPreset): string {
  if (preset === 'narrow' || preset === 'wide' || preset === 'full') return preset;
  return 'normal';
}

function sanitizeCssWidth(width?: string): string | null {
  if (!width?.trim()) return null;
  const trimmed = width.trim();
  if (/^\d+(\.\d+)?(px|%|em|rem)$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^min\([^)]+\)$/i.test(trimmed) || /^max\([^)]+\)$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function wrapBlock(className: string, html: string): string {
  return `<div class="flowdocs-export-block ${className}">${html}</div>`;
}

function blockToHtml(block: ExportBlock, imageDataUrls: Map<string, string>): string {
  switch (block.type) {
    case 'paragraph': {
      const content = inlinesToHtml(block.inlines);
      const align = textAlignClass(block.textAlign);
      if (!content) {
        return wrapBlock('is-empty', `<p class="flowdocs-align-${align}"><br /></p>`);
      }
      return wrapBlock('', `<p class="flowdocs-align-${align}">${content}</p>`);
    }
    case 'heading': {
      const tag = `h${block.level}`;
      const align = textAlignClass(block.textAlign);
      return wrapBlock(
        '',
        `<${tag} class="flowdocs-align-${align}">${inlinesToHtml(block.inlines)}</${tag}>`,
      );
    }
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items.map((item) => `<li>${inlinesToHtml(item) || '&#160;'}</li>`).join('');
      return wrapBlock('', `<${tag}>${items}</${tag}>`);
    }
    case 'code': {
      const inner = block.codeHtml ?? escapeHtml(block.code);
      return wrapBlock('', `<pre class="flowdocs-code-block"><code>${inner}</code></pre>`);
    }
    case 'table': {
      const columnCount = Math.max(1, ...block.rows.map((row) => row.length));
      const rows = block.rows
        .map((row) => {
          const cells: string[] = [];
          for (let col = 0; col < columnCount; col += 1) {
            const cellContent = inlinesToHtml(row[col] ?? []);
            cells.push(
              `<td>${cellContent || '<span class="flowdocs-empty-cell">&#160;</span>'}</td>`,
            );
          }
          return `<tr>${cells.join('')}</tr>`;
        })
        .join('');
      const align = alignClass(block.layoutAlign);
      const width = widthClass(block.widthPreset);
      return wrapBlock(
        '',
        `<div class="flowdocs-table-wrap align-${align} width-${width}"><table class="flowdocs-table"><tbody>${rows}</tbody></table></div>`,
      );
    }
    case 'image': {
      const align = alignClass(block.align);
      const placeholder = `<p><em>${escapeHtml(block.altText || 'Görsel')}</em></p>`;
      if (!block.mediaId) {
        return wrapBlock('', `<figure class="flowdocs-image-block align-${align}">${placeholder}</figure>`);
      }
      const src = imageDataUrls.get(block.mediaId);
      if (!src) {
        return wrapBlock('', `<figure class="flowdocs-image-block align-${align}">${placeholder}</figure>`);
      }
      const alt = escapeHtml(block.altText || '');
      const safeWidth = sanitizeCssWidth(block.width);
      const widthAttr = safeWidth
        ? ` style="width:${escapeHtml(safeWidth)};max-width:100%;height:auto;"`
        : '';
      return wrapBlock(
        '',
        `<figure class="flowdocs-image-block align-${align}"><img src="${src}" alt="${alt}"${widthAttr} /></figure>`,
      );
    }
    case 'file-attachment': {
      const align = alignClass(block.align);
      const width = widthClass(block.widthPreset);
      const name = escapeHtml(block.fileName);
      const typeLabel = escapeHtml(getFileTypeLabel(block.mimeType));
      const sizeLabel = escapeHtml(formatFileSize(block.size));
      return wrapBlock(
        '',
        `<div class="flowdocs-file-attachment-wrap align-${align} width-${width}">` +
          '<div class="flowdocs-file-attachment-card" role="group">' +
          '<div class="flowdocs-file-attachment-card__icon" aria-hidden="true">📎</div>' +
          '<div class="flowdocs-file-attachment-card__body">' +
          `<div class="flowdocs-file-attachment-card__name">${name}</div>` +
          '<div class="flowdocs-file-attachment-card__meta">' +
          `<span class="flowdocs-file-attachment-card__badge">${typeLabel}</span>` +
          `<span class="flowdocs-file-attachment-card__size">${sizeLabel}</span>` +
          '</div></div></div></div>',
      );
    }
    default:
      return '';
  }
}

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  const safeMime =
    mimeType === 'image/png' ||
    mimeType === 'image/jpeg' ||
    mimeType === 'image/webp' ||
    mimeType === 'image/gif'
      ? mimeType
      : 'image/png';
  return `data:${safeMime};base64,${buffer.toString('base64')}`;
}

export async function resolveExportImageDataUrls(
  context: ExportBuildContext,
): Promise<Map<string, string>> {
  const imageDataUrls = new Map<string, string>();
  for (const block of context.blocks) {
    if (block.type !== 'image' || !block.mediaId) continue;
    if (imageDataUrls.has(block.mediaId)) continue;
    const image = await context.resolveImage(block.mediaId);
    if (image) {
      imageDataUrls.set(block.mediaId, bufferToDataUrl(image.buffer, image.mimeType));
    }
  }
  return imageDataUrls;
}

export async function renderExportBodyHtml(
  context: ExportBuildContext,
  imageDataUrls?: Map<string, string>,
): Promise<string> {
  const urls = imageDataUrls ?? (await resolveExportImageDataUrls(context));
  return context.blocks.map((block) => blockToHtml(block, urls)).join('\n');
}

export async function buildFlowdocsExportHtml(
  context: ExportBuildContext,
  options?: { includeDocumentTitle?: boolean },
): Promise<string> {
  const includeTitle = options?.includeDocumentTitle ?? true;
  const body = await renderExportBodyHtml(context);
  const exportedAt = new Date().toISOString();
  const titleBlock = includeTitle
    ? `<h1 class="flowdocs-export-title">${escapeHtml(context.title)}</h1>`
    : '';
  const metaBlock = `<p class="flowdocs-export-meta">FlowDocs dışa aktarma • ${escapeHtml(exportedAt)}</p>`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="generator" content="FlowDocs Export" />
  <meta name="author" content="FlowDocs" />
  <title>${escapeHtml(context.title)}</title>
  <style>${FLOWDOCS_EXPORT_STYLES}</style>
</head>
<body>
  <div class="flowdocs-export-shell">
    <article class="flowdocs-export-page flowdocs-document-page">
      ${metaBlock}
      ${titleBlock}
      <div class="flowdocs-export-body flowdocs-editor-content">
        ${body}
      </div>
    </article>
  </div>
</body>
</html>`;
}
