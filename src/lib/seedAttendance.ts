import { prisma } from "@/lib/prisma";

const DAYS_BACK = 60;
const ADMIN_EMAIL = "damjan@demo.com";
const ANOMALY_EMAIL = "vojislav@demo.com";
const ANOMALY_RECENT_WORKDAYS = 15;
const LOCAL_UTC_OFFSET_HOURS = 2;

const STATUS = { PRESENT: 1, ABSENT: 2, LATE: 3 };

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomLocalTimeAsUTC(
  dateStr: string,
  minH: number,
  minM: number,
  maxH: number,
  maxM: number
) {
  const startMinutes = minH * 60 + minM;
  const endMinutes = maxH * 60 + maxM;
  const totalMinLocal = randomInt(startMinutes, endMinutes);
  const totalMinUTC = totalMinLocal - LOCAL_UTC_OFFSET_HOURS * 60;
  const h = Math.floor(totalMinUTC / 60);
  const m = totalMinUTC % 60;
  return new Date(
    `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(
      2,
      "0"
    )}:00.000Z`
  );
}

function utcDateOnly(d: Date) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}
function isoDateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}
function isWeekend(d: Date) {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}
function rollNormalOutcome() {
  const r = Math.random();
  if (r < 0.85) return "ON_TIME";
  if (r < 0.97) return "LATE";
  return "ABSENT";
}
function buildAttendanceRow(dateStr: string, outcome: string) {
  if (outcome === "ABSENT") {
    return { startTime: null, endTime: null, statusId: STATUS.ABSENT };
  }
  if (outcome === "LATE") {
    return {
      startTime: randomLocalTimeAsUTC(dateStr, 14, 5, 16, 0),
      endTime: randomLocalTimeAsUTC(dateStr, 18, 0, 19, 30),
      statusId: STATUS.LATE,
    };
  }
  return {
    startTime: randomLocalTimeAsUTC(dateStr, 8, 0, 9, 30),
    endTime: randomLocalTimeAsUTC(dateStr, 16, 30, 18, 0),
    statusId: STATUS.PRESENT,
  };
}
function startOfWeekMonday(d: Date) {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const day = x.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}
function atUTC(dateObj: Date, hhmm: string) {
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(
    Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
      hh,
      mm,
      0
    )
  );
}
function dayOnlyUTC(dateObj: Date) {
  return new Date(
    Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate()
    )
  );
}

async function createActivityIfNotExists(opts: {
  userId: number;
  typeId: number;
  dateObj: Date;
  name: string;
  startHHMM: string;
  endHHMM: string;
  description?: string | null;
}) {
  const {
    userId,
    typeId,
    dateObj,
    name,
    startHHMM,
    endHHMM,
    description = null,
  } = opts;
  const startTime = atUTC(dateObj, startHHMM);
  const endTime = atUTC(dateObj, endHHMM);
  const date = dayOnlyUTC(dateObj);

  const exists = await prisma.activity.findFirst({
    where: { userId, name, startTime },
    select: { id: true },
  });
  if (exists) return;

  await prisma.activity.create({
    data: { userId, typeId, name, description, date, startTime, endTime },
  });
}

async function seedCurrentWeekActivities() {
  const typeWork = await prisma.activityType.findUnique({
    where: { name: "WORK" },
  });
  const typeMeeting = await prisma.activityType.findUnique({
    where: { name: "MEETING" },
  });
  const typePto = await prisma.activityType.findUnique({
    where: { name: "PTO" },
  });
  if (!typeWork || !typeMeeting || !typePto) return;

  const damjan = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });
  const vuk = await prisma.user.findUnique({
    where: { email: "vuk@demo.com" },
  });
  const vojislav = await prisma.user.findUnique({
    where: { email: "vojislav@demo.com" },
  });

  const weekMon = startOfWeekMonday(new Date());
  const tue = new Date(weekMon);
  tue.setUTCDate(tue.getUTCDate() + 1);
  const wed = new Date(weekMon);
  wed.setUTCDate(wed.getUTCDate() + 2);
  const thu = new Date(weekMon);
  thu.setUTCDate(thu.getUTCDate() + 3);
  const fri = new Date(weekMon);
  fri.setUTCDate(fri.getUTCDate() + 4);

  if (damjan) {
    await createActivityIfNotExists({
      userId: damjan.id,
      typeId: typeMeeting.id,
      dateObj: weekMon,
      name: "Standup",
      startHHMM: "09:30",
      endHHMM: "10:00",
    });
    await createActivityIfNotExists({
      userId: damjan.id,
      typeId: typeWork.id,
      dateObj: wed,
      name: "Sprint planning",
      startHHMM: "11:00",
      endHHMM: "12:00",
    });
    await createActivityIfNotExists({
      userId: damjan.id,
      typeId: typeMeeting.id,
      dateObj: thu,
      name: "1:1 meeting",
      startHHMM: "14:00",
      endHHMM: "14:30",
    });
  }
  if (vuk) {
    await createActivityIfNotExists({
      userId: vuk.id,
      typeId: typeMeeting.id,
      dateObj: tue,
      name: "Team sync",
      startHHMM: "10:00",
      endHHMM: "10:30",
    });
    await createActivityIfNotExists({
      userId: vuk.id,
      typeId: typeWork.id,
      dateObj: thu,
      name: "Code review",
      startHHMM: "15:00",
      endHHMM: "16:00",
    });
    await createActivityIfNotExists({
      userId: vuk.id,
      typeId: typePto.id,
      dateObj: fri,
      name: "PTO (half day)",
      startHHMM: "12:00",
      endHHMM: "16:00",
      description: "Personal time off",
    });
  }
  if (vojislav) {
    await createActivityIfNotExists({
      userId: vojislav.id,
      typeId: typeMeeting.id,
      dateObj: tue,
      name: "Team Building",
      startHHMM: "10:30",
      endHHMM: "11:30",
    });
    await createActivityIfNotExists({
      userId: vojislav.id,
      typeId: typeWork.id,
      dateObj: thu,
      name: "Thesis project",
      startHHMM: "14:00",
      endHHMM: "16:00",
    });
    await createActivityIfNotExists({
      userId: vojislav.id,
      typeId: typePto.id,
      dateObj: fri,
      name: "Code Debugging Class",
      startHHMM: "10:00",
      endHHMM: "13:00",
      description: "Personal time off",
    });
  }
}

export async function runAttendanceSeedIfNeeded() {
  const todayDateOnly = utcDateOnly(new Date());

  const state = await prisma.systemState.findUnique({ where: { id: 1 } });
  if (state?.lastSeedDate) {
    const lastSeed = utcDateOnly(new Date(state.lastSeedDate));
    if (lastSeed.getTime() === todayDateOnly.getTime()) {
      return; // već seedovano danas, ne radi nis
    }
  }

  await prisma.systemState.upsert({
    where: { id: 1 },
    update: { lastSeedDate: todayDateOnly },
    create: { id: 1, lastSeedDate: todayDateOnly },
  });

  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  const endDate = new Date(todayDateOnly);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - DAYS_BACK);

  const workdaysDesc: Date[] = [];
  for (
    let d = new Date(endDate);
    d >= startDate;
    d.setUTCDate(d.getUTCDate() - 1)
  ) {
    if (isWeekend(d)) continue;
    workdaysDesc.push(new Date(d));
  }

  for (const u of users) {
    const isAdmin = u.email === ADMIN_EMAIL;
    const isAnomaly = u.email === ANOMALY_EMAIL;
    let recentCounter = 0;

    for (const d of workdaysDesc) {
      recentCounter++;
      const dateStr = isoDateUTC(d);
      let row;

      if (isAdmin) {
        row = {
          startTime: randomLocalTimeAsUTC(dateStr, 8, 0, 9, 0),
          endTime: randomLocalTimeAsUTC(dateStr, 16, 30, 18, 0),
          statusId: STATUS.PRESENT,
        };
      } else if (isAnomaly && recentCounter <= ANOMALY_RECENT_WORKDAYS) {
        row = {
          startTime: randomLocalTimeAsUTC(dateStr, 6, 45, 7, 30),
          endTime: randomLocalTimeAsUTC(dateStr, 20, 0, 21, 30),
          statusId: STATUS.PRESENT,
        };
      } else {
        const outcome = rollNormalOutcome();
        row = buildAttendanceRow(dateStr, outcome);
      }

      await prisma.attendance.upsert({
        where: {
          userId_date: {
            userId: u.id,
            date: new Date(`${dateStr}T00:00:00.000Z`),
          },
        },
        update: row,
        create: {
          userId: u.id,
          date: new Date(`${dateStr}T00:00:00.000Z`),
          ...row,
        },
      });
    }
    await seedCurrentWeekActivities();
  }
}
