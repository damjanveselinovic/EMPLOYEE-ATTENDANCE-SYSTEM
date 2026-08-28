import prismaModule from "@/lib/prisma";
const { prisma } = prismaModule;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export function buildGoogleCalendarAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI!,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCalendarCodeForToken(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Calendar token exchange failed: ${await res.text()}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Calendar token refresh failed: ${await res.text()}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

// Vraća validan access token za korisnika (osveži ako je istekao), ili null ako korisnik nikad nije povezao Calendar.
async function getValidAccessTokenForUser(
  userId: number
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleCalendarAccessToken: true,
      googleCalendarRefreshToken: true,
      googleCalendarTokenExpiry: true,
    },
  });

  if (!user?.googleCalendarRefreshToken) return null;

  const isExpired =
    !user.googleCalendarTokenExpiry ||
    user.googleCalendarTokenExpiry.getTime() < Date.now() + 60_000;

  if (!isExpired && user.googleCalendarAccessToken) {
    return user.googleCalendarAccessToken;
  }

  const refreshed = await refreshAccessToken(user.googleCalendarRefreshToken);

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleCalendarAccessToken: refreshed.access_token,
      googleCalendarTokenExpiry: new Date(
        Date.now() + refreshed.expires_in * 1000
      ),
    },
  });

  return refreshed.access_token;
}

async function upsertCalendarEvent(
  accessToken: string,
  existingEventId: string | null,
  event: {
    summary: string;
    description?: string | null;
    startISO: string;
    endISO: string;
  }
): Promise<string> {
  const url = existingEventId
    ? `${GOOGLE_CALENDAR_EVENTS_URL}/${existingEventId}`
    : GOOGLE_CALENDAR_EVENTS_URL;

  const res = await fetch(url, {
    method: existingEventId ? "PUT" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description ?? undefined,
      start: { dateTime: event.startISO },
      end: { dateTime: event.endISO },
    }),
  });

  if (!res.ok) {
    throw new Error(`Google Calendar event upsert failed: ${await res.text()}`);
  }

  const data = await res.json();
  return data.id as string;
}

// Glavna funkcija - sinhronizuje JEDNU aktivnost (mora pripadati datom userId).
export async function syncActivityToGoogleCalendar(
  activityId: number,
  userId: number
): Promise<{ ok: true; googleEventId: string } | { ok: false; error: string }> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      name: true,
      description: true,
      startTime: true,
      endTime: true,
      userId: true,
      googleEventId: true,
    },
  });

  if (!activity || activity.userId !== userId) {
    return { ok: false, error: "Aktivnost nije pronađena." };
  }

  const accessToken = await getValidAccessTokenForUser(userId);
  if (!accessToken) {
    return { ok: false, error: "not_connected" };
  }

  const googleEventId = await upsertCalendarEvent(
    accessToken,
    activity.googleEventId,
    {
      summary: activity.name,
      description: activity.description,
      startISO: activity.startTime.toISOString(),
      endISO: activity.endTime.toISOString(),
    }
  );

  await prisma.activity.update({
    where: { id: activityId },
    data: { googleEventId },
  });

  return { ok: true, googleEventId };
}
