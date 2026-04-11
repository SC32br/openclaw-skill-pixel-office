export type CostReportRange = "day" | "week" | "month" | "all";

export interface CostReportBucket {
  costUsd: number;
  tokens: number;
  /** Для NanoBananaPro: число в `tokens` — количество генераций, не LLM-токены */
  volumeKind?: "tokens" | "generations";
}

export interface CostReportServiceExpenseRow {
  id: string;
  label: string;
  requests: number;
  tokens: number;
  costUsd: number;
}

/** Нормализованный отчёт для UI дашборда расходов. */
export interface CostReportPayload {
  range: CostReportRange;
  from: string;
  to: string;
  totals: CostReportBucket;
  serviceTotals: { requests: number; tokens: number; costUsd: number };
  serviceExpenses: CostReportServiceExpenseRow[];
  byAgent: Record<string, CostReportBucket>;
  byProvider: Record<string, CostReportBucket>;
  meta: {
    agentsDirReadable: boolean;
    filesScanned: number;
    assistantRows: number;
    estimatedCostRows?: number;
    costUsdSource?: "logged" | "estimated" | "mixed" | "none";
  };
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeBucketRecord(v: unknown): Record<string, CostReportBucket> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, CostReportBucket> = {};
  for (const [k, val] of Object.entries(v)) {
    if (!val || typeof val !== "object") continue;
    const b = val as Record<string, unknown>;
    const vk = b.volumeKind;
    out[k] = {
      tokens: Math.round(num(b.tokens)),
      costUsd: num(b.costUsd),
      volumeKind:
        vk === "generations" || vk === "tokens" ? vk : undefined,
    };
  }
  return out;
}

/**
 * Приводит ответ /api/openclaw/cost-report к безопасной форме (нет падений на undefined/NaN).
 * Поддерживает legacy-поле `heartbeat` вместо serviceTotals/serviceExpenses.
 */
export function normalizeCostReport(raw: unknown): CostReportPayload {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const totalsIn = r.totals as Record<string, unknown> | undefined;
  const totals: CostReportBucket = {
    tokens: Math.round(num(totalsIn?.tokens)),
    costUsd: num(totalsIn?.costUsd),
  };

  const metaIn = r.meta as Record<string, unknown> | undefined;
  const meta: CostReportPayload["meta"] = {
    agentsDirReadable: Boolean(metaIn?.agentsDirReadable),
    filesScanned: Math.round(num(metaIn?.filesScanned)),
    assistantRows: Math.round(num(metaIn?.assistantRows)),
    estimatedCostRows:
      metaIn?.estimatedCostRows !== undefined && metaIn?.estimatedCostRows !== null
        ? Math.round(num(metaIn.estimatedCostRows))
        : undefined,
    costUsdSource:
      metaIn?.costUsdSource === "logged" ||
      metaIn?.costUsdSource === "estimated" ||
      metaIn?.costUsdSource === "mixed" ||
      metaIn?.costUsdSource === "none"
        ? metaIn.costUsdSource
        : undefined,
  };

  let serviceTotalsRaw = r.serviceTotals as Record<string, unknown> | undefined;
  let serviceExpensesRaw = r.serviceExpenses;

  const hb = r.heartbeat;
  if (!serviceTotalsRaw && hb && typeof hb === "object") {
    const h = hb as Record<string, unknown>;
    const rows = Math.round(num(h.assistantRows));
    const tok = Math.round(num(h.tokens));
    const usd = num(h.costUsd);
    if (rows > 0 || tok > 0 || usd > 0) {
      serviceTotalsRaw = { requests: rows, tokens: tok, costUsd: usd };
      if (!Array.isArray(serviceExpensesRaw) || serviceExpensesRaw.length === 0) {
        serviceExpensesRaw = [
          {
            id: "heartbeat",
            label: "Heartbeat (ответ с HEARTBEAT*)",
            requests: rows,
            tokens: tok,
            costUsd: usd,
          },
        ];
      }
    }
  }

  const st = serviceTotalsRaw ?? { requests: 0, tokens: 0, costUsd: 0 };
  const serviceTotals: CostReportPayload["serviceTotals"] = {
    requests: Math.round(num(st.requests)),
    tokens: Math.round(num(st.tokens)),
    costUsd: num(st.costUsd),
  };

  let serviceExpenses: CostReportPayload["serviceExpenses"] = [];
  if (Array.isArray(serviceExpensesRaw)) {
    serviceExpenses = serviceExpensesRaw
      .filter((x) => x && typeof x === "object")
      .map((x) => {
        const row = x as Record<string, unknown>;
        return {
          id: String(row.id ?? "row"),
          label: String(row.label ?? ""),
          requests: Math.round(num(row.requests)),
          tokens: Math.round(num(row.tokens)),
          costUsd: num(row.costUsd),
        };
      })
      .filter((row) => row.requests > 0);
  }

  const rangeRaw = r.range;
  const range: CostReportRange =
    rangeRaw === "day" || rangeRaw === "week" || rangeRaw === "month" || rangeRaw === "all" ? rangeRaw : "week";

  return {
    range,
    from: typeof r.from === "string" ? r.from : new Date(0).toISOString(),
    to: typeof r.to === "string" ? r.to : new Date().toISOString(),
    totals,
    serviceTotals,
    serviceExpenses,
    byAgent: safeBucketRecord(r.byAgent),
    byProvider: safeBucketRecord(r.byProvider),
    meta,
  };
}
