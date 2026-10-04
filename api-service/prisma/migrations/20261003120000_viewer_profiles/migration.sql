-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "viewerId" TEXT;

-- CreateTable
CREATE TABLE "Viewer" (
    "id" TEXT NOT NULL,
    "twinId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'English',
    "visits" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Viewer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Viewer_twinId_lastSeen_idx" ON "Viewer"("twinId", "lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "Viewer_twinId_deviceId_key" ON "Viewer"("twinId", "deviceId");

-- CreateIndex
CREATE INDEX "Message_viewerId_idx" ON "Message"("viewerId");

-- AddForeignKey
ALTER TABLE "Viewer" ADD CONSTRAINT "Viewer_twinId_fkey" FOREIGN KEY ("twinId") REFERENCES "Twin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Viewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
