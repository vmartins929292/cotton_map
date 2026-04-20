"use client";

import { useEffect, useMemo } from "react";
import { Navigation, X } from "lucide-react";
import type { RouteStep } from "@/lib/route-types";

interface Props {
  open: boolean;
  title: string;
  steps: RouteStep[];
  onClose: () => void;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function fmtDist(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

export default function RouteInstructionsDrawer({
  open,
  title,
  steps,
  onClose,
}: Props) {
  // Fecha com ESC
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const totalMeters = useMemo(
    () => steps.reduce((acc, s) => acc + s.distanceMeters, 0),
    [steps]
  );

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-1000 transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "rgba(26,31,46,0.35)", backdropFilter: "blur(2px)" }}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Instruções da rota"
        aria-modal="true"
        className={`fixed top-0 right-0 h-full z-1001 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          width: "min(420px, 95vw)",
          background: "var(--bg-paper)",
          borderLeft: "1px solid var(--card-border)",
          boxShadow: "-12px 0 32px rgba(0,0,0,0.10)",
        }}
      >
        <header
          className="flex items-start justify-between gap-3 p-4"
          style={{ borderBottom: "1px solid var(--card-border)" }}
        >
          <div className="min-w-0">
            <div
              className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider"
              style={{ color: "var(--accent2)" }}
            >
              <Navigation className="w-3.5 h-3.5" />
              Instruções de rota
            </div>
            <h3
              className="mt-1 text-[14px] font-bold leading-snug"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: "var(--accent-dark)",
              }}
            >
              {title}
            </h3>
            <p
              className="text-[11px] mt-1"
              style={{ color: "var(--text-dim)" }}
            >
              {steps.length} passos · {fmtDist(totalMeters)} no total
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-black/5 cursor-pointer shrink-0"
            style={{ color: "var(--text-dim)" }}
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          {steps.length === 0 ? (
            <p
              className="text-[12px] text-center py-8"
              style={{ color: "var(--text-light)" }}
            >
              Nenhuma instrução disponível para esta rota.
            </p>
          ) : (
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 p-2.5 rounded-lg"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  <span
                    className="flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0"
                    style={{ background: "var(--accent)", color: "white" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[12.5px] leading-snug"
                      style={{ color: "var(--text)" }}
                    >
                      {stripHtml(s.instruction)}
                    </p>
                    <p
                      className="mt-1 text-[10.5px] font-semibold"
                      style={{ color: "var(--text-light)" }}
                    >
                      {fmtDist(s.distanceMeters)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </>
  );
}
