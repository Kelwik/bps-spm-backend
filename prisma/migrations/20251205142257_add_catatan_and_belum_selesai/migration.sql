-- AlterEnum
ALTER TYPE "public"."FlagType" ADD VALUE 'BELUM_SELESAI';

-- AlterTable
ALTER TABLE "public"."SpmRincian" ADD COLUMN     "catatan" TEXT;
