import "server-only";
import { prisma } from "@/lib/prisma";
import { parseDateOnlyUTC, addDaysUTC, toISODateUTC } from "@/lib/date/date";

type NagerHoliday = {
  date: string; // YYYY-MM-DD
  localName?: string;
  name: string;
};

function yearsInRange(fromDt: Date, toDt: Date): number[] {
  const y1 = fromDt.getUTCFullYear();
  const y2 = toDt.getUTCFullYear();
  const years: number[] = [];
  for (let y = y1; y <= y2; y++) years.push(y);
  return years;
}

async function fetchNagerYear(
  country: string,
  year: number
): Promise<NagerHoliday[]> {
  // Nager: https://date.nager.at/api
  const res = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Nager fetch failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as NagerHoliday[];
  return Array.isArray(data) ? data : [];
}

export async function syncHolidaysForYear(country: string, year: number) {
  const nager = await fetchNagerYear(country, year);

  let upserts = 0;

  for (const h of nager) {
    const dt = parseDateOnlyUTC(h.date);
    if (!dt) continue;

    await prisma.holiday.upsert({
      where: { country_date: { country, date: dt } }, // <--- COMPOSITE UNIQUE
      create: {
        country,
        date: dt,
        name: h.localName?.trim() || h.name,
        source: "nager",
      },
      update: {
        name: h.localName?.trim() || h.name,
      },
    });

    upserts++;
  }

  return { upserts };
}

export async function ensureHolidaysInDb(
  country: string,
  fromDt: Date,
  toDt: Date
) {
  const years = yearsInRange(fromDt, toDt);

  for (const y of years) {
    const start = parseDateOnlyUTC(`${y}-01-01`)!;
    const endExclusive = addDaysUTC(parseDateOnlyUTC(`${y}-12-31`)!, 1);

    const count = await prisma.holiday.count({
      where: { country, date: { gte: start, lt: endExclusive } },
    });

    if (count === 0) {
      await syncHolidaysForYear(country, y);
    }
  }
}
