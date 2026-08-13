import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

export async function createNotification({
  userId,
  type,
  message,
}: {
  userId: number;
  type: NotificationType;
  message: string;
}) {
  try {
    await prisma.notification.create({
      data: { userId, type, message },
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}
