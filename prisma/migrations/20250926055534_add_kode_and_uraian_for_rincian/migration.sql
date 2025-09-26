/*
  Warnings:

  - Added the required column `kodeKRO` to the `SpmRincian` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kodeKomponen` to the `SpmRincian` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kodeRO` to the `SpmRincian` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kodeSubkomponen` to the `SpmRincian` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uraian` to the `SpmRincian` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."SpmRincian" ADD COLUMN     "kodeKRO" TEXT NOT NULL,
ADD COLUMN     "kodeKomponen" TEXT NOT NULL,
ADD COLUMN     "kodeRO" TEXT NOT NULL,
ADD COLUMN     "kodeSubkomponen" TEXT NOT NULL,
ADD COLUMN     "uraian" TEXT NOT NULL;
