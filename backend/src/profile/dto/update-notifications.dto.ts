import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationsDto {
  @IsOptional()
  @IsBoolean()
  editNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  commentNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  userJoinedNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  emailSummary?: boolean;
}
