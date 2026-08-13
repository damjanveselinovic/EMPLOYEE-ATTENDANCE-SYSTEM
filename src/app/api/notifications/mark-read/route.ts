import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/auth.guard";
import { enforceCsrf } from "@/lib/security/csrf";

export async function PATCH(req: Request) {
  const csrf = enforceCsrf(req);
  if (csrf) return csrf;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const userId = (auth as any).userId as number | undefined;
  if (typeof userId !== "number") {
    return NextResponse.json(
      { error: "Invalid token (missing userId)" },
      { status: 401 }
    );
  }

  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
