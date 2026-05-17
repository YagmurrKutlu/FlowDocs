import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class PresignDocumentMediaDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(100)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  size!: number;
}
