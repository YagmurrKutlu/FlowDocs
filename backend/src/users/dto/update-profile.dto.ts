import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  fullName?: string;

  @IsOptional()
  @IsString()
  @ValidateIf(
    (_, value: string | undefined) => value !== undefined && value !== '',
  )
  @IsUrl(
    {
      require_protocol: true,
    },
    {
      message: 'avatarUrl must be a valid URL.',
    },
  )
  avatarUrl?: string;
}
