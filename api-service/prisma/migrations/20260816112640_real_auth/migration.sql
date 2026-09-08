/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `Creator` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[mobileNumber]` on the table `Creator` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mobileNumber` to the `Creator` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `Creator` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `Creator` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "mobileNumber" TEXT NOT NULL,
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "username" TEXT NOT NULL,
ALTER COLUMN "googleSub" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Creator_username_key" ON "Creator"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_mobileNumber_key" ON "Creator"("mobileNumber");
