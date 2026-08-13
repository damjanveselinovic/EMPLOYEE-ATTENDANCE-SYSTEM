import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/auth.guard";

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const userId = (auth as any).userId as number | undefined;
  if (typeof userId !== "number") {
    return NextResponse.json(
      { error: "Invalid token (missing userId)" },
      { status: 401 }
    );
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}
