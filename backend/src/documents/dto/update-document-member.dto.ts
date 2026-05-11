import { DocumentRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

const ASSIGNABLE_DOCUMENT_ROLES: DocumentRole[] = [
  DocumentRole.EDITOR,
  DocumentRole.VIEWER,
];

export class UpdateDocumentMemberDto {
  @IsEnum(ASSIGNABLE_DOCUMENT_ROLES)
  role!: (typeof ASSIGNABLE_DOCUMENT_ROLES)[number];
}
