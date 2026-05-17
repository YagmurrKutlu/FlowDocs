import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
  type IRunOptions,
  type ParagraphChild,
} from 'docx';
import type {
  ExportBlock,
  ExportBuildContext,
  ExportInline,
  ExportLayoutAlign,
  ExportWidthPreset,
} from './lexical-export.types';
import { formatFileSize, getFileTypeLabel } from './lexical-export.utils';

const DOCX_FONT = 'Calibri';
const CODE_FONT = 'Courier New';
const MAX_IMAGE_WIDTH_PX = 480;
const TABLE_BORDER_COLOR = 'CBD5E1';
const TABLE_HEADER_FILL = 'F1F5F9';

type DocxBlock = Paragraph | Table;

const CELL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: TABLE_BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: TABLE_BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: TABLE_BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: TABLE_BORDER_COLOR },
};

const CELL_MARGINS = {
  top: 80,
  bottom: 80,
  left: 120,
  right: 120,
};

function headingLevel(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const map = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  } as const;
  return map[level as keyof typeof map] ?? HeadingLevel.HEADING_1;
}

function cssColorToHex(color?: string): string | undefined {
  if (!color?.trim()) return undefined;
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.replace('#', '').slice(0, 6);
    return /^[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : undefined;
  }
  const rgb = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return undefined;
  const toHex = (n: string) => Number.parseInt(n, 10).toString(16).padStart(2, '0');
  return `${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`.toUpperCase();
}

function alignmentType(align?: ExportLayoutAlign): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (align === 'center') return AlignmentType.CENTER;
  if (align === 'right') return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

function widthPresetPercent(preset?: ExportWidthPreset): number {
  switch (preset) {
    case 'narrow':
      return 58;
    case 'wide':
      return 92;
    case 'full':
      return 100;
    default:
      return 78;
  }
}

function parseWidthPx(width?: string, max = MAX_IMAGE_WIDTH_PX): number {
  if (!width?.trim()) return max;
  const pxMatch = width.match(/(\d+(?:\.\d+)?)\s*px/i);
  if (pxMatch) {
    return Math.min(max, Math.max(120, Math.round(Number.parseFloat(pxMatch[1]))));
  }
  const pctMatch = width.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    return Math.min(max, Math.round((Number.parseFloat(pctMatch[1]) / 100) * max));
  }
  return max;
}

function imageDimensions(
  buffer: Buffer,
  mimeType: string,
  widthHint?: string,
): { width: number; height: number; type: 'png' | 'jpg' | 'gif' | 'bmp' } {
  const targetWidth = parseWidthPx(widthHint, MAX_IMAGE_WIDTH_PX);
  const type = mimeType.includes('png')
    ? 'png'
    : mimeType.includes('gif')
      ? 'gif'
      : mimeType.includes('bmp')
        ? 'bmp'
        : 'jpg';

  // Default 4:3 if we cannot probe dimensions.
  let aspect = 0.75;
  if (type === 'png' && buffer.length > 24) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width > 0 && height > 0) {
      aspect = height / width;
    }
  } else if (type === 'jpg' && buffer.length > 4) {
    // Minimal JPEG SOF probe for aspect ratio.
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) {
          aspect = height / width;
          break;
        }
      }
      offset += 2 + length;
    }
  }

  const width = targetWidth;
  const height = Math.max(80, Math.round(width * aspect));
  return { width, height, type };
}

function baseRunOptions(inline: ExportInline): IRunOptions {
  const color = cssColorToHex(inline.color);
  const fill = cssColorToHex(inline.backgroundColor);
  return {
    font: inline.code ? CODE_FONT : DOCX_FONT,
    bold: inline.bold,
    italics: inline.italic,
    underline: inline.underline ? {} : undefined,
    strike: inline.strikethrough,
    color,
    size: inline.code ? 20 : 22,
    shading: fill
      ? {
          type: ShadingType.CLEAR,
          fill,
        }
      : inline.code
        ? {
            type: ShadingType.CLEAR,
            fill: 'F1F5F9',
          }
        : undefined,
  };
}

function inlineToParagraphChildren(inline: ExportInline): ParagraphChild[] {
  if (!inline.text) return [];

  if (inline.link) {
    return [
      new ExternalHyperlink({
        link: inline.link,
        children: [
          new TextRun({
            ...baseRunOptions(inline),
            text: inline.text,
            style: 'Hyperlink',
            color: cssColorToHex(inline.color) ?? '4F6FD8',
            underline: {},
          }),
        ],
      }),
    ];
  }

  return [new TextRun({ ...baseRunOptions(inline), text: inline.text })];
}

function inlinesToParagraphChildren(inlines: ExportInline[]): ParagraphChild[] {
  return inlines.flatMap((inline) => inlineToParagraphChildren(inline));
}

function paragraphFromInlines(
  inlines: ExportInline[],
  options?: IParagraphOptions,
): Paragraph {
  const children = inlinesToParagraphChildren(inlines);
  return new Paragraph({
    spacing: { before: 120, after: 120, line: 276 },
    ...options,
    children: children.length > 0 ? children : [new TextRun({ text: ' ', font: DOCX_FONT })],
  });
}

function buildCodeBlockParagraphs(code: string): Paragraph[] {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const safeLines = lines.length > 0 ? lines : [''];

  return safeLines.map(
    (line, index) =>
      new Paragraph({
        spacing: {
          before: index === 0 ? 160 : 0,
          after: index === safeLines.length - 1 ? 160 : 0,
          line: 240,
        },
        shading: {
          type: ShadingType.CLEAR,
          fill: '0F172A',
        },
        border: {
          left: { style: BorderStyle.SINGLE, size: 6, color: '334155', space: 4 },
        },
        children: [
          new TextRun({
            text: line.length > 0 ? line : ' ',
            font: CODE_FONT,
            size: 20,
            color: 'E2E8F0',
          }),
        ],
      }),
  );
}

function buildTable(block: Extract<ExportBlock, { type: 'table' }>): Table {
  const columnCount = Math.max(1, ...block.rows.map((row) => row.length));
  const columnWidth = Math.floor(9000 / columnCount);

  return new Table({
    width: { size: widthPresetPercent(block.widthPreset), type: WidthType.PERCENTAGE },
    alignment: alignmentType(block.layoutAlign),
    rows: block.rows.map((row, rowIndex) => {
      const cells: TableCell[] = [];
      for (let col = 0; col < columnCount; col += 1) {
        const cellInlines = row[col] ?? [];
        cells.push(
          new TableCell({
            borders: CELL_BORDERS,
            margins: CELL_MARGINS,
            width: { size: columnWidth, type: WidthType.DXA },
            shading:
              rowIndex === 0
                ? { type: ShadingType.CLEAR, fill: TABLE_HEADER_FILL }
                : undefined,
            children: [paragraphFromInlines(cellInlines, { spacing: { before: 60, after: 60 } })],
          }),
        );
      }
      return new TableRow({ children: cells });
    }),
  });
}

function buildFileAttachmentCard(
  block: Extract<ExportBlock, { type: 'file-attachment' }>,
): Table {
  const typeLabel = getFileTypeLabel(block.mimeType);
  const sizeLabel = formatFileSize(block.size);

  return new Table({
    width: { size: widthPresetPercent(block.widthPreset), type: WidthType.PERCENTAGE },
    alignment: alignmentType(block.align),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 80 },
                children: [
                  new TextRun({
                    text: `📎 ${block.fileName}`,
                    bold: true,
                    size: 22,
                    font: DOCX_FONT,
                    color: '111827',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: `${typeLabel} • ${sizeLabel}`,
                    size: 18,
                    font: DOCX_FONT,
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

async function blockToDocx(
  block: ExportBlock,
  context: ExportBuildContext,
): Promise<DocxBlock[]> {
  switch (block.type) {
    case 'paragraph':
      return [paragraphFromInlines(block.inlines)];
    case 'heading':
      return [
        paragraphFromInlines(block.inlines, {
          heading: headingLevel(block.level),
          spacing: { before: 240, after: 120 },
        }),
      ];
    case 'list':
      return block.items.map((item, index) =>
        paragraphFromInlines(item, {
          numbering: block.ordered
            ? { reference: 'export-ordered-list', level: 0 }
            : { reference: 'export-bullet-list', level: 0 },
          spacing: { before: 60, after: index === block.items.length - 1 ? 120 : 60 },
        }),
      );
    case 'code':
      return buildCodeBlockParagraphs(block.code);
    case 'table':
      return block.rows.length > 0 ? [buildTable(block)] : [];
    case 'image': {
      if (!block.mediaId) {
        return [
          new Paragraph({
            alignment: alignmentType(block.align),
            children: [
              new TextRun({
                text: block.altText || 'Görsel',
                italics: true,
                font: DOCX_FONT,
                color: '64748B',
              }),
            ],
          }),
        ];
      }
      const image = await context.resolveImage(block.mediaId);
      if (!image) {
        return [
          new Paragraph({
            alignment: alignmentType(block.align),
            children: [
              new TextRun({
                text: block.altText || 'Görsel',
                italics: true,
                font: DOCX_FONT,
                color: '64748B',
              }),
            ],
          }),
        ];
      }
      const dims = imageDimensions(image.buffer, image.mimeType, block.width);
      return [
        new Paragraph({
          alignment: alignmentType(block.align),
          spacing: { before: 160, after: 160 },
          children: [
            new ImageRun({
              data: image.buffer,
              type: dims.type,
              transformation: {
                width: dims.width,
                height: dims.height,
              },
            }),
          ],
        }),
      ];
    }
    case 'file-attachment':
      return [buildFileAttachmentCard(block)];
    default:
      return [];
  }
}

export async function buildExportDocx(context: ExportBuildContext): Promise<Buffer> {
  const children: DocxBlock[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: context.title,
          bold: true,
          size: 36,
          font: DOCX_FONT,
          color: '0F172A',
        }),
      ],
    }),
  ];

  for (const block of context.blocks) {
    const parts = await blockToDocx(block, context);
    children.push(...parts);
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'export-bullet-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
        {
          reference: 'export-ordered-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              top: convertMillimetersToTwip(20),
              right: convertMillimetersToTwip(18),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(18),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
