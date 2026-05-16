import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyDocumentUpdateDto {
  @IsString()
  @IsNotEmpty()
  updateBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sourceClientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000_000)
  editorStateJson?: string;
}
