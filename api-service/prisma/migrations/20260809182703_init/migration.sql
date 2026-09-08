-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Twin" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "channelId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "toneMatch" BOOLEAN NOT NULL DEFAULT true,
    "guardrails" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Twin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "twinId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "grounded" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creator_googleSub_key" ON "Creator"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_email_key" ON "Creator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_handle_key" ON "Creator"("handle");

-- AddForeignKey
ALTER TABLE "Twin" ADD CONSTRAINT "Twin_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_twinId_fkey" FOREIGN KEY ("twinId") REFERENCES "Twin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
