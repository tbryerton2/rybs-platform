import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { holdId } = await req.json();

  if (!holdId) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("booking_holds")
    .select("id, expires_at, status")
    .eq("id", holdId)
    .single();

  if (error || !data) {
    return NextResponse.json({ valid: false });
  }

  const now = new Date();
  const expires = new Date(data.expires_at);

  const valid = data.status === "active" && expires > now;

  return NextResponse.json({ valid });
}