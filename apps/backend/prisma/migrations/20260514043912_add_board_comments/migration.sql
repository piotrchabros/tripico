-- CreateTable
CREATE TABLE "BoardComment" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BoardComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardComment_postId_createdAt_idx" ON "BoardComment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "BoardComment_authorId_idx" ON "BoardComment"("authorId");

-- AddForeignKey
ALTER TABLE "BoardComment" ADD CONSTRAINT "BoardComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BoardPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardComment" ADD CONSTRAINT "BoardComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
