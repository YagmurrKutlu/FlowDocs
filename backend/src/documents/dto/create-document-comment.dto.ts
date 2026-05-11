import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateDocumentCommentDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return undefined;
    const t = value.trim();
    return t.length > 0 ? t : undefined;
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  selectedText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  anchorOffset?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  focusOffset?: number;
}
