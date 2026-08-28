require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EMAILS_TO_DELETE = [
  "jelena.employee@demo.com",
  "nikola.employee@demo.com",
  "milan.admin@demo.com",
  "ivica@demo.com",
  "bisa@gmail.com",
  "orelj@demo.com",
  "gudelj@demo.com",
  "ivan@demo.com",
  "danilo@mail.com",
  "vasa@demo.com",
  "luka@gmail.com",
];

async function main() {
  console.log(`Brisem ${EMAILS_TO_DELETE.length} usera...\n`);

  const succeeded = [];
  const failed = [];

  for (const email of EMAILS_TO_DELETE) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      });

      if (!user) {
        console.log(`SKIP  ${email} - ne postoji u bazi`);
        continue;
      }

      await prisma.user.delete({ where: { id: user.id } });
      console.log(`OK    ${email} - obrisan`);
      succeeded.push(email);
    } catch (e) {
      console.log(
        `FAIL  ${email} - ${e.code ?? ""} ${e.message?.slice(0, 150)}`
      );
      failed.push({ email, error: e.code ?? e.message });
    }
  }

  console.log("\n--- Rezime ---");
  console.log(`Obrisano: ${succeeded.length}`);
  console.log(`Nije uspelo: ${failed.length}`);
  if (failed.length) {
    console.log(
      "\nOvi useri jos uvek imaju povezane podatke van Attendance (Activity/WfhRequest/Notification/AdminAction) - javi mi listu pa resavamo pojedinacno:"
    );
    failed.forEach((f) => console.log(`  - ${f.email}: ${f.error}`));
  }
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
