import { IsOptional, IsString, Length } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  description?: string;
}
