"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Agent } from "@/lib/utils/types";
import { formatTokenCount } from "@/lib/formatUsage";
import {
  normalizeCostReport,
  type CostReportPayload,
  type CostReportBucket,
} from "@/lib/normalizeCostReport";

type RangeKey = "day" | "week" | "month" | "all";

type CostReport = CostReportPayload;
type Bucket = CostReportBucket;

const RANGE_LABELS: Record<RangeKey, string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
  all: "Всё время",
};

function sortEntries(map: Record<string, Bucket>): [string, Bucket][] {
  return Object.entries(map).sort((a, b) => b[1].costUsd - a[1].costUsd || b[1].tokens - a[1].tokens);
}

function providerLabel(key: string): string {
  if (key === "nanobananapro") return "NanoBananaPro";
  const k = key.toLowerCase();
  if (k.startsWith("qwen/")) return key.slice("qwen/".length);
  const map: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    "google-generative-ai": "Google AI",
    unknown: "Не указано",
  };
  return map[k] || key;
}

function formatPlatformVolume(b: Bucket): string {
  if (b.volumeKind === "generations") {
    return `${b.tokens} ген.`;
  }
  return formatTokenCount(b.tokens);
}

export default function OfficeCostsPage() {
  const [range, setRange] = useState<RangeKey>("week");
  const [report, setReport] = useState<CostReport | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((d) => setAgents(d.agents || []))
      .catch(() => setAgents([]));
  }, []);

  const load = useCallback(async (r: RangeKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/openclaw/cost-report?range=${r}&t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: unknown = await res.json();
      setReport(normalizeCostReport(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  function agentTitle(id: string): string {
    const a = agents.find((x) => x.id === id);
    return a ? `${a.name} (${id})` : id;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a12] text-[#e4e6f0]">
      <header className="h-11 bg-[#0f0f0f] border-b border-[#2a2a2a] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg">🤖</span>
          <h1 className="text-base font-bold tracking-wider text-white truncate">
            Pixel Office <span className="text-[#ecb00a]">AI Office</span>
            <span className="text-[#9ca3af] font-normal"> — расходы</span>
          </h1>
        </div>
        <Link
          href="/office/stream"
          className="text-[10px] text-[#9ca3af] hover:text-white border border-[#2a2a2a] px-2 py-0.5 rounded transition-colors shrink-0 inline-block"
        >
          ← К офису
        </Link>
      </header>

      <div className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
        <div className="flex flex-wrap gap-2 mb-6">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors cursor-pointer ${
                range === k
                  ? "bg-[#ecb00a]/20 text-[#ecb00a] border-[#ecb00a]/40"
                  : "bg-transparent text-[#9ca3af] border-[#2a2a2a] hover:border-[#4b5563]"
              }`}
            >
              {RANGE_LABELS[k]}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-400/90 border border-red-500/30 rounded px-3 py-2 bg-red-950/20">
            {error}
          </div>
        )}

        {loading && !report && (
          <div className="text-sm text-[#6b7280]">Загрузка отчёта по сессиям…</div>
        )}
        {loading && report && (
          <div className="text-[11px] text-[#6b7280] mb-2">Обновление…</div>
        )}

        {report && (
          <>
            <div className="mb-2 text-[11px] text-[#6b7280] font-mono">
              Период: {new Date(report.from).toLocaleString("ru")} — {new Date(report.to).toLocaleString("ru")}
            </div>
            {!report.meta.agentsDirReadable && (
              <p className="mb-4 text-xs text-amber-400/90">
                Каталог сессий OpenClaw недоступен для чтения (проверьте OPENCLAW_AGENTS_DIR / права). Ниже могут быть
                нули.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="rounded border border-[#2a2a2a] bg-[#0f0f0f]/80 p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#6b7280] mb-1">Всего токенов</div>
                <div className="text-xl font-mono text-[#ecb00a] tabular-nums">{formatTokenCount(report.totals.tokens)}</div>
              </div>
              <div className="rounded border border-[#2a2a2a] bg-[#0f0f0f]/80 p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#6b7280] mb-1">Сумма (USD, из логов)</div>
                <div className="text-xl font-mono text-green-400/90 tabular-nums">${report.totals.costUsd.toFixed(2)}</div>
              </div>
              {report.serviceTotals && report.serviceTotals.requests > 0 && (
                <div className="rounded border border-[#3d3d5c]/80 bg-[#12121a]/80 p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#6b7280] mb-1">
                    Служебные расходы (всего)
                  </div>
                  <div className="text-lg font-mono text-[#a78bfa]/90 tabular-nums">
                    {formatTokenCount(report.serviceTotals.tokens)} tokens
                  </div>
                  <div className="text-sm font-mono text-[#9ca3af] mt-1">${report.serviceTotals.costUsd.toFixed(2)}</div>
                  <div className="text-[10px] text-[#6b7280] mt-1">
                    Запросов: {report.serviceTotals.requests}. Те же ответы уже учтены в «Всего токенов» и в таблице по
                    агентам; ниже — разбивка по типам.
                  </div>
                </div>
              )}
            </div>

            {report.serviceExpenses && report.serviceExpenses.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">Служебные расходы</h2>
                <div className="rounded border border-[#2a2a2a] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#14141a] text-left text-[10px] text-[#6b7280] uppercase">
                        <th className="px-3 py-2 font-medium">Наименование</th>
                        <th className="px-3 py-2 font-medium text-right">Запросов</th>
                        <th className="px-3 py-2 font-medium text-right">Токены</th>
                        <th className="px-3 py-2 font-medium text-right">USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.serviceExpenses.map((row) => (
                        <tr key={row.id} className="border-t border-[#2a2a2a]/80">
                          <td className="px-3 py-2 text-[#e4e6f0]">{row.label}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-[#9ca3af]">{row.requests}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-[#ecb00a]/90">
                            {formatTokenCount(row.tokens)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-green-400/85">
                            ${row.costUsd.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <div className="mb-6 space-y-2">
              <p className="text-[11px] text-[#6b7280]">
                Данные из локальных <code className="text-[#9ca3af]">*.jsonl</code> сессий (ответы assistant с полем{" "}
                <code className="text-[#9ca3af]">usage</code>). OpenRouter в таблице — по id модели (например{" "}
                <code className="text-[#9ca3af]">qwen3.6-plus:free</code>) — для моделей с суффиксом{" "}
                <code className="text-[#9ca3af]">:free</code> USD в отчёте берётся из лога (обычно <strong>$0</strong>, без
                оценки «как Claude»); NanoBananaPro — по{" "}
                <code className="text-[#9ca3af]">model</code> с <code className="text-[#9ca3af]">gemini-3-pro-image-preview</code>, USD за
                генерацию: <code className="text-[#9ca3af]">NANO_BANANA_PRO_USD_PER_GEN</code> (по умолчанию 0.05). Строк:{" "}
                {report.meta.assistantRows}, файлов: {report.meta.filesScanned}.
              </p>
              {(report.meta.estimatedCostRows ?? 0) > 0 && (
                <p className="text-[11px] text-amber-400/90">
                  В логах OpenClaw часто <code className="text-amber-200/90">usage.cost = 0</code> при ненулевых токенах.
                  Суммы в USD ниже — <strong>оценка</strong> по input/output/cache (тарифы по умолчанию как у Claude Sonnet;
                  можно задать <code className="text-amber-200/90">OPENCLAW_COST_*_PER_M</code> в окружении). Строк с
                  оценкой: {report.meta.estimatedCostRows}.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section>
                <h2 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">По агентам</h2>
                <div className="rounded border border-[#2a2a2a] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#14141a] text-left text-[10px] text-[#6b7280] uppercase">
                        <th className="px-3 py-2 font-medium">Агент</th>
                        <th className="px-3 py-2 font-medium text-right">Токены</th>
                        <th className="px-3 py-2 font-medium text-right">USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortEntries(report.byAgent).map(([id, b]) => (
                        <tr key={id} className="border-t border-[#2a2a2a]/80">
                          <td className="px-3 py-2 text-[#e4e6f0] truncate max-w-[180px]" title={id}>
                            {agentTitle(id)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-[#ecb00a]/90">
                            {formatTokenCount(b.tokens)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-green-400/85">
                            ${b.costUsd.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {sortEntries(report.byAgent).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-[#6b7280] text-xs">
                            Нет данных за период
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h2 className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">По площадкам</h2>
                <div className="rounded border border-[#2a2a2a] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#14141a] text-left text-[10px] text-[#6b7280] uppercase">
                        <th className="px-3 py-2 font-medium">Провайдер</th>
                        <th className="px-3 py-2 font-medium text-right">Токены / ген.</th>
                        <th className="px-3 py-2 font-medium text-right">USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortEntries(report.byProvider).map(([id, b]) => (
                        <tr key={id} className="border-t border-[#2a2a2a]/80">
                          <td className="px-3 py-2 text-[#e4e6f0]">{providerLabel(id)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-[#ecb00a]/90">
                            {formatPlatformVolume(b)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-green-400/85">
                            ${b.costUsd.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {sortEntries(report.byProvider).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-[#6b7280] text-xs">
                            Нет данных за период
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
