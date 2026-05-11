import { IsString, Length } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @Length(1, 120)
  workspaceId!: string;

  @IsString()
  @Length(2, 180)
  title!: string;
}
