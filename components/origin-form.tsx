"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveOriginAction } from "@/app/admin/origens-actions";
import type { SaveState } from "@/app/admin/types";
import type { Origin } from "@/data/types";
import { STATE_NAMES } from "@/data/types";
import AddressAutocomplete, {
  type ResolvedAddress,
} from "@/components/address-autocomplete";

const initial: SaveState = {};

const STATE_OPTIONS = Object.keys(STATE_NAMES).sort((a, b) => a.localeCompare(b));

type AddrFields = {
  street: string;
  number: string;
  neighborhood: string;
  cep: string;
  city: string;
  state: string;
};

export default function OriginForm({
  mode,
  initialData,
}: {
  mode: "create" | "update";
  initialData?: Origin;
}) {
  const router = useRouter();
  const action = saveOriginAction.bind(null, mode);
  const [state, formAction, pending] = useActionState(action, initial);

  const [resolved, setResolved] = useState<ResolvedAddress | null>(
    initialData
      ? {
          lat: initialData.lat,
          lng: initialData.lng,
          label: initialData.address || initialData.name,
          placeId: "",
          street: initialData.street ?? "",
          number: initialData.number ?? "",
          neighborhood: initialData.neighborhood ?? "",
          cep: initialData.cep ?? "",
          city: initialData.city ?? "",
          state: initialData.state ?? "",
        }
      : null
  );

  const [fields, setFields] = useState<AddrFields>({
    street: initialData?.street ?? "",
    number: initialData?.number ?? "",
    neighborhood: initialData?.neighborhood ?? "",
    cep: initialData?.cep ?? "",
    city: initialData?.city ?? "",
    state: initialData?.state ?? "",
  });

  const [color, setColor] = useState(initialData?.color ?? "#8b5a2b");

  function handleResolved(addr: ResolvedAddress | null) {
    setResolved(addr);
    if (addr) {
      setFields({
        street: addr.street,
        number: addr.number,
        neighborhood: addr.neighborhood,
        cep: addr.cep,
        city: addr.city,
        state: addr.state,
      });
    }
  }

  function setField<K extends keyof AddrFields>(key: K, value: AddrFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  return (
    <form action={formAction} className="space-y-4">
      {initialData?.id && <input type="hidden" name="id" value={initialData.id} />}

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="Nome formal *" required>
          <input
            name="name"
            required
            defaultValue={initialData?.name ?? ""}
            placeholder="Ex.: SAPEZAL"
            className={inputCls}
          />
        </Field>
        <Field label="Rótulo curto (chip — legacy)">
          <input
            name="short"
            defaultValue={initialData?.short ?? ""}
            placeholder="Opcional. Default: cidade"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field
          label={
            mode === "create"
              ? "Slug (opcional, gerado a partir do nome)"
              : "Slug (não editável)"
          }
        >
          <input
            name="key"
            defaultValue={initialData?.key ?? ""}
            disabled={mode === "update"}
            placeholder="ex: fazenda-x"
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label="Ordem de exibição">
          <input
            name="sort_order"
            type="number"
            defaultValue={initialData?.sortOrder ?? 100}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Cor do chip">
        <div className="flex items-center gap-2">
          <input
            name="color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-16 h-9 rounded border cursor-pointer"
            style={{ borderColor: "var(--card-border)" }}
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className={`${inputCls} font-mono w-32`}
          />
          <span
            className="px-3 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: color, color: "white" }}
          >
            Preview
          </span>
        </div>
      </Field>

      <div
        className="rounded-lg p-3 space-y-3"
        style={{ background: "var(--bg)", border: "1px solid var(--card-border)" }}
      >
        <Field label="Buscar endereço (auto-preenche os campos abaixo)">
          <AddressAutocomplete
            placeholder="Endereço completo da origem (rua, cidade/UF, CEP)"
            initialLabel={initialData?.address ?? ""}
            onResolved={handleResolved}
          />
          <p className="text-[10.5px] mt-1" style={{ color: "var(--text-light)" }}>
            {resolved
              ? `Coordenadas: ${resolved.lat.toFixed(5)}, ${resolved.lng.toFixed(5)}`
              : "Selecione uma sugestão para preencher lat/lng e os campos automaticamente."}
          </p>
        </Field>

        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <Field label="CEP">
            <input
              name="cep"
              value={fields.cep}
              onChange={(e) => setField("cep", e.target.value)}
              placeholder="00000-000"
              className={inputCls}
            />
          </Field>
          <Field label="Rua">
            <input
              name="street"
              value={fields.street}
              onChange={(e) => setField("street", e.target.value)}
              className={`${inputCls} col-span-2`}
            />
          </Field>
          <Field label="Número">
            <input
              name="number"
              value={fields.number}
              onChange={(e) => setField("number", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <Field label="Bairro">
            <input
              name="neighborhood"
              value={fields.neighborhood}
              onChange={(e) => setField("neighborhood", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Cidade/Município *" required>
            <input
              name="city"
              required
              value={fields.city}
              onChange={(e) => setField("city", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Estado (UF) *" required>
            <select
              name="state"
              required
              value={fields.state}
              onChange={(e) => setField("state", e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              {STATE_OPTIONS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf} — {STATE_NAMES[uf]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <input
        type="hidden"
        name="address"
        value={resolved?.label ?? initialData?.address ?? ""}
      />
      <input type="hidden" name="lat" value={resolved?.lat ?? initialData?.lat ?? ""} />
      <input type="hidden" name="lng" value={resolved?.lng ?? initialData?.lng ?? ""} />

      {state.error && (
        <div
          className="px-3 py-2 rounded-md text-[12px]"
          style={{
            background: "rgba(193,50,47,0.1)",
            color: "#c1322f",
            border: "1px solid rgba(193,50,47,0.3)",
          }}
        >
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {pending
            ? "Salvando..."
            : mode === "create"
            ? "Criar origem"
            : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/origens")}
          className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer hover:opacity-80"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--card-border)",
            color: "var(--text-dim)",
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-md text-sm outline-none border [background:var(--card)] [border-color:var(--card-border)] [color:var(--text)]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>
        {label}
        {required && <span style={{ color: "#c1322f" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
