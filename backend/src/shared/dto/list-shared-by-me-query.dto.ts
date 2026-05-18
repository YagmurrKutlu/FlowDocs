import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListSharedByMeQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsIn(['recent', 'updated', 'title'])
  sort?: 'recent' | 'updated' | 'title';
}
