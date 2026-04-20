"use client";

import { useState, useTransition } from "react";
import { updateStatusPriorityAction } from "@/app/admin/actions";
import {
  STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  type CompanyStatus, type CompanyPriority,
} from "@/data/types";

const STATUS_ORDER: CompanyStatus[] = ["frio", "morno", "quente", "cliente", "descartado"];
const PRIORITY_ORDER: CompanyPriority[] = ["alta", "media", "baixa"];

export default function StatusPriorityChips({
  companyId,
  status,
  priority,
}: {
  companyId: string;
  status: CompanyStatus;
  priority: CompanyPriority;
}) {
  const [s, setS] = useState(status);
  const [p, setP] = useState(priority);
  const [pending, start] = useTransition();

  const update = (patch: { status?: CompanyStatus; priority?: CompanyPriority }) => {
    if (patch.status) setS(patch.status);
    if (patch.priority) setP(patch.priority);
    start(async () => {
      await updateStatusPriorityAction(companyId, patch);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <ChipGroup
        label="Status"
        options={STATUS_ORDER}
        active={s}
        labels={STATUS_LABELS}
        colors={STATUS_COLORS}
        onChange={(v) => update({ status: v as CompanyStatus })}
        disabled={pending}
      />
      <ChipGroup
        label="Prioridade"
        options={PRIORITY_ORDER}
        active={p}
        labels={PRIORITY_LABELS}
        colors={PRIORITY_COLORS}
        onChange={(v) => update({ priority: v as CompanyPriority })}
        disabled={pending}
      />
    </div>
  );
}

function ChipGroup<T extends string>({
  label, options, active, labels, colors, onChange, disabled,
}: {
  label: string;
  options: readonly T[];
  active: T;
  labels: Record<T, string>;
  colors: Record<T, string>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        {label}:
      </span>
      <div className="flex gap-1">
        {options.map((opt) => {
          const isActive = opt === active;
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              disabled={disabled}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: isActive ? colors[opt] : "transparent",
                color: isActive ? "white" : colors[opt],
                border: `1px solid ${colors[opt]}`,
              }}
            >
              {labels[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
