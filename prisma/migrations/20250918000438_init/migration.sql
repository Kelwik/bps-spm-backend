-- CreateEnum
CREATE TYPE "public"."FlagType" AS ENUM ('IYA', 'TIDAK', 'IYA_TIDAK');

-- CreateTable
CREATE TABLE "public"."Satker" (
    "id" SERIAL NOT NULL,
    "kodeSatker" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "eselon" TEXT NOT NULL,

    CONSTRAINT "Satker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Spm" (
    "id" SERIAL NOT NULL,
    "nomorSpm" TEXT NOT NULL,
    "tahunAnggaran" INTEGER NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "JumlahTotal" INTEGER NOT NULL,
    "satkerId" INTEGER NOT NULL,

    CONSTRAINT "Spm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KodeAkun" (
    "id" SERIAL NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,

    CONSTRAINT "KodeAkun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Flag" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "tipe" "public"."FlagType" NOT NULL,
    "kodeAkunId" INTEGER NOT NULL,

    CONSTRAINT "Flag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Satker_kodeSatker_key" ON "public"."Satker"("kodeSatker");

-- CreateIndex
CREATE UNIQUE INDEX "Spm_nomorSpm_key" ON "public"."Spm"("nomorSpm");

-- CreateIndex
CREATE UNIQUE INDEX "KodeAkun_kode_key" ON "public"."KodeAkun"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Flag_kodeAkunId_nama_key" ON "public"."Flag"("kodeAkunId", "nama");

-- AddForeignKey
ALTER TABLE "public"."Spm" ADD CONSTRAINT "Spm_satkerId_fkey" FOREIGN KEY ("satkerId") REFERENCES "public"."Satker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Flag" ADD CONSTRAINT "Flag_kodeAkunId_fkey" FOREIGN KEY ("kodeAkunId") REFERENCES "public"."KodeAkun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
