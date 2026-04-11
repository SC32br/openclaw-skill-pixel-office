import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
import { canonicalDashboardAgentId } from "@/lib/agentFolderMap";

export type RangeParam = "day" | "week" | "month" | "all";

export function resolveAgentsDir(): string {
  if (process.env.OPENCLAW_AGENTS_DIR) {
    return path.resolve(process.env.OPENCLAW_AGENTS_DIR);
  }
  const base = process.env.OPENCLAW_HOME
    ? path.resolve(process.env.OPENCLAW_HOME)
    : path.join(os.homedir(), ".openclaw");
  return path.join(base, "agents");
}

export function rangeToFromMs(range: RangeParam): number {
  const now = Date.now();
  switch (range) {
    case "day":
      return now - 24 * 60 * 60 * 1000;
    case "week":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "month":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "all":
      return 0;
    default:
      return now - 7 * 24 * 60 * 60 * 1000;
  }
}

/** Идентификаторы строк таблицы «Служебные расходы». */
export type ServiceExpenseKind = "heartbeat" | "silent_no_reply";

export const SERVICE_EXPENSE_LABELS: Record<ServiceExpenseKind, string> = {
  heartbeat: "Heartbeat (ответ с HEARTBEAT*)",
  silent_no_reply: "Тихий ответ (NO_REPLY)",
};

interface UsageRow {
  ts: number;
  costUsd: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  /** Ключ строки «По площадкам» (провайдер или id модели для openrouter / nanobananapro). */
  provider: string;
  usedEstimate: boolean;
  /** Для NanoBananaPro: одна строка лога = одна генерация; токены в суммах не копятся. */
  volumeKind: "tokens" | "generations";
  /** Взаимоисключающая классификация служебного ответа assistant. */
  serviceKind: ServiceExpenseKind | null;
}

const NANO_BANANA_MODEL_SUBSTR = "gemini-3-pro-image-preview";

function isNanoBananaModel(model: string): boolean {
  return model.includes(NANO_BANANA_MODEL_SUBSTR);
}

function nanoBananaUsdPerGeneration(): number {
  const v = Number(process.env.NANO_BANANA_PRO_USD_PER_GEN ?? 0.05);
  return Number.isFinite(v) && v >= 0 ? v : 0.05;
}

/** Старые логи с preview free сливаем в одну строку с plus:free в дашборде. */
function canonicalOpenRouterModelId(model: string): string {
  if (model === "qwen/qwen3.6-plus-preview:free") return "qwen/qwen3.6-plus:free";
  return model;
}

/** Ключ агрегации по площадкам: openrouter → id модели; image → nanobananapro. */
function providerAggregationKey(provider: string, model: string): string {
  if (isNanoBananaModel(model)) return "nanobananapro";
  if (provider === "openrouter" && model) return canonicalOpenRouterModelId(model);
  if (!provider) return "unknown";
  return provider;
}

function readPricingPerM() {
  return {
    input: Number(process.env.OPENCLAW_COST_INPUT_PER_M ?? 3),
    output: Number(process.env.OPENCLAW_COST_OUTPUT_PER_M ?? 15),
    cacheRead: Number(process.env.OPENCLAW_COST_CACHE_READ_PER_M ?? 0.3),
    cacheWrite: Number(process.env.OPENCLAW_COST_CACHE_WRITE_PER_M ?? 3.75),
  };
}

function estimateCostUsdFromTokenUsage(usage: Record<string, unknown>): number {
  const input = typeof usage.input === "number" ? usage.input : 0;
  const output = typeof usage.output === "number" ? usage.output : 0;
  const cacheRead = typeof usage.cacheRead === "number" ? usage.cacheRead : 0;
  const cacheWrite = typeof usage.cacheWrite === "number" ? usage.cacheWrite : 0;
  const p = readPricingPerM();
  return (
    (input / 1e6) * p.input +
    (output / 1e6) * p.output +
    (cacheRead / 1e6) * p.cacheRead +
    (cacheWrite / 1e6) * p.cacheWrite
  );
}

function parseLoggedCostUsd(usage: Record<string, unknown>): number {
  const raw = usage.cost;
  // OpenRouter иногда отдаёт usage.cost числом (кредиты); локальный лог может хранить объектом.
  if (typeof raw === "number" && raw > 0) return raw;
  const costObj = raw as Record<string, unknown> | undefined;
  if (!costObj || typeof costObj !== "object") return 0;
  if (typeof costObj.total === "number" && costObj.total > 0) {
    return costObj.total;
  }
  let sum = 0;
  for (const k of ["input", "output", "cacheRead", "cacheWrite"] as const) {
    const v = costObj[k];
    if (typeof v === "number") sum += v;
  }
  return sum;
}

/** Бесплатные модели OpenRouter (:free) — реальная стоимость в биллинге $0; не оценивать по токенам как Claude. */
function isOpenRouterFreeTier(provider: string, model: string): boolean {
  return provider === "openrouter" && model.includes(":free");
}

/** Сообщения HEARTBEAT / HEARTBEAT_OK — служебный цикл heartbeat. */
function isHeartbeatAssistantMessage(msg: Record<string, unknown>): boolean {
  const c = msg.content;
  if (!Array.isArray(c)) return false;
  for (const block of c) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string" && /HEARTBEAT/i.test(b.text)) {
      return true;
    }
  }
  return false;
}

function getFirstAssistantTextBlock(msg: Record<string, unknown>): string | null {
  const c = msg.content;
  if (!Array.isArray(c)) return null;
  for (const block of c) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string") return b.text;
  }
  return null;
}

function classifyServiceAssistant(msg: Record<string, unknown>): ServiceExpenseKind | null {
  if (isHeartbeatAssistantMessage(msg)) return "heartbeat";
  const first = getFirstAssistantTextBlock(msg);
  if (first && /^\s*NO_REPLY\b/i.test(first)) return "silent_no_reply";
  return null;
}

function extractAssistantUsage(row: unknown): UsageRow | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  if (o.type !== "message") return null;
  const tsRaw = o.timestamp;
  const ts =
    typeof tsRaw === "string"
      ? Date.parse(tsRaw)
      : typeof tsRaw === "number"
        ? tsRaw
        : NaN;
  if (!Number.isFinite(ts)) return null;

  const msg = o.message as Record<string, unknown> | undefined;
  if (!msg || msg.role !== "assistant") return null;

  const model = typeof msg.model === "string" ? msg.model : "";
  const stopReason = typeof msg.stopReason === "string" ? msg.stopReason : "";

  if (isNanoBananaModel(model)) {
    if (stopReason === "error") return null;
    const serviceKind = classifyServiceAssistant(msg);
    return {
      ts,
      costUsd: nanoBananaUsdPerGeneration(),
      tokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      provider: "nanobananapro",
      usedEstimate: false,
      volumeKind: "generations",
      serviceKind,
    };
  }

  const usage = msg.usage as Record<string, unknown> | undefined;
  if (!usage) return null;

  let provider = typeof msg.provider === "string" ? msg.provider : "";
  if (!provider && typeof msg.api === "string") {
    provider = msg.api.split("-")[0] ?? "";
  }
  if (!provider) provider = "unknown";

  const logged = parseLoggedCostUsd(usage);
  const estimated = estimateCostUsdFromTokenUsage(usage);
  let usedEstimate = logged <= 0 && estimated > 0;
  let costUsd = logged > 0 ? logged : estimated;
  if (isOpenRouterFreeTier(provider, model)) {
    costUsd = logged > 0 ? logged : 0;
    usedEstimate = false;
  }
  const serviceKind = classifyServiceAssistant(msg);

  const inputRaw = typeof usage.input === "number" ? usage.input : 0;
  const outputRaw = typeof usage.output === "number" ? usage.output : 0;
  const cacheRead = typeof usage.cacheRead === "number" ? usage.cacheRead : 0;
  const cacheWrite = typeof usage.cacheWrite === "number" ? usage.cacheWrite : 0;
  const inputTokens = inputRaw + cacheRead + cacheWrite;
  const outputTokens = outputRaw;

  const tokens =
    typeof usage.totalTokens === "number"
      ? usage.totalTokens
      : inputRaw + outputRaw;

  const aggKey = providerAggregationKey(provider, model);

  return {
    ts,
    costUsd,
    tokens,
    inputTokens,
    outputTokens,
    provider: aggKey,
    usedEstimate,
    volumeKind: "tokens",
    serviceKind,
  };
}

async function listSessionFiles(agentsRoot: string): Promise<{ agentId: string; file: string }[]> {
  const out: { agentId: string; file: string }[] = [];
  let dirEntries: fs.Dirent[];
  try {
    dirEntries = await fs.promises.readdir(agentsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const a of dirEntries) {
    if (!a.isDirectory()) continue;
    const sessDir = path.join(agentsRoot, a.name, "sessions");
    try {
      const files = await fs.promises.readdir(sessDir);
      for (const f of files) {
        if (f.endsWith(".jsonl")) {
          out.push({ agentId: a.name, file: path.join(sessDir, f) });
        }
      }
    } catch {
      /* no sessions */
    }
  }
  return out;
}

async function parseSessionFile(
  filePath: string,
  agentId: string,
  fromMs: number,
  onRow: (agentId: string, row: UsageRow) => void,
): Promise<void> {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const rec = extractAssistantUsage(parsed);
    if (!rec || rec.ts < fromMs) continue;
    if (rec.ts > Date.now() + 60_000) continue;
    onRow(agentId, rec);
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const ALL_SERVICE_KINDS: ServiceExpenseKind[] = ["heartbeat", "silent_no_reply"];

export async function aggregateJsonlCosts(range: RangeParam) {
  const fromMs = rangeToFromMs(range);
  const toMs = Date.now();
  const agentsDir = resolveAgentsDir();

  const byAgent: Record<string, { costUsd: number; tokens: number }> = {};
  const byAgentIO: Record<string, { inputTokens: number; outputTokens: number }> = {};
  const byProvider: Record<
    string,
    { costUsd: number; tokens: number; volumeKind?: "tokens" | "generations" }
  > = {};

  const serviceBuckets: Record<ServiceExpenseKind, { requests: number; tokens: number; costUsd: number }> = {
    heartbeat: { requests: 0, tokens: 0, costUsd: 0 },
    silent_no_reply: { requests: 0, tokens: 0, costUsd: 0 },
  };

  let filesScanned = 0;
  let linesMatched = 0;
  let estimatedRows = 0;

  function bump(
    map: Record<string, { costUsd: number; tokens: number }>,
    key: string,
    costUsd: number,
    tokens: number,
  ) {
    if (!map[key]) map[key] = { costUsd: 0, tokens: 0 };
    map[key].costUsd += costUsd;
    map[key].tokens += tokens;
  }

  function bumpProviderRow(
    key: string,
    costUsd: number,
    tokenOrGenCount: number,
    vk: "tokens" | "generations",
  ) {
    if (!byProvider[key]) {
      byProvider[key] = { costUsd: 0, tokens: 0, volumeKind: vk };
    }
    const b = byProvider[key];
    b.costUsd += costUsd;
    b.tokens += tokenOrGenCount;
    if (!b.volumeKind) b.volumeKind = vk;
  }

  function bumpIO(
    key: string,
    inputTokens: number,
    outputTokens: number,
  ) {
    if (!byAgentIO[key]) byAgentIO[key] = { inputTokens: 0, outputTokens: 0 };
    byAgentIO[key].inputTokens += inputTokens;
    byAgentIO[key].outputTokens += outputTokens;
  }

  let dirOk = true;
  try {
    await fs.promises.access(agentsDir, fs.constants.R_OK);
  } catch {
    dirOk = false;
  }

  if (dirOk) {
    const files = await listSessionFiles(agentsDir);
    for (const { agentId, file } of files) {
      filesScanned++;
      await parseSessionFile(file, agentId, fromMs, (folderId, row) => {
        linesMatched++;
        if (row.usedEstimate) estimatedRows++;
        const dashId = canonicalDashboardAgentId(folderId);
        bump(byAgent, dashId, row.costUsd, row.tokens);
        bumpIO(dashId, row.inputTokens, row.outputTokens);
        if (row.volumeKind === "generations") {
          bumpProviderRow(row.provider, row.costUsd, 1, "generations");
        } else {
          bumpProviderRow(row.provider, row.costUsd, row.tokens, "tokens");
        }
        if (row.serviceKind) {
          const b = serviceBuckets[row.serviceKind];
          b.requests++;
          b.tokens += row.tokens;
          b.costUsd += row.costUsd;
        }
      });
    }
  }

  let totalCost = 0;
  let totalTokens = 0;
  for (const v of Object.values(byAgent)) {
    totalCost += v.costUsd;
    totalTokens += v.tokens;
  }

  let serviceRequests = 0;
  let serviceTokens = 0;
  let serviceCostUsd = 0;
  for (const k of ALL_SERVICE_KINDS) {
    const b = serviceBuckets[k];
    serviceRequests += b.requests;
    serviceTokens += b.tokens;
    serviceCostUsd += b.costUsd;
  }

  const serviceExpenses = ALL_SERVICE_KINDS.map((id) => {
    const b = serviceBuckets[id];
    return {
      id,
      label: SERVICE_EXPENSE_LABELS[id],
      requests: b.requests,
      tokens: Math.round(b.tokens),
      costUsd: round2(b.costUsd),
    };
  }).filter((row) => row.requests > 0);

  return {
    range,
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    totals: {
      costUsd: round2(totalCost),
      tokens: Math.round(totalTokens),
    },
    /** Служебные расходы (сумма по детализации ниже; те же ходы уже в totals / byAgent). */
    serviceTotals: {
      requests: serviceRequests,
      tokens: Math.round(serviceTokens),
      costUsd: round2(serviceCostUsd),
    },
    serviceExpenses,
    meta: {
      agentsDirReadable: dirOk,
      filesScanned,
      assistantRows: linesMatched,
      estimatedCostRows: estimatedRows,
      costUsdSource:
        linesMatched === 0
          ? ("none" as const)
          : estimatedRows === 0
            ? ("logged" as const)
            : estimatedRows === linesMatched
              ? ("estimated" as const)
              : ("mixed" as const),
    },
    byAgentTokens: byAgentIO,
    byAgent: Object.fromEntries(
      Object.entries(byAgent).map(([k, v]) => [
        k,
        { costUsd: round2(v.costUsd), tokens: Math.round(v.tokens) },
      ]),
    ),
    byProvider: Object.fromEntries(
      Object.entries(byProvider).map(([k, v]) => {
        const entry: {
          costUsd: number;
          tokens: number;
          volumeKind?: "tokens" | "generations";
        } = { costUsd: round2(v.costUsd), tokens: Math.round(v.tokens) };
        if (v.volumeKind === "generations") entry.volumeKind = "generations";
        return [k, entry];
      }),
    ),
  };
}

/** Для fallback в /api/openclaw/stats — суммы за всё время из JSONL */
export async function jsonlTotalsForStatsFallback(): Promise<{
  totalTokens: number;
  costUsd: number;
  perAgent: Record<string, { inputTokens: number; outputTokens: number }>;
}> {
  const data = await aggregateJsonlCosts("all");
  return {
    totalTokens: data.totals.tokens,
    costUsd: data.totals.costUsd,
    perAgent: data.byAgentTokens ?? {},
  };
}
