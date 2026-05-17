import { WorkspaceRole } from '@prisma/client';
import { IsEmail, IsIn, IsNotEmpty } from 'class-validator';

export class CreateWorkspaceInviteDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsIn([WorkspaceRole.EDITOR, WorkspaceRole.VIEWER])
  role!: WorkspaceRole;
}
