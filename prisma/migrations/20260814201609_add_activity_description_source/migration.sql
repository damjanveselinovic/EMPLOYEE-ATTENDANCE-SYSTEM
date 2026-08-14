-- CreateEnum
CREATE TYPE "DescriptionSource" AS ENUM ('MANUAL', 'AI');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "descriptionSource" "DescriptionSource";
