import { DocumentRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';

const ASSIGNABLE_DOCUMENT_ROLES: DocumentRole[] = [
  DocumentRole.EDITOR,
  DocumentRole.VIEWER,
];

export class AddDocumentMemberDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email!: string;

  @IsIn(ASSIGNABLE_DOCUMENT_ROLES, {
    message: 'Role must be one of: EDITOR, VIEWER.',
  })
  role!: 'EDITOR' | 'VIEWER';
}
