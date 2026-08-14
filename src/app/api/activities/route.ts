import { NextResponse } from "next/server";
import prismaModule from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/auth.guard";
import { parseDateOnlyUTC, addDaysUTC } from "@/lib/date/date";
import { enforceCsrf } from "@/lib/security/csrf";
const { prisma } = prismaModule;
import { createNotification } from "@/lib/notifications/notifications.server";
import { generateActivityDescription } from "@/lib/AI/activityDescription";

//GET /api/activities?from ... to ...
export async function GET(req: Request) {
  console.log("HIT /api/activities GET ");

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  if (!fromStr || !toStr) {
    return NextResponse.json(
      { error: "Missing query params: from, to" },
      { status: 400 }
    );
  }

  const fromDate = parseDateOnlyUTC(fromStr);
  const toDate = parseDateOnlyUTC(toStr);

  if (!fromDate || !toDate) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const endExclusive = addDaysUTC(toDate, 1);

  const role = (auth as any).role;
  const roleName = typeof role === "string" ? role : role?.name;

  const where: any = {
    date: { gte: fromDate, lt: endExclusive },
  };

  // EMPLOYEE vidi samo svoje
  if (roleName === "EMPLOYEE") {
    const meUserId = Number((auth as any).userId);
    if (!Number.isInteger(meUserId) || meUserId <= 0) {
      return NextResponse.json(
        { error: "Invalid token payload" },
        { status: 401 }
      );
    }
    where.userId = meUserId;
  }

  const activities = await prisma.activity.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      descriptionSource: true,
      date: true,
      startTime: true,
      endTime: true,
      createdAt: true,
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      type: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ activities }, { status: 200 });
}

//POST /api/activities (MANAGER/ADMIN)
export async function POST(req: Request) {
  const csrf = enforceCsrf(req);
  if (csrf) return csrf;
  console.log("HIT /api/activities POST ");

  const auth = await requireRole(req, ["ADMIN", "MANAGER"]);
  if (auth instanceof Response) return auth;

  const meUserId = Number((auth as any).userId);
  if (!Number.isInteger(meUserId) || meUserId <= 0) {
    return NextResponse.json(
      { error: "Invalid token payload" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { name, description, date, startTime, endTime, userId, typeId } =
    body ?? {};

  if (!name || !date || !startTime || !endTime) {
    return NextResponse.json(
      {
        error: "Missing 1+ fields: name, date, startTime, endTime",
      },
      { status: 400 }
    );
  }

  const d = new Date(date);
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(d.getTime()) || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json(
      { error: "Invalid date/startTime/endTime format" },
      { status: 400 }
    );
  }

  if (end <= start) {
    return NextResponse.json(
      { error: "endTime must be after startTime" },
      { status: 400 }
    );
  }

  let finalDescription: string | null = description
    ? String(description).trim() || null
    : null;
  let descriptionSource: "MANUAL" | "AI" | null = finalDescription
    ? "MANUAL"
    : null;

  if (!finalDescription) {
    const aiDescription = await generateActivityDescription(name);
    if (aiDescription) {
      finalDescription = aiDescription;
      descriptionSource = "AI";
    }
  }

  const workType = await prisma.activityType.findUnique({
    where: { name: "WORK" },
    select: { id: true },
  });
  if (!workType) {
    return NextResponse.json(
      { error: "WORK type not seeded" },
      { status: 500 }
    );
  }
  const targetUserId = userId ? Number(userId) : meUserId;
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, isActive: true },
  });

  if (!targetUser || !targetUser.isActive) {
    return NextResponse.json(
      { error: "Target user not found or inactive" },
      { status: 404 }
    );
  }
  const created = await prisma.activity.create({
    data: {
      name,
      description: finalDescription,
      descriptionSource,
      date: d,
      startTime: start,
      endTime: end,
      userId: targetUserId,
      typeId: workType.id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      descriptionSource: true,
      date: true,
      startTime: true,
      endTime: true,
      createdAt: true,
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      type: { select: { id: true, name: true } },
    },
  });

  if (targetUserId !== meUserId) {
    await createNotification({
      userId: targetUserId,
      type: "ACTIVITY_ASSIGNED",
      message: `Dodeljena vam je nova aktivnost: ${name}.`,
    });
  }

  return NextResponse.json({ activity: created }, { status: 201 });
}
