/*
  Warnings:

  - A unique constraint covering the columns `[kode,nama]` on the table `KodeAkun` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."KodeAkun_kode_key";

-- CreateIndex
CREATE UNIQUE INDEX "KodeAkun_kode_nama_key" ON "public"."KodeAkun"("kode", "nama");
