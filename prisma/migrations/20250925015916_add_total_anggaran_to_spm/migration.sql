/*
  Warnings:

  - Added the required column `totalAnggaran` to the `Spm` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Spm" ADD COLUMN     "totalAnggaran" INTEGER NOT NULL;
