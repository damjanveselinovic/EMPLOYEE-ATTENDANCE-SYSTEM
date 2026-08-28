import { NextResponse } from "next/server";
import prismaModule from "@/lib/prisma";
import { requireRole } from "@/lib/auth/auth.guard";
import { getBurnoutRiskScore } from "@/lib/ml/burnoutModel.server";
const { prisma } = prismaModule;

// GET /api/admin/behavior-analysis
// GET je bezbedna (read-only) operacija - ne treba enforceCsrf, isti obrazac
// kao ostale GET rute u projektu.
export async function GET(req: Request) {
  const auth = await requireRole(req, ["ADMIN"]);
  if (auth instanceof Response) return auth;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const results = await Promise.all(
    users.map(async (u) => {
      const { riskScore, features } = await getBurnoutRiskScore(u.id);
      return {
        userId: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        riskScore,
        features,
      };
    })
  );

  results.sort((a, b) => b.riskScore - a.riskScore);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    results,
  });
}
