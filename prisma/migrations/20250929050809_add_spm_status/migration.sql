-- CreateEnum
CREATE TYPE "public"."SpmStatus" AS ENUM ('MENUNGGU', 'DITOLAK', 'DITERIMA');

-- AlterTable
ALTER TABLE "public"."Spm" ADD COLUMN     "status" "public"."SpmStatus" NOT NULL DEFAULT 'MENUNGGU';
