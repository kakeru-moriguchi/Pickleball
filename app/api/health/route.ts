import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    return NextResponse.json(
      { status: "error", app: "ok", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase.from("practice_posts").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json(
      { status: "ok", app: "ok", database: "ok", checkedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Health check failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(
      { status: "error", app: "ok", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
