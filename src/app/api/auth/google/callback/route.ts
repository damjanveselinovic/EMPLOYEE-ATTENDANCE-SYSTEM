import { NextResponse } from "next/server";
import { parse, serialize } from "cookie";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForToken, getGoogleUserInfo } from "@/lib/auth/google";
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
} from "@/lib/auth/auth.server";

const STATE_COOKIE = "oauth_state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const appOrigin = process.env.APP_ORIGIN || url.origin;

  if (error) {
    return NextResponse.redirect(`${appOrigin}/login?error=google_denied`);
  }

  const cookies = parse(req.headers.get("cookie") || "");
  const savedState = cookies[STATE_COOKIE];

  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return NextResponse.redirect(
      `${appOrigin}/login?error=google_state_mismatch`
    );
  }

  try {
    const tokenData = await exchangeCodeForToken(code);
    const profile = await getGoogleUserInfo(tokenData.access_token);

    if (!profile.email || !profile.email_verified) {
      return NextResponse.redirect(
        `${appOrigin}/login?error=google_email_unverified`
      );
    }

    let user = await prisma.user.findUnique({
      where: { email: profile.email },
      include: { role: true },
    });

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.sub,
            avatarUrl: profile.picture ?? user.avatarUrl,
          },
          include: { role: true },
        });
      }
    } else {
      const employeeRole = await prisma.userRole.findUnique({
        where: { name: "EMPLOYEE" },
      });
      if (!employeeRole) {
        return NextResponse.redirect(
          `${appOrigin}/login?error=server_misconfigured`
        );
      }

      user = await prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.given_name || "Google",
          lastName: profile.family_name || "User",
          googleId: profile.sub,
          avatarUrl: profile.picture,
          roleId: employeeRole.id,
          isActive: true,
        },
        include: { role: true },
      });
    }

    if (!user.isActive) {
      return NextResponse.redirect(`${appOrigin}/login?error=account_disabled`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signToken({ userId: user.id, role: user.role.name });

    const res = NextResponse.redirect(`${appOrigin}/attendance`);

    res.headers.append("Set-Cookie", clearAuthCookie());
    res.headers.append("Set-Cookie", setAuthCookie(token));
    res.headers.append(
      "Set-Cookie",
      serialize(STATE_COOKIE, "", { path: "/", maxAge: 0 })
    );

    return res;
  } catch (e: any) {
    console.error("GOOGLE OAUTH ERROR:", e);
    return NextResponse.redirect(`${appOrigin}/login?error=google_failed`);
  }
}
