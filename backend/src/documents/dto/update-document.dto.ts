import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class UpdateDocumentDto {
  @IsString()
  @Length(2, 120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;
}
