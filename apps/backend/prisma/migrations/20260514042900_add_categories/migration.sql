-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "labelPl" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "iconEmoji" VARCHAR(8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripCategory" (
    "tripId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripCategory_pkey" PRIMARY KEY ("tripId","categoryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "TripCategory_categoryId_idx" ON "TripCategory"("categoryId");

-- CreateIndex
CREATE INDEX "TripCategory_tripId_idx" ON "TripCategory"("tripId");

-- AddForeignKey
ALTER TABLE "TripCategory" ADD CONSTRAINT "TripCategory_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripCategory" ADD CONSTRAINT "TripCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
