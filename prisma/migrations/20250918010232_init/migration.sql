/*
  Warnings:

  - You are about to drop the column `JumlahTotal` on the `Spm` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Spm" DROP COLUMN "JumlahTotal";

-- CreateTable
CREATE TABLE "public"."SpmRincian" (
    "id" SERIAL NOT NULL,
    "kodeProgram" TEXT NOT NULL,
    "kodeKegiatan" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "spmId" INTEGER NOT NULL,
    "kodeAkunId" INTEGER NOT NULL,

    CONSTRAINT "SpmRincian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JawabanFlag" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "tipe" "public"."FlagType" NOT NULL,
    "rincianSpmId" INTEGER NOT NULL,

    CONSTRAINT "JawabanFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JawabanFlag_rincianSpmId_nama_key" ON "public"."JawabanFlag"("rincianSpmId", "nama");

-- AddForeignKey
ALTER TABLE "public"."SpmRincian" ADD CONSTRAINT "SpmRincian_spmId_fkey" FOREIGN KEY ("spmId") REFERENCES "public"."Spm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpmRincian" ADD CONSTRAINT "SpmRincian_kodeAkunId_fkey" FOREIGN KEY ("kodeAkunId") REFERENCES "public"."KodeAkun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JawabanFlag" ADD CONSTRAINT "JawabanFlag_rincianSpmId_fkey" FOREIGN KEY ("rincianSpmId") REFERENCES "public"."SpmRincian"("id") ON DELETE CASCADE ON UPDATE CASCADE;
