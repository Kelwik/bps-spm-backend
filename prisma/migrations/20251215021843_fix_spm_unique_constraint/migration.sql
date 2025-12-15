/*
  Warnings:

  - A unique constraint covering the columns `[nomorSpm,satkerId,tahunAnggaran]` on the table `Spm` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Spm_nomorSpm_key";

-- CreateIndex
CREATE UNIQUE INDEX "Spm_nomorSpm_satkerId_tahunAnggaran_key" ON "public"."Spm"("nomorSpm", "satkerId", "tahunAnggaran");
