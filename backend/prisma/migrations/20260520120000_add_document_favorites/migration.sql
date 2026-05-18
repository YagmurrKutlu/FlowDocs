-- CreateTable
CREATE TABLE "DocumentFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentFavorite_userId_idx" ON "DocumentFavorite"("userId");

-- CreateIndex
CREATE INDEX "DocumentFavorite_documentId_idx" ON "DocumentFavorite"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFavorite_userId_documentId_key" ON "DocumentFavorite"("userId", "documentId");

-- AddForeignKey
ALTER TABLE "DocumentFavorite" ADD CONSTRAINT "DocumentFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFavorite" ADD CONSTRAINT "DocumentFavorite_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
