import { NextResponse } from "next/server";
import { serialize } from "cookie";
import crypto from "crypto";
import { buildGoogleAuthUrl } from "@/lib/auth/google";

const STATE_COOKIE = "oauth_state";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");

  const res = NextResponse.redirect(buildGoogleAuthUrl(state));

  res.headers.set(
    "Set-Cookie",
    serialize(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    })
  );

  return res;
}
