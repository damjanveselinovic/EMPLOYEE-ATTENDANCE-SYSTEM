import prismaModule from "@/lib/prisma";
const { prisma } = prismaModule;

/**
 * Racuna feature vektor za burnout/anomaly model iz Attendance podataka.
 * Formule MORAJU tacno da odgovaraju ml/generate_synthetic_data.py (compute_features)
 * i ml/FEATURES.md - ako se ovo razmimoidje sa Python stranom, model dobija ulaze
 * razlicite prirode od onih na kojima je treniran.
 */

const RECENT_DAYS = 15;
const BASELINE_DAYS = 30;
const TOTAL_WORKDAYS = RECENT_DAYS + BASELINE_DAYS;

// Europe/Belgrade offset od UTC. Trenutno leto (CEST) = +2.
// Isti hardkodovan offset kao u scripts/seedAttendance.js - ako se ikad pravi
// analiza koja prelazi u zimsko racunanje vremena, ovo treba promeniti u 1.
const LOCAL_UTC_OFFSET_HOURS = 2;

const STATUS = { PRESENT: 1, ABSENT: 2, LATE: 3 } as const;

// Redosled MORA da se poklapa sa "feature_order" u src/lib/ml/models/feature_schema.json
export const FEATURE_ORDER = [
  "avg_hours_recent",
  "avg_hours_baseline",
  "hours_deviation",
  "pct_late_recent",
  "pct_absent_recent",
  "avg_arrival_hour_recent",
  "arrival_time_std_dev_recent",
  "trend_slope",
] as const;

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay(); // 0 = nedelja, 6 = subota
  return day === 0 || day === 6;
}

function utcDateOnly(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// UTC Date -> lokalni sat kao decimalni broj (npr. 8:30 -> 8.5)
function toLocalHoursDecimal(date: Date): number {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  let local = utcHours + LOCAL_UTC_OFFSET_HOURS;
  if (local >= 24) local -= 24;
  return local;
}

type DayRecord = { arrivalHour: number; hoursWorked: number } | null;

type AttendanceRow = {
  date: Date;
  startTime: Date | null;
  endTime: Date | null;
  statusId: number;
};

/**
 * Vraca feature vektor (niz od 8 brojeva, u redosledu FEATURE_ORDER) za datog usera,
 * na osnovu poslednjih TOTAL_WORKDAYS (45) radnih dana, bez danasnjeg dana.
 */
export async function computeUserFeatures(userId: number): Promise<number[]> {
  const today = utcDateOnly(new Date());
  const endDate = new Date(today);
  endDate.setUTCDate(endDate.getUTCDate() - 1); // do juce (danasnji dan se ne racuna)

  // radni dani unazad od juce, najskoriji prvi, dok ih ne bude TOTAL_WORKDAYS
  const workdayDates: Date[] = [];
  const cursor = new Date(endDate);
  while (workdayDates.length < TOTAL_WORKDAYS) {
    if (!isWeekend(cursor)) {
      workdayDates.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const rangeStart = workdayDates[workdayDates.length - 1]; // najstariji
  const rangeEnd = workdayDates[0]; // najskoriji

  const rows: AttendanceRow[] = await prisma.attendance.findMany({
    where: {
      userId,
      date: { gte: rangeStart, lte: rangeEnd },
    },
    select: { date: true, startTime: true, endTime: true, statusId: true },
  });

  const rowByDate = new Map<string, AttendanceRow>();
  for (const r of rows) {
    rowByDate.set(dateKey(r.date), r);
  }

  // recent = prvih 15 (najskorijih), baseline = ostatak
  const recentDates = workdayDates.slice(0, RECENT_DAYS);
  const baselineDates = workdayDates.slice(RECENT_DAYS);

  function toDayRecord(d: Date): DayRecord {
    const row = rowByDate.get(dateKey(d));
    if (
      !row ||
      row.statusId === STATUS.ABSENT ||
      !row.startTime ||
      !row.endTime
    ) {
      return null; // odsutan ili nema podataka - tretira se isto
    }
    return {
      arrivalHour: toLocalHoursDecimal(row.startTime),
      hoursWorked:
        (row.endTime.getTime() - row.startTime.getTime()) / 3_600_000,
    };
  }

  const recentRecords = recentDates.map(toDayRecord);
  const baselineRecords = baselineDates.map(toDayRecord);

  function avgHours(records: DayRecord[]): number {
    const worked = records
      .filter((r): r is NonNullable<DayRecord> => r !== null)
      .map((r) => r.hoursWorked);
    if (worked.length === 0) return 0;
    return worked.reduce((a, b) => a + b, 0) / worked.length;
  }

  const avg_hours_recent = avgHours(recentRecords);
  const avg_hours_baseline = avgHours(baselineRecords);
  const hours_deviation = avg_hours_recent - avg_hours_baseline;

  // LATE/ABSENT racunamo iz stvarnog statusId (postavljenog u check-in ruti preko
  // isLateAfter14Local), ne iz vremena - da bude 1:1 usaglaseno sa app logikom
  let lateCount = 0;
  let absentCount = 0;
  for (const d of recentDates) {
    const row = rowByDate.get(dateKey(d));
    if (!row || row.statusId === STATUS.ABSENT) {
      absentCount++;
    } else if (row.statusId === STATUS.LATE) {
      lateCount++;
    }
  }
  const pct_late_recent = lateCount / RECENT_DAYS;
  const pct_absent_recent = absentCount / RECENT_DAYS;

  const arrivalsRecent = recentRecords
    .filter((r): r is NonNullable<DayRecord> => r !== null)
    .map((r) => r.arrivalHour);

  let avg_arrival_hour_recent = 0;
  let arrival_time_std_dev_recent = 0;
  if (arrivalsRecent.length > 0) {
    avg_arrival_hour_recent =
      arrivalsRecent.reduce((a, b) => a + b, 0) / arrivalsRecent.length;
    if (arrivalsRecent.length > 1) {
      const variance =
        arrivalsRecent.reduce(
          (sum, h) => sum + (h - avg_arrival_hour_recent) ** 2,
          0
        ) / arrivalsRecent.length;
      arrival_time_std_dev_recent = Math.sqrt(variance);
    }
  }

  // trend_slope: nagib linearne regresije (dan_indeks 0..14, hronoloski -> radni sati)
  const chronological = [...recentRecords].reverse(); // najstariji -> najskoriji
  const points: { x: number; y: number }[] = [];
  chronological.forEach((r, idx) => {
    if (r !== null) points.push({ x: idx, y: r.hoursWorked });
  });

  let trend_slope = 0;
  if (points.length >= 2) {
    const n = points.length;
    const sumX = points.reduce((a, p) => a + p.x, 0);
    const sumY = points.reduce((a, p) => a + p.y, 0);
    const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
    const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
    const denom = n * sumXX - sumX * sumX;
    if (denom !== 0) {
      trend_slope = (n * sumXY - sumX * sumY) / denom;
    }
  }

  return [
    avg_hours_recent,
    avg_hours_baseline,
    hours_deviation,
    pct_late_recent,
    pct_absent_recent,
    avg_arrival_hour_recent,
    arrival_time_std_dev_recent,
    trend_slope,
  ];
}
