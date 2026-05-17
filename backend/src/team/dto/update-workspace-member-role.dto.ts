import { WorkspaceRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateWorkspaceMemberRoleDto {
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;

}
