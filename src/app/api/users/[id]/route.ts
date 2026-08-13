// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import prismaModule from "@/lib/prisma";
import { requireRole } from "@/lib/auth/auth.guard";
import { parseIdParam } from "@/lib/types/route-params";
import { isEmail } from "@/lib/date/validation";
import { enforceCsrf } from "@/lib/security/csrf";
const { prisma } = prismaModule;

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = enforceCsrf(req);
  if (csrf) return csrf;
  console.log("HIT /api/users/{id} PUT");

  const auth = await requireRole(req, ["ADMIN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const userId = parseIdParam(id);
  if (!userId) {
    return NextResponse.json({ error: "Neispravan id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Neispravan JSON." }, { status: 400 });
  }

  const firstName =
    body.firstName !== undefined ? String(body.firstName).trim() : undefined;
  const lastName =
    body.lastName !== undefined ? String(body.lastName).trim() : undefined;
  const email =
    body.email !== undefined
      ? String(body.email).trim().toLowerCase()
      : undefined;
  const roleName =
    body.role !== undefined
      ? String(body.role).trim().toUpperCase()
      : undefined;

  if (email !== undefined && !isEmail(email)) {
    return NextResponse.json(
      { error: "Email format nije ispravan." },
      { status: 400 }
    );
  }
  if (
    roleName !== undefined &&
    !["EMPLOYEE", "MANAGER", "ADMIN"].includes(roleName)
  ) {
    return NextResponse.json({ error: "Uloga nije validna." }, { status: 400 });
  }

  let roleId: number | undefined = undefined;
  if (roleName !== undefined) {
    const role = await prisma.userRole.findUnique({
      where: { name: roleName },
    });
    if (!role) {
      return NextResponse.json(
        { error: "Uloga ne postoji u bazi (seed?)." },
        { status: 500 }
      );
    }
    roleId = role.id;
  }

  if (email !== undefined) {
    const conflict = await prisma.user.findFirst({
      where: { email, NOT: { id: userId } },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Email je već zauzet." },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(roleId !== undefined ? { roleId } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        lastLoginAt: true,
        role: { select: { name: true } },
      },
    });

    await prisma.adminAction.create({
      data: {
        action: "UPDATE_USER",
        adminId: auth.userId,
        note: `Updated userId=${updated.id}`,
      },
    });

    return NextResponse.json(
      {
        user: {
          id: updated.id,
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
          createdAt: updated.createdAt,
          lastLoginAt: updated.lastLoginAt,
          role: updated.role.name,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    // Prisma P2025: Record to update not found
    if (e?.code === "P2025") {
      return NextResponse.json(
        { error: "Korisnik nije pronađen." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Greška pri izmeni korisnika." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = enforceCsrf(req);
  if (csrf) return csrf;
  console.log("HIT /api/users/{id} DELETE");

  const auth = await requireRole(req, ["ADMIN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const userId = parseIdParam(id);
  if (!userId) {
    return NextResponse.json({ error: "Neispravan id." }, { status: 400 });
  }

  // (bezbednost) ne dozvoli brisanje samog sebe
  if (userId === auth.userId) {
    return NextResponse.json(
      { error: "Ne možeš obrisati sopstveni nalog." },
      { status: 400 }
    );
  }

  try {
    // Prvo probaj hard delete - radi samo ako nema povezanih podataka
    const deleted = await prisma.user.delete({
      where: { id: userId },
      select: { id: true, email: true },
    });

    await prisma.adminAction.create({
      data: {
        action: "DELETE_USER",
        adminId: auth.userId,
        note: `Deleted ${deleted.email}`,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json(
        { error: "Korisnik nije pronađen." },
        { status: 404 }
      );
    }

    const message = String(e?.message ?? "");
    const pgCode = e?.cause?.code ?? e?.meta?.code ?? e?.cause?.cause?.code;

    const isForeignKeyViolation =
      e?.code === "P2003" ||
      pgCode === "23503" ||
      message.includes("foreign key constraint") ||
      message.includes("violates RESTRICT");

    if (isForeignKeyViolation) {
      const deactivated = await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
        select: { id: true, email: true },
      });

      await prisma.adminAction.create({
        data: {
          action: "DEACTIVATE_USER",
          adminId: auth.userId,
          note: `Deactivated ${deactivated.email} (had related records, hard delete blocked)`,
        },
      });

      return NextResponse.json(
        {
          message:
            "Korisnik ima povezane podatke (aktivnosti/prisustvo/zahtevi), pa je umesto brisanja deaktiviran.",
          deactivated: true,
        },
        { status: 200 }
      );
    }

    console.error("DELETE USER ERROR:", e);
    return NextResponse.json(
      { error: "Greška pri brisanju korisnika." },
      { status: 500 }
    );
  }
}
