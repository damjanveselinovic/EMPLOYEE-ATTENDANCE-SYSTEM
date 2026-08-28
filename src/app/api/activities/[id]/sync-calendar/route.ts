import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth.guard";
import { enforceCsrf } from "@/lib/security/csrf";
import { syncActivityToGoogleCalendar } from "@/lib/googleCalendar/googleCalendar.server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = enforceCsrf(req);
  if (csrf) return csrf;

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const activityId = Number(id);
  if (isNaN(activityId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const userId = Number((auth as any).userId);

  const result = await syncActivityToGoogleCalendar(activityId, userId);

  if (!result.ok) {
    if (result.error === "not_connected") {
      return NextResponse.json({ error: "not_connected" }, { status: 409 });
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    { googleEventId: result.googleEventId },
    { status: 200 }
  );
}
