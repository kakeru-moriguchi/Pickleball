import { NextRequest, NextResponse } from "next/server";
import { getGuestId, setGuestId } from "@/lib/guest";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmin } from "@/lib/admin-notifications";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const currentGuestId = getGuestId(request);
  const guestId = currentGuestId ?? crypto.randomUUID();
  const { error } = await supabase.rpc("create_inquiry", {
    p_name: name,
    p_email: email,
    p_message: message,
    p_guest_id: guestId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await notifyAdmin({
    subject: "新しいお問い合わせ",
    text: `お名前: ${name}\n返信先: ${email}\n\n${message}\n\n管理画面: ${new URL("/", request.url).toString()}`,
    replyTo: email,
  });
  const response = NextResponse.json({ ok: true }, { status: 201 });
  if (!user && !currentGuestId) setGuestId(response, guestId);
  return response;
}
