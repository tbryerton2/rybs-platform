import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function isYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function addDaysYmd(value: string, days: number) {
  const date = parseYmd(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayYmdUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = (url.searchParams.get("start") || "").trim();
  const rawDays = Number(url.searchParams.get("days") || 0);
  const days = Math.min(186, Math.max(28, Math.floor(rawDays || 112)));

  if (!isYmd(start)) {
    return NextResponse.json({ ok: false, error: "Invalid start date" }, { status: 400 });
  }

  const today = todayYmdUtc();

  try {
    const dates = Array.from({ length: days }, (_, index) => addDaysYmd(start, index));
    const results = await Promise.all(
      dates.map(async (date) => {
        const { data, error } = await supabase.rpc("get_delivery_availability", {
          p_delivery_date: date,
          p_days: 7,
        });

        if (error) {
          throw new Error(error.message);
        }

        const row = data?.[0];
        const capacity = Number(row?.capacity ?? 0);
        const used = Number(row?.used ?? 0);
        const remaining = Math.max(0, Number(row?.remaining ?? capacity - used));

        let state: "available" | "limited" | "unavailable" | "past" = "unavailable";
        if (date < today) {
          state = "past";
        } else if (remaining <= 0) {
          state = "unavailable";
        } else if (remaining <= 1) {
          state = "limited";
        } else {
          state = "available";
        }

        return {
          date,
          capacity,
          used,
          remaining,
          state,
        };
      }),
    );

    const nextAvailableDate =
      results.find((entry) => entry.state === "available" || entry.state === "limited")?.date ?? null;

    return NextResponse.json({
      ok: true,
      start,
      days,
      nextAvailableDate,
      dates: results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar availability check failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
