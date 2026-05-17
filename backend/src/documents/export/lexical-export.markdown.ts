import type { ExportBlock, ExportBuildContext, ExportInline } from './lexical-export.types';
import {
  escapeHtml,
  formatFileSize,
  getFileTypeLabel,
} from './lexical-export.utils';

function inlineToMarkdown(inline: ExportInline): string {
  let text = inline.text;
  if (!text) return '';
  if (inline.code) {
    return text.includes('`') ? `\`\`${text}\`\`` : `\`${text}\``;
  }
  const hasColor = inline.color || inline.backgroundColor;
  if (hasColor) {
    const style: string[] = [];
    if (inline.color) style.push(`color:${inline.color}`);
    if (inline.backgroundColor) style.push(`background-color:${inline.backgroundColor}`);
    text = `<span style="${style.join(';')}">${escapeHtml(text)}</span>`;
  }
  if (inline.bold) text = `**${text}**`;
  if (inline.italic) text = `*${text}*`;
  if (inline.strikethrough) text = `~~${text}~~`;
  if (inline.link) text = `[${text}](${inline.link})`;
  return text;
}

function inlinesToMarkdown(inlines: ExportInline[]): string {
  return inlines.map(inlineToMarkdown).join('');
}

function blockToMarkdown(block: ExportBlock): string {
  switch (block.type) {
    case 'paragraph':
      return inlinesToMarkdown(block.inlines) || '';
    case 'heading': {
      const hashes = '#'.repeat(block.level);
      return `${hashes} ${inlinesToMarkdown(block.inlines)}`;
    }
    case 'list': {
      return block.items
        .map((item, index) => {
          const prefix = block.ordered ? `${index + 1}. ` : '- ';
          return `${prefix}${inlinesToMarkdown(item)}`;
        })
        .join('\n');
    }
    case 'code':
      return `\`\`\`\n${block.code.replace(/\n$/, '')}\n\`\`\``;
    case 'table': {
      if (block.rows.length === 0) return '';
      const lines = block.rows.map((row) => {
        const cells = row.map((cell) => inlinesToMarkdown(cell).replace(/\|/g, '\\|'));
        return `| ${cells.join(' | ')} |`;
      });
      const columnCount = block.rows[0]?.length ?? 0;
      const separator = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`;
      if (lines.length > 0) {
        lines.splice(1, 0, separator);
      }
      return lines.join('\n');
    }
    case 'image':
      return block.altText
        ? `![${block.altText}](media:${block.mediaId ?? 'unavailable'})`
        : `![Görsel](media:${block.mediaId ?? 'unavailable'})`;
    case 'file-attachment':
      return `📎 **${block.fileName}** — ${getFileTypeLabel(block.mimeType)} — ${formatFileSize(block.size)}`;
    default:
      return '';
  }
}

export function buildExportMarkdown(context: ExportBuildContext): string {
  const lines = [`# ${context.title}`, ''];
  for (const block of context.blocks) {
    const line = blockToMarkdown(block);
    if (line) lines.push(line);
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}
