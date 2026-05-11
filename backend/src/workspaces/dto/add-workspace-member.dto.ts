import { WorkspaceRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';

const ASSIGNABLE_ROLES: WorkspaceRole[] = [
  WorkspaceRole.ADMIN,
  WorkspaceRole.EDITOR,
  WorkspaceRole.VIEWER,
];

export class AddWorkspaceMemberDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email!: string;

  @IsIn(ASSIGNABLE_ROLES, {
    message: 'Role must be one of: ADMIN, EDITOR, VIEWER.',
  })
  role!: WorkspaceRole;
}
