import { NextResponse } from "next/server";
import { serialize } from "cookie";
import crypto from "crypto";
import { requireAuth } from "@/lib/auth/auth.guard";
import { buildGoogleCalendarAuthUrl } from "@/lib/googleCalendar/googleCalendar.server";

const CALENDAR_STATE_COOKIE = "oauth_calendar_state";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const activityId = url.searchParams.get("activityId");

  if (!activityId || isNaN(Number(activityId))) {
    return NextResponse.json(
      { error: "activityId je obavezan" },
      { status: 400 }
    );
  }

  const random = crypto.randomBytes(16).toString("hex");
  const state = `${random}:${activityId}`;

  const res = NextResponse.redirect(buildGoogleCalendarAuthUrl(state));

  res.headers.set(
    "Set-Cookie",
    serialize(CALENDAR_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    })
  );

  return res;
}
