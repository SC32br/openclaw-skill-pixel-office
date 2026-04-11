"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * ChunkLoadError и др. сбои загрузки чанков часто после деплоя (HTML из кэша, а чанки уже другие).
 */
export default function CostsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[office/costs]", error);
  }, [error]);

  const isChunk =
    /chunk|ChunkLoadError|Loading chunk/i.test(error.message) || error.name === "ChunkLoadError";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a12] text-[#e4e6f0] px-4">
      <p className="text-lg font-semibold text-red-300/95 mb-2">Не удалось загрузить страницу расходов</p>
      {isChunk ? (
        <p className="text-sm text-[#9ca3af] max-w-md text-center mb-6">
          Похоже на устаревший кэш после обновления сайта: страница запрашивает старые JS-файлы. Сделайте жёсткое
          обновление: <kbd className="px-1 bg-[#1f1f28] rounded">Ctrl+Shift+R</kbd> (или очистите кэш для этого
          сайта). На сервере после деплоя нужен один полный <code className="text-[#ecb00a]">npm run build</code> и
          перезапуск процесса, без смешивания старой и новой папки <code className="text-[#9ca3af]">.next</code>.
        </p>
      ) : (
        <p className="text-sm text-[#9ca3af] max-w-md text-center mb-6">{error.message || "Неизвестная ошибка"}</p>
      )}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          className="text-xs px-4 py-2 rounded border border-[#ecb00a]/50 text-[#ecb00a] hover:bg-[#ecb00a]/10"
          onClick={() => {
            window.location.reload();
          }}
        >
          Перезагрузить страницу
        </button>
        <button
          type="button"
          className="text-xs px-4 py-2 rounded border border-[#2a2a2a] text-[#9ca3af] hover:border-[#4b5563]"
          onClick={() => reset()}
        >
          Повторить (Next.js)
        </button>
        <Link
          href="/office/stream"
          className="text-xs px-4 py-2 rounded border border-[#2a2a2a] text-[#9ca3af] hover:text-white inline-flex items-center"
        >
          ← К офису
        </Link>
      </div>
    </div>
  );
}
