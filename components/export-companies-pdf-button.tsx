"use client";

import { useTransition } from "react";
import { FileDown, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  STATE_NAMES,
  STATUS_LABELS,
  PRIORITY_LABELS,
  TYPE_LABELS,
  type CompanyStatus,
  type CompanyPriority,
} from "@/data/types";
import type { AdminCompany } from "@/lib/companies";

type Props = {
  companies: AdminCompany[];
  filters?: {
    q?: string;
    status?: CompanyStatus;
    priority?: CompanyPriority;
  };
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

export default function ExportCompaniesPdfButton({ companies, filters }: Props) {
  const [pending, start] = useTransition();

  function handleExport() {
    start(async () => {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const now = new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(60, 41, 25);
      doc.text("VALOR AG — Compradores de Algodão", 40, 40);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Exportado em ${now}`, 40, 56);

      const filterParts: string[] = [];
      if (filters?.q) filterParts.push(`busca: "${filters.q}"`);
      if (filters?.status) filterParts.push(`status: ${STATUS_LABELS[filters.status]}`);
      if (filters?.priority) filterParts.push(`prioridade: ${PRIORITY_LABELS[filters.priority]}`);
      const filterLine =
        filterParts.length > 0
          ? `Filtros aplicados — ${filterParts.join(" · ")}`
          : "Sem filtros aplicados (lista completa).";
      doc.text(filterLine, 40, 70);

      doc.setTextColor(60, 41, 25);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${companies.length} ${companies.length === 1 ? "empresa" : "empresas"}`,
        pageWidth - 40,
        40,
        { align: "right" }
      );

      const head = [
        [
          "Empresa",
          "Tipo",
          "Cidade / UF",
          "Status",
          "Prio.",
          "BCI",
          "Pub.",
          "Últ. contato",
          "Contato",
          "Telefone",
          "Email",
        ],
      ];

      const body = companies.map((c) => [
        `${c.name}${c.group && c.group !== c.name ? `\n(${c.group})` : ""}`,
        TYPE_LABELS[c.type] ?? c.type,
        `${c.city} / ${STATE_NAMES[c.state] ?? c.state}`,
        STATUS_LABELS[c.status] ?? c.status,
        PRIORITY_LABELS[c.priority] ?? c.priority,
        c.bci ? "Sim" : "—",
        c.published ? "Sim" : "—",
        fmtDate(c.lastContactAt),
        c.contact || "—",
        c.contact || "—",
        c.email || "—",
      ]);

      autoTable(doc, {
        startY: 90,
        head,
        body,
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 4,
          overflow: "linebreak",
          valign: "top",
          textColor: [40, 40, 40],
          lineColor: [220, 215, 205],
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: [139, 90, 43],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: [250, 247, 240] },
        columnStyles: {
          0: { cellWidth: 130, fontStyle: "bold" },
          1: { cellWidth: 70 },
          2: { cellWidth: 95 },
          3: { cellWidth: 55 },
          4: { cellWidth: 45 },
          5: { cellWidth: 30, halign: "center" },
          6: { cellWidth: 30, halign: "center" },
          7: { cellWidth: 60 },
          8: { cellWidth: 90 },
          9: { cellWidth: 75 },
          10: { cellWidth: "auto" },
        },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          const pageNum = data.pageNumber;
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(
            `Página ${pageNum} de ${pageCount} — VALOR AG Commodities`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 15,
            { align: "center" }
          );
        },
        margin: { top: 90, left: 40, right: 40, bottom: 30 },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`compradores-algodao-${stamp}.pdf`);
    });
  }

  return (
    <button
      onClick={handleExport}
      disabled={pending || companies.length === 0}
      className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-semibold cursor-pointer hover:opacity-90 disabled:opacity-50"
      style={{ background: "var(--accent2)", color: "white" }}
      title={
        companies.length === 0
          ? "Nenhuma empresa para exportar"
          : "Exportar a lista atual (com filtros aplicados) em PDF"
      }
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileDown className="w-3.5 h-3.5" />
      )}
      Exportar PDF
    </button>
  );
}
