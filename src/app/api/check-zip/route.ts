import { NextResponse } from "next/server";
import { get14YardPriceForZip } from "@/lib/pricing";

export async function POST(req: Request) {
  const { zip } = await req.json();

  const result = await get14YardPriceForZip(zip);

  return NextResponse.json(result);
}
