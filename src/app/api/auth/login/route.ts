import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { enforceCsrf } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { prisma } from "@/lib/prisma";
import { runAttendanceSeedIfNeeded } from "@/lib/seedAttendance";

import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
} from "@/lib/auth/auth.server";

export async function POST(req: Request) {
  const csrf = enforceCsrf(req);
  if (csrf) return csrf;
  console.log("HIT /api/auth/login POST");

  try {
    const body = await req.json();
    const { email, password } = body ?? {};
    const rate = checkRateLimit(email);
    if (rate) {
      return NextResponse.json({ error: rate.error }, { status: rate.status });
    }
    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    //nije bezbedno otkriti da li je mejl tacan
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (ok) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      runAttendanceSeedIfNeeded().catch((e) =>
        console.error("ATTENDANCE SEED ERROR:", e)
      );
    }
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = signToken({ userId: user.id, role: user.role.name });

    const res = NextResponse.json(
      { user: { id: user.id, email: user.email, role: user.role.name } },
      { status: 200 }
    );

    res.headers.append("Set-Cookie", clearAuthCookie());
    res.headers.set("Set-Cookie", setAuthCookie(token));
    return res;
  } catch (e: any) {
    console.error("LOGIN ERROR:", e);
    return NextResponse.json(
      {
        error: "Server error",
        message: e?.message ?? String(e),
        code: e?.code,
        meta: e?.meta,
        stack: process.env.NODE_ENV === "development" ? e?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
