import { NextRequest, NextResponse } from "next/server";
import { aggregateJsonlCosts, type RangeParam } from "@/lib/jsonlCostAggregate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rangeParam = (req.nextUrl.searchParams.get("range") || "week") as RangeParam;
  const range: RangeParam = ["day", "week", "month", "all"].includes(rangeParam)
    ? rangeParam
    : "week";

  const data = await aggregateJsonlCosts(range);
  return NextResponse.json(data);
}
