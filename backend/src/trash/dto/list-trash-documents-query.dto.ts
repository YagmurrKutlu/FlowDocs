import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListTrashDocumentsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'title'])
  sort?: 'newest' | 'oldest' | 'title';
}
