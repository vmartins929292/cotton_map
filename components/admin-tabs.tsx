"use client";

import { useState, type ReactNode } from "react";

export type Tab = {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
};

export default function AdminTabs({
  tabs,
  defaultTab,
}: {
  tabs: Tab[];
  defaultTab?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="space-y-4">
      <div
        className="flex items-center gap-1 border-b"
        style={{ borderColor: "var(--card-border)" }}
        role="tablist"
      >
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className="px-4 py-2.5 text-[13px] font-semibold cursor-pointer transition-opacity hover:opacity-80 -mb-px border-b-2"
              style={{
                color: isActive ? "var(--accent2)" : "var(--text-dim)",
                borderColor: isActive ? "var(--accent2)" : "transparent",
              }}
            >
              {t.label}
              {typeof t.count === "number" && (
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    background: isActive ? "var(--accent2)" : "var(--bg)",
                    color: isActive ? "white" : "var(--text-dim)",
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
