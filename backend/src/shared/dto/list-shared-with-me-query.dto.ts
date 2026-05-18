import { DocumentRole } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export class ListSharedWithMeQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsEnum(DocumentRole)
  role?: DocumentRole;

  @IsOptional()
  @IsIn(['recent', 'updated', 'title'])
  sort?: 'recent' | 'updated' | 'title';
}
