// src/app/api/users/[id]/reset-password/route.ts
import { NextResponse } from "next/server";
import prismaModule from "@/lib/prisma";
import { requireRole } from "@/lib/auth/auth.guard";
import { parseIdParam } from "@/lib/types/route-params";
import bcrypt from "bcrypt";
import { enforceCsrf } from "@/lib/security/csrf";
import { createNotification } from "@/lib/notifications/notifications.server";

const { prisma } = prismaModule;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = enforceCsrf(req);
  if (csrf) return csrf;
  console.log("HIT /api/users/reset-password00 POST");

  const auth = await requireRole(req, ["ADMIN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const userId = parseIdParam(id);
  if (!userId) {
    return NextResponse.json({ error: "Neispravan id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Neispravan JSON." }, { status: 400 });

  const newPassword = String(body.password ?? "").trim();
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "Lozinka mora imati bar 6 karaktera." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true },
    });

    await prisma.adminAction.create({
      data: {
        action: "RESET_PASSWORD",
        adminId: auth.userId,
        note: `Reset password for userId=${userId}`,
      },
    });

    await createNotification({
      userId,
      type: "PASSWORD_RESET",
      message: "Vaša lozinka je promenjena od strane administratora.",
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json(
        { error: "Korisnik nije pronađen." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Greška pri resetu lozinke." },
      { status: 500 }
    );
  }
}
