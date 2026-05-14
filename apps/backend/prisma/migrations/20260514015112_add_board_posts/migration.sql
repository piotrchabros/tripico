-- CreateEnum
CREATE TYPE "BoardPostType" AS ENUM ('TEXT', 'PHOTO', 'VIDEO', 'POLL', 'MIXED');

-- CreateTable
CREATE TABLE "BoardPost" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "type" "BoardPostType" NOT NULL DEFAULT 'TEXT',
    "content" JSONB NOT NULL,
    "pinnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BoardPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardPost_tripId_createdAt_idx" ON "BoardPost"("tripId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BoardPost_authorId_idx" ON "BoardPost"("authorId");

-- AddForeignKey
ALTER TABLE "BoardPost" ADD CONSTRAINT "BoardPost_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardPost" ADD CONSTRAINT "BoardPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
