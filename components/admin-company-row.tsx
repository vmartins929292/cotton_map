"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import type { AdminCompany } from "@/lib/companies";
import { deleteCompanyAction, togglePublishedAction } from "@/app/admin/actions";
import {
  STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
} from "@/data/types";

function fmtRelative(date?: string | null): string {
  if (!date) return "nunca";
  const days = Math.round((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "hoje";
  if (days === 1) return "1 dia";
  if (days < 30) return `${days} dias`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mes${months > 1 ? "es" : ""}`;
  return `${Math.round(months / 12)} ano(s)`;
}

export default function AdminCompanyRow({
  company,
  typeColor,
  typeLabel,
  stateName,
}: {
  company: AdminCompany;
  typeColor: string;
  typeLabel: string;
  stateName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticPub, setOptimisticPub] = useState(company.published);

  const handleToggle = () => {
    const next = !optimisticPub;
    setOptimisticPub(next);
    startTransition(async () => {
      try {
        await togglePublishedAction(company.id, next);
      } catch {
        setOptimisticPub(!next);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Excluir "${company.name}"? Esta acao nao pode ser desfeita.`)) return;
    startTransition(async () => {
      await deleteCompanyAction(company.id);
    });
  };

  return (
    <tr
      className="hover:bg-black/2 transition-colors"
      style={{ borderBottom: "1px solid var(--card-border)", opacity: pending ? 0.5 : 1 }}
    >
      <td className="px-3 py-2.5">
        <div className="font-semibold" style={{ color: "var(--text)" }}>
          {company.name}
        </div>
        <div className="text-[10px]" style={{ color: "var(--text-light)" }}>
          {company.group} · <span className="font-mono">{company.id}</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-semibold inline-block"
          style={{ background: `${typeColor}1F`, color: typeColor }}
        >
          {typeLabel}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-[12px]" style={{ color: "var(--text)" }}>{company.city}</div>
        <div className="text-[10px]" style={{ color: "var(--text-dim)" }}>{company.state} — {stateName}</div>
      </td>
      <td className="px-3 py-2.5">
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
          style={{ background: STATUS_COLORS[company.status] + "22", color: STATUS_COLORS[company.status] }}
        >
          {STATUS_LABELS[company.status]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
          style={{ color: PRIORITY_COLORS[company.priority], border: `1px solid ${PRIORITY_COLORS[company.priority]}55` }}
        >
          {PRIORITY_LABELS[company.priority]}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[10.5px]" style={{ color: "var(--text-dim)" }}>
        {fmtRelative(company.lastContactAt)}
      </td>
      <td className="px-3 py-2.5 text-center">
        {company.bci ? (
          <span style={{ color: "var(--green)" }} className="font-bold">✓</span>
        ) : (
          <span style={{ color: "var(--text-light)" }}>—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          disabled={pending}
          onClick={handleToggle}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer hover:opacity-80"
          style={{
            background: optimisticPub ? "rgba(45,122,62,0.12)" : "rgba(0,0,0,0.06)",
            color: optimisticPub ? "var(--green)" : "var(--text-dim)",
            border: optimisticPub
              ? "1px solid rgba(45,122,62,0.3)"
              : "1px solid var(--card-border)",
          }}
          title={optimisticPub ? "Clique para ocultar" : "Clique para publicar"}
        >
          {optimisticPub ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {optimisticPub ? "Publicada" : "Oculta"}
        </button>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          <Link
            href={`/admin/empresas/${company.id}`}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold hover:opacity-80"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <Pencil className="w-3 h-3" />
            Editar
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer hover:opacity-80 disabled:opacity-50"
            style={{ background: "rgba(193,50,47,0.1)", color: "#c1322f", border: "1px solid rgba(193,50,47,0.3)" }}
          >
            <Trash2 className="w-3 h-3" />
            Excluir
          </button>
        </div>
      </td>
    </tr>
  );
}
