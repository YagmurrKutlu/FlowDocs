export type ExportFormat = 'pdf' | 'docx' | 'html' | 'markdown';

export type ExportInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  color?: string;
  backgroundColor?: string;
  link?: string;
};

export type ExportLayoutAlign = 'left' | 'center' | 'right';
export type ExportWidthPreset = 'narrow' | 'normal' | 'wide' | 'full';
export type ExportTextAlign = 'left' | 'center' | 'right' | 'justify';

export type ExportBlock =
  | { type: 'paragraph'; inlines: ExportInline[]; textAlign?: ExportTextAlign }
  | { type: 'heading'; level: number; inlines: ExportInline[]; textAlign?: ExportTextAlign }
  | { type: 'list'; ordered: boolean; items: ExportInline[][] }
  | { type: 'code'; code: string; codeHtml?: string }
  | {
      type: 'table';
      rows: ExportInline[][][];
      layoutAlign?: ExportLayoutAlign;
      widthPreset?: ExportWidthPreset;
    }
  | {
      type: 'image';
      altText: string;
      mediaId: string | null;
      width?: string;
      align?: ExportLayoutAlign;
    }
  | {
      type: 'file-attachment';
      fileName: string;
      mimeType: string;
      size: number;
      mediaId: string | null;
      align?: ExportLayoutAlign;
      widthPreset?: ExportWidthPreset;
    };

export type ExportDocument = {
  title: string;
  blocks: ExportBlock[];
};

export type ResolvedExportImage = {
  buffer: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
};

export type ExportBuildContext = {
  title: string;
  blocks: ExportBlock[];
  resolveImage: (mediaId: string) => Promise<ResolvedExportImage | null>;
};
