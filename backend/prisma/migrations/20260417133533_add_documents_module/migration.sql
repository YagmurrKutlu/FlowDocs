/*
  Warnings:

  - A unique constraint covering the columns `[workspaceId,slug]` on the table `Document` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Document_workspaceId_slug_key" ON "Document"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "DocumentUpdate_documentId_version_idx" ON "DocumentUpdate"("documentId", "version");
