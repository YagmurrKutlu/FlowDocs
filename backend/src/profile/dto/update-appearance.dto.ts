import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class UpdateAppearanceDto {
  @IsOptional()
  @IsString()
  @IsIn(['tr', 'en'])
  language?: 'tr' | 'en';

  @IsOptional()
  @IsString()
  @Length(1, 80)
  fontFamily?: string;
}
