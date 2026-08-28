require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// exit 0 = baza vec ima usere (preskoci seed)
// exit 1 = baza je prazna (pokreni seed)
main()
  .then((count) => {
    process.exit(count > 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error("checkIfSeeded error:", e.message);
    // ako provera ne uspe, bezbednije je da NE seedujemo automatski
    process.exit(0);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

async function main() {
  return prisma.user.count();
}
