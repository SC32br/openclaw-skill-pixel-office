"use client";

/**
 * Root error boundary for chunk load failures after deploy (stale HTML vs new JS).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunk =
    /chunk|ChunkLoadError|Loading chunk/i.test(error.message) || error.name === "ChunkLoadError";

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a12", color: "#e4e6f0", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fca5a5", marginBottom: "0.5rem" }}>
            Failed to load the app
          </p>
          {isChunk ? (
            <p style={{ fontSize: "0.875rem", color: "#9ca3af", maxWidth: "28rem", marginBottom: "1.5rem" }}>
              Often a stale cache after an update: the page requests old JS chunks. Click Reload or hard-refresh
              (Ctrl+Shift+R). On the server after deploy run a full{" "}
              <code style={{ color: "#ecb00a" }}>npm run build</code> and restart — do not mix old and new{" "}
              <code style={{ color: "#9ca3af" }}>.next</code> output.
            </p>
          ) : (
            <p style={{ fontSize: "0.875rem", color: "#9ca3af", maxWidth: "28rem", marginBottom: "1.5rem" }}>
              {error.message || "Unknown error"}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              style={{
                fontSize: "0.75rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                border: "1px solid rgba(236, 176, 10, 0.5)",
                background: "transparent",
                color: "#ecb00a",
                cursor: "pointer",
              }}
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
            <button
              type="button"
              style={{
                fontSize: "0.75rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                border: "1px solid #2a2a2a",
                background: "transparent",
                color: "#9ca3af",
                cursor: "pointer",
              }}
              onClick={() => reset()}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
