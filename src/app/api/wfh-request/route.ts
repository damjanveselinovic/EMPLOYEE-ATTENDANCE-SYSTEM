import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/auth.guard";
import { parseDateOnlyUTC, addDaysUTC, toISODateUTC } from "@/lib/date/date";
import { isBadWeather } from "@/lib/weather/wfh.utils";
import { enforceCsrf } from "@/lib/security/csrf";

export async function POST(req: Request) {
  const csrf = enforceCsrf(req);
  if (csrf) return csrf;
  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const userId = (auth as any).userId as number | undefined;
  if (typeof userId !== "number") {
    return NextResponse.json(
      { error: "Invalid token payload (missing userId)" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);

  const dateStr = body?.date; // "YYYY-MM-DD"
  const reason = (body?.reason ?? "").toString().trim() || null;

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json(
      { error: "date mora biti YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: { select: { name: true } } },
  });

  if (!u) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbRole = u.role.name;

  const date = parseDateOnlyUTC(dateStr);
  if (!date) {
    return NextResponse.json(
      { error: "date mora biti YYYY-MM-DD" },
      { status: 400 }
    );
  }
  const locationKey = process.env.WEATHER_LOCATION_KEY ?? "BELGRADE_OFFICE";
  const w = await prisma.weatherDaily.findFirst({
    where: { locationKey, date },
    select: {
      tempMax: true,
      tempMin: true,
      weatherCode: true,
      precipSum: true,
      windMax: true,
    },
  });

  if (!w) {
    return NextResponse.json(
      {
        error:
          "Nema vremenskih podataka za taj datum (auto-sync se nije desio još).",
      },
      { status: 409 }
    );
  }

  if (!isBadWeather(w)) {
    return NextResponse.json(
      {
        error:
          "Zahtev za rad od kuće je moguć samo kada su vremenski uslovi loši.",
      },
      { status: 400 }
    );
  }

  const created = await prisma.wfhRequest.upsert({
    where: {
      user_date_unique: { userId: u.id, date },
    },
    update: {
      //ako ponovo klikne istog dana, samo update reason + refresh snapshot
      reason,
      weatherCode: w.weatherCode,
      precipSum: w.precipSum,
      windMax: w.windMax,
    },
    create: {
      userId: u.id,
      date,
      reason,
      weatherCode: w.weatherCode,
      precipSum: w.precipSum,
      windMax: w.windMax,
    },
    select: {
      id: true,
      status: true,
      date: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ...created,
    date: created.date.toISOString().slice(0, 10),
    createdAt: created.createdAt.toISOString(),
  });
}

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const userId = (auth as any).userId as number | undefined;
  if (typeof userId !== "number") {
    return NextResponse.json(
      { error: "Invalid token payload (missing userId)" },
      { status: 401 }
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: { select: { name: true } } },
  });

  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myRole = me.role.name; // "ADMIN" | "MANAGER" | "EMPLOYEE"
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: any = {};

  // EMPLOYEE samo svoje
  if (myRole === "EMPLOYEE") where.userId = me.id;

  if (status) {
    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    where.status = status;
  }

  if (from || to) {
    if (!from || !to) {
      return NextResponse.json(
        { error: "Both from and to are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    const fromDate = parseDateOnlyUTC(from);
    const toDate = parseDateOnlyUTC(to);
    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }
    const endExclusive = addDaysUTC(toDate, 1);
    where.date = { gte: fromDate, lt: endExclusive };
  }

  const items = await prisma.wfhRequest.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      date: true,
      status: true,
      reason: true,
      createdAt: true,
      decidedAt: true,
      weatherCode: true,
      precipSum: true,
      windMax: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      decidedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return NextResponse.json({
    requests: items.map((x: any) => ({
      ...x,
      date: x.date.toISOString().slice(0, 10),
      createdAt: x.createdAt.toISOString(),
      decidedAt: x.decidedAt ? x.decidedAt.toISOString() : null,
    })),
  });
}
