require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function startOfWeekMonday(d) {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const day = x.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; //pomeri na ponedeljak
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}
function atUTC(dateObj, hhmm) {
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
function dayOnlyUTC(dateObj) {
  return new Date(
    Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate()
    )
  );
}

async function upsertLookup(model, name) {
  // model = prisma.userRole / prisma.activityType / prisma.attendanceStatus
  return model.upsert({
    where: { name },
    update: {},
    create: { name },
    select: { id: true, name: true },
  });
}

async function upsertUser({
  firstName,
  lastName,
  email,
  password,
  roleId,
  departmentId,
}) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      roleId,
      departmentId,
      isActive: true,
    },
    create: {
      firstName,
      lastName,
      email,
      passwordHash,
      roleId,
      departmentId,
      isActive: true,
    },
    select: { id: true, email: true },
  });
}

async function createActivityIfNotExists({
  userId,
  typeId,
  dateObj,
  name,
  startHHMM,
  endHHMM,
  description = null,
}) {
  const startTime = atUTC(dateObj, startHHMM);
  const endTime = atUTC(dateObj, endHHMM);
  const date = dayOnlyUTC(dateObj);

  const exists = await prisma.activity.findFirst({
    where: { userId, name, startTime },
    select: { id: true },
  });
  if (exists) return;

  await prisma.activity.create({
    data: {
      userId,
      typeId,
      name,
      description,
      date,
      startTime,
      endTime,
    },
  });
}

async function main() {
  // ---------- lookups ----------
  const roleAdmin = await upsertLookup(prisma.userRole, "ADMIN");
  const roleManager = await upsertLookup(prisma.userRole, "MANAGER");
  const roleEmployee = await upsertLookup(prisma.userRole, "EMPLOYEE");

  await upsertLookup(prisma.attendanceStatus, "PRESENT");
  await upsertLookup(prisma.attendanceStatus, "ABSENT");
  await upsertLookup(prisma.attendanceStatus, "LATE");

  const typeWork = await upsertLookup(prisma.activityType, "WORK");
  const typeMeeting = await upsertLookup(prisma.activityType, "MEETING");
  const typePto = await upsertLookup(prisma.activityType, "PTO");
  await upsertLookup(prisma.activityType, "TEAMBUILDING");

  // ---------- users (finalna lista - januar 2026 cleanup) ----------
  // Damjan = ADMIN (default admin)
  const damjan = await upsertUser({
    firstName: "Damjan",
    lastName: "Veselinovic",
    email: "damjan@demo.com",
    password: "Admin123!",
    roleId: roleAdmin.id,
  });

  // Vuk = MANAGER
  const vuk = await upsertUser({
    firstName: "Vuk",
    lastName: "Vasiljevic",
    email: "vuk@demo.com",
    password: "Vuk123@",
    roleId: roleManager.id,
  });

  // Mina = MANAGER
  await upsertUser({
    firstName: "Mina",
    lastName: "Milosavljevic",
    email: "minamilo@demo.com",
    password: "Mina123@",
    roleId: roleManager.id,
  });

  // Vojislav = EMPLOYEE (anomaly/burnout test user u seedAttendance.js)
  await upsertUser({
    firstName: "Vojislav",
    lastName: "Buduric",
    email: "vojislav@demo.com",
    password: "Vojislav123@",
    roleId: roleEmployee.id,
  });

  // ---------- activities (this week) ----------
  const weekMon = startOfWeekMonday(new Date());
  const tue = new Date(weekMon);
  tue.setUTCDate(tue.getUTCDate() + 1);
  const wed = new Date(weekMon);
  wed.setUTCDate(wed.getUTCDate() + 2);
  const thu = new Date(weekMon);
  thu.setUTCDate(thu.getUTCDate() + 3);
  const fri = new Date(weekMon);
  fri.setUTCDate(fri.getUTCDate() + 4);

  // Damjan activities (ADMIN)
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

  // Vuk activities (MANAGER)
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

  // NAPOMENA: Attendance vise NE seeduje ovaj fajl - vidi scripts/seedAttendance.js
}

(async () => {
  try {
    await main();
    console.log("Seed finished (users + activities only)");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})();
