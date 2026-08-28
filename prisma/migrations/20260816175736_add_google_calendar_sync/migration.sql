-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "googleEventId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleCalendarAccessToken" TEXT,
ADD COLUMN     "googleCalendarRefreshToken" TEXT,
ADD COLUMN     "googleCalendarTokenExpiry" TIMESTAMP(3);
