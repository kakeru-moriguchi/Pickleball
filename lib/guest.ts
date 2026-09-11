import type { NextRequest, NextResponse } from "next/server";

export const guestCookieName = "pickle_guest_id";

export function getGuestId(request: NextRequest) {
  const value = request.cookies.get(guestCookieName)?.value ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export function setGuestId(response: NextResponse, guestId: string) {
  response.cookies.set(guestCookieName, guestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
