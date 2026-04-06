"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#eef4ff" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              background: "rgba(255,255,255,0.85)",
              borderRadius: "1rem",
              padding: "2rem",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0f172a", margin: "0 0 0.75rem" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#475569", margin: "0 0 1rem" }}>
              A critical error occurred. Please try again or contact your administrator.
            </p>
            {error.digest && (
              <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#94a3b8", margin: "0 0 1rem" }}>
                Ref: {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              style={{
                background: "#0f172a",
                color: "#fff",
                border: "none",
                borderRadius: "0.75rem",
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
