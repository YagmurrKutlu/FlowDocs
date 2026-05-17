-- CreateTable
CREATE TABLE "DocumentMessage" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentMessage_documentId_createdAt_idx" ON "DocumentMessage"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentMessage_authorId_idx" ON "DocumentMessage"("authorId");

-- AddForeignKey
ALTER TABLE "DocumentMessage" ADD CONSTRAINT "DocumentMessage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentMessage" ADD CONSTRAINT "DocumentMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
