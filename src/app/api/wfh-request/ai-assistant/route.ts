import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/auth.guard";
import { enforceCsrf } from "@/lib/security/csrf";
import { parseDateOnlyUTC, addDaysUTC } from "@/lib/date/date";
import { isBadWeather } from "@/lib/weather/wfh.utils";
import { askWfhAssistant, type DayWeatherFact } from "@/lib/AI/wfhAssistant";

const dayNamesSR = [
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
  "Nedelja",
];

export async function POST(req: Request) {
  const csrf = enforceCsrf(req);
  if (csrf) return csrf;

  const auth = requireAuth(req);
  if (auth instanceof Response) return auth;

  const userId = (auth as any).userId as number | undefined;
  if (typeof userId !== "number") {
    return NextResponse.json(
      { error: "Invalid token payload" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const question = (body?.question ?? "").toString().trim();
  const fromStr = body?.from;
  const toStr = body?.to;

  if (!question) {
    return NextResponse.json(
      { error: "question je obavezan" },
      { status: 400 }
    );
  }
  if (!fromStr || !toStr) {
    return NextResponse.json(
      { error: "from i to su obavezni (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const fromDate = parseDateOnlyUTC(fromStr);
  const toDate = parseDateOnlyUTC(toStr);
  if (!fromDate || !toDate) {
    return NextResponse.json(
      { error: "Neispravan format datuma" },
      { status: 400 }
    );
  }

  const endExclusive = addDaysUTC(toDate, 1);
  const locationKey = process.env.WEATHER_LOCATION_KEY ?? "BELGRADE_OFFICE";

  const weatherRows = await prisma.weatherDaily.findMany({
    where: { locationKey, date: { gte: fromDate, lt: endExclusive } },
    select: {
      date: true,
      tempMax: true,
      tempMin: true,
      precipSum: true,
      windMax: true,
      weatherCode: true,
    },
  });

  const weatherByDate = new Map(
    weatherRows.map((w) => [w.date.toISOString().slice(0, 10), w])
  );

  const days: DayWeatherFact[] = [];
  let cursor = new Date(fromDate);
  while (cursor < endExclusive) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const w = weatherByDate.get(dateStr);
    const dayIdx = (cursor.getUTCDay() + 6) % 7;

    days.push({
      date: dateStr,
      dayName: dayNamesSR[dayIdx],
      tempMin: w?.tempMin ?? null,
      tempMax: w?.tempMax ?? null,
      precipSum: w?.precipSum ?? null,
      windMax: w?.windMax ?? null,
      weatherCode: w?.weatherCode ?? null,
      meetsWfhCriteria: w ? isBadWeather(w) : false,
    });

    cursor = addDaysUTC(cursor, 1);
  }

  const result = await askWfhAssistant(question, days);
  return NextResponse.json(result);
}
