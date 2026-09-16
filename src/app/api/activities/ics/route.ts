import { NextResponse } from "next/server";
import prismaModule from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/auth.guard";
import { parseDateOnlyUTC, addDaysUTC } from "@/lib/date/date";
import { toICSDateTime, escICS } from "@/lib/attendance/ics";

const { prisma } = prismaModule;

export async function GET(req: Request) {
  console.log("HIT /api/activities/ics GET ");

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from") ?? "";
  const toStr = url.searchParams.get("to") ?? "";
  const userIdParam = url.searchParams.get("userId");

  const from = parseDateOnlyUTC(fromStr);
  const to = parseDateOnlyUTC(toStr);
  if (!from || !to) {
    return NextResponse.json(
      { error: "from/to moraju biti u formatu YYYY-MM-DD" },
      { status: 400 }
    );
  }

  // endExclusive = to + 1 dan (date-only opseg)
  const endExclusive = addDaysUTC(to, 1);

  // “Za specifičnog korisnika”
  // - EMPLOYEE: uvek samo svoj export
  // - MANAGER/ADMIN: ako pošalješ userId -> tog user-a, ako ne -> svog
  let exportUserId = auth.userId;
  if ((auth.role === "ADMIN" || auth.role === "MANAGER") && userIdParam) {
    const n = Number(userIdParam);
    if (!Number.isFinite(n)) {
      return NextResponse.json(
        { error: "userId nije validan." },
        { status: 400 }
      );
    }
    exportUserId = n;
  }

  const activities = await prisma.activity.findMany({
    where: {
      userId: exportUserId,
      date: { gte: from, lt: endExclusive },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      startTime: true,
      endTime: true,
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  const nowStamp = toICSDateTime(new Date().toISOString());
  const calName = "Evidencija zaposlenih";

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Evidencija//Calendar Export//SR");
  lines.push("CALSCALE:GREGORIAN");
  lines.push(`X-WR-CALNAME:${escICS(calName)}`);

  for (const a of activities) {
    const uid = `activity-${a.id}@evidencija`;
    const summary = escICS(a.name ?? "Activity");
    const desc = escICS(a.description ?? "");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`   DTSTART:${toICSDateTime(a.startTime.toISOString())}`);
    lines.push(`DTEND:${toICSDateTime(a.endTime.toISOString())}`);
    lines.push(`SUMMARY:${summary}`);
    if (desc) lines.push(`DESCRIPTION:${desc}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const ics = lines.join("\r\n");
  const filename = `calendar_${fromStr}_${toStr}_user${exportUserId}.ics`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
