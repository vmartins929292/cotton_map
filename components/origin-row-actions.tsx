"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Pencil, RefreshCcw, Trash2 } from "lucide-react";
import {
  deleteOriginAction,
  backfillOriginRoutesManualAction,
} from "@/app/admin/origens-actions";

export default function OriginRowActions({
  originId,
  isDefault,
}: {
  originId: string;
  isDefault: boolean;
}) {
  const [pending, start] = useTransition();

  function onDelete() {
    if (isDefault) return;
    if (!confirm("Excluir esta origem? Todas as rotas calculadas serao removidas.")) return;
    start(async () => {
      await deleteOriginAction(originId);
    });
  }

  function onBackfill() {
    if (!confirm("Recalcular as rotas dessa origem para todas as empresas? Roda em segundo plano.")) {
      return;
    }
    start(async () => {
      const res = await backfillOriginRoutesManualAction(originId);
      if ("error" in res) alert(res.error);
      else alert("Backfill iniciado. Aguarde alguns minutos.");
    });
  }

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <button
        type="button"
        onClick={onBackfill}
        disabled={pending}
        title="Recalcular rotas para todas as empresas"
        className="p-1.5 rounded hover:bg-black/5 cursor-pointer disabled:opacity-50"
        style={{ color: "var(--accent2)" }}
      >
        <RefreshCcw className="w-3.5 h-3.5" />
      </button>
      <Link
        href={`/admin/origens/${originId}`}
        title="Editar origem"
        className="p-1.5 rounded hover:bg-black/5"
        style={{ color: "var(--accent)" }}
      >
        <Pencil className="w-3.5 h-3.5" />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending || isDefault}
        title={isDefault ? "Origem padrão não pode ser excluída" : "Excluir origem"}
        className="p-1.5 rounded hover:bg-black/5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
        style={{ color: "#c1322f" }}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
