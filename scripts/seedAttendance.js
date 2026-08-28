require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

//////////////////////     node scripts/seedAttendance.js
const DAYS_BACK = 60; // ~2 meseca
const ADMIN_EMAIL = "damjan@demo.com"; // uvek na vreme, svaki dan
const ANOMALY_EMAIL = "vojislav@demo.com"; // burnout/anomaly test user
const ANOMALY_RECENT_WORKDAYS = 15; // koliko poslednjih radnih dana je "burnout" period

// Europe/Belgrade offset od UTC. Trenutno leto (CEST) = +2.
// VAZNO: ako period seedovanja ikad predje u zimsko racunanje vremena (~kraj oktobra), ovo treba da bude 1.
const LOCAL_UTC_OFFSET_HOURS = 2;

const STATUS = { PRESENT: 1, ABSENT: 2, LATE: 3 };

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// bira nasumicno LOKALNO vreme u opsegu [minH:minM, maxH:maxM] i konvertuje ga u UTC
// (isLateAfter14Local u pravoj app logici gleda lokalno vreme, pa seed mora da odgovara)
function randomLocalTimeAsUTC(dateStr, minH, minM, maxH, maxM) {
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

function utcDateOnly(d) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

function isoDateUTC(d) {
  return d.toISOString().slice(0, 10);
}

function isWeekend(d) {
  const day = d.getUTCDay(); // 0 = nedelja, 6 = subota
  return day === 0 || day === 6;
}

// 85% on time, 12% late, 3% absent
function rollNormalOutcome() {
  const r = Math.random();
  if (r < 0.85) return "ON_TIME";
  if (r < 0.97) return "LATE";
  return "ABSENT";
}

function buildAttendanceRow(dateStr, outcome) {
  if (outcome === "ABSENT") {
    return { startTime: null, endTime: null, statusId: STATUS.ABSENT };
  }
  if (outcome === "LATE") {
    // isLateAfter14Local: LATE = dolazak posle 14:00 lokalno
    return {
      startTime: randomLocalTimeAsUTC(dateStr, 14, 5, 16, 0),
      endTime: randomLocalTimeAsUTC(dateStr, 18, 0, 19, 30),
      statusId: STATUS.LATE,
    };
  }
  // ON_TIME - pre 14h lokalno, u skladu sa app logikom
  return {
    startTime: randomLocalTimeAsUTC(dateStr, 8, 0, 9, 30),
    endTime: randomLocalTimeAsUTC(dateStr, 16, 30, 18, 0),
    statusId: STATUS.PRESENT,
  };
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  const today = utcDateOnly(new Date());
  const endDate = new Date(today);
  endDate.setUTCDate(endDate.getUTCDate() - 1); // do juce (danas se preskace)

  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - DAYS_BACK);

  // radni dani od najnovijeg ka najstarijem (da bi "poslednjih N radnih dana" bilo tacno)
  const workdaysDesc = [];
  for (
    let d = new Date(endDate);
    d >= startDate;
    d.setUTCDate(d.getUTCDate() - 1)
  ) {
    if (isWeekend(d)) continue; // vikendi se ne diraju
    workdaysDesc.push(new Date(d));
  }

  let totalRows = 0;

  for (const u of users) {
    const isAdmin = u.email === ADMIN_EMAIL;
    const isAnomaly = u.email === ANOMALY_EMAIL;

    let recentCounter = 0;

    for (const d of workdaysDesc) {
      recentCounter++;
      const dateStr = isoDateUTC(d);

      let row;

      if (isAdmin) {
        // uvek na vreme, nikad odsutan/kasni
        row = {
          startTime: randomLocalTimeAsUTC(dateStr, 8, 0, 9, 0),
          endTime: randomLocalTimeAsUTC(dateStr, 16, 30, 18, 0),
          statusId: STATUS.PRESENT,
        };
      } else if (isAnomaly && recentCounter <= ANOMALY_RECENT_WORKDAYS) {
        // burnout period: dolazi rano, odlazi kasno, nikad odsutan
        row = {
          startTime: randomLocalTimeAsUTC(dateStr, 6, 45, 7, 30),
          endTime: randomLocalTimeAsUTC(dateStr, 20, 0, 21, 30),
          statusId: STATUS.PRESENT,
        };
      } else {
        // svi ostali (i anomaly user u starijem periodu): standardna raspodela
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
      totalRows++;
    }
  }

  console.log(
    `Gotovo. Upisano/azurirano ${totalRows} attendance redova za ${users.length} usera (poslednjih ${DAYS_BACK} dana, radni dani, bez danasnjeg, vikendi netaknuti).`
  );
  console.log(`Admin (uvek na vreme): ${ADMIN_EMAIL}`);
  console.log(
    `Anomaly user (poslednjih ${ANOMALY_RECENT_WORKDAYS} radnih dana ekstremno): ${ANOMALY_EMAIL}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
