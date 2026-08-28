import { NextResponse } from "next/server";
import { parse, serialize } from "cookie";
import prismaModule from "@/lib/prisma";
const { prisma } = prismaModule;
import { readAuthTokenFromRequest, verifyToken } from "@/lib/auth/auth.server";
import {
  exchangeCalendarCodeForToken,
  syncActivityToGoogleCalendar,
} from "@/lib/googleCalendar/googleCalendar.server";

const CALENDAR_STATE_COOKIE = "oauth_calendar_state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const appOrigin = process.env.APP_ORIGIN || url.origin;

  if (error) {
    return NextResponse.redirect(`${appOrigin}/calendar?calendarSync=denied`);
  }

  const cookies = parse(req.headers.get("cookie") || "");
  const savedState = cookies[CALENDAR_STATE_COOKIE];

  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return NextResponse.redirect(
      `${appOrigin}/calendar?calendarSync=state_mismatch`
    );
  }

  const [, activityIdStr] = savedState.split(":");
  const activityId = Number(activityIdStr);

  const token = readAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.redirect(`${appOrigin}/login`);
  }

  let userId: number;
  try {
    const payload = verifyToken(token);
    userId = payload.userId;
  } catch {
    return NextResponse.redirect(`${appOrigin}/login`);
  }

  try {
    const tokenData = await exchangeCalendarCodeForToken(code);

    await prisma.user.update({
      where: { id: userId },
      data: {
        googleCalendarAccessToken: tokenData.access_token,
        googleCalendarRefreshToken: tokenData.refresh_token ?? undefined,
        googleCalendarTokenExpiry: new Date(
          Date.now() + tokenData.expires_in * 1000
        ),
      },
    });

    const result = await syncActivityToGoogleCalendar(activityId, userId);

    const res = NextResponse.redirect(
      `${appOrigin}/calendar?calendarSync=${result.ok ? "success" : "error"}`
    );
    res.headers.append(
      "Set-Cookie",
      serialize(CALENDAR_STATE_COOKIE, "", { path: "/", maxAge: 0 })
    );
    return res;
  } catch (e) {
    console.error("GOOGLE CALENDAR CALLBACK ERROR:", e);
    return NextResponse.redirect(`${appOrigin}/calendar?calendarSync=error`);
  }
}
