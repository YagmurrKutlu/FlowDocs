import { DocumentRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListDocumentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;

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
  @IsIn(['updated', 'created', 'title', 'favorite'])
  sort?: 'updated' | 'created' | 'title' | 'favorite';

  @IsOptional()
  @IsIn(['all', 'owned', 'shared', 'recent', 'favorites'])
  view?: 'all' | 'owned' | 'shared' | 'recent' | 'favorites';
}
