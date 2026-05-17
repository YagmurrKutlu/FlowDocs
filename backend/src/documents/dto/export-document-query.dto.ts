import { IsIn, IsString } from 'class-validator';

export const EXPORT_FORMATS = ['pdf', 'docx', 'html', 'markdown'] as const;
export type ExportFormatDto = (typeof EXPORT_FORMATS)[number];

export class ExportDocumentQueryDto {
  @IsString()
  @IsIn(EXPORT_FORMATS)
  format!: ExportFormatDto;
}
