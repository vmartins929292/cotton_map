"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveCompanyAction } from "@/app/admin/actions";
import type { SaveState } from "@/app/admin/types";
import {
  REGION_LABELS,
  STATE_NAMES,
  TYPE_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/data/types";
import type { AdminCompany } from "@/lib/companies";
import AddressAutocomplete, {
  type ResolvedAddress,
} from "@/components/address-autocomplete";

const initial: SaveState = {};

const TYPE_OPTIONS = Object.entries(TYPE_LABELS) as Array<[string, string]>;
const REGION_OPTIONS = Object.entries(REGION_LABELS) as Array<[string, string]>;
const STATE_OPTIONS = Object.entries(STATE_NAMES).sort((a, b) => a[0].localeCompare(b[0]));
const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as Array<[string, string]>;
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS) as Array<[string, string]>;

type AddrFields = {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
};

function buildLabel(f: AddrFields): string {
  const parts: string[] = [];
  if (f.street) parts.push(f.street + (f.number ? `, ${f.number}` : ""));
  if (f.neighborhood) parts.push(f.neighborhood);
  if (f.city) parts.push(f.city + (f.state ? `/${f.state}` : ""));
  if (f.cep) parts.push(`CEP ${f.cep}`);
  return parts.join(" — ");
}

export default function CompanyForm({
  mode,
  initialData,
}: {
  mode: "create" | "update";
  initialData?: AdminCompany;
}) {
  const router = useRouter();
  const action = saveCompanyAction.bind(null, mode, initialData?.id ?? null);
  const [state, formAction, pending] = useActionState(action, initial);

  const initialFields = useMemo<AddrFields>(
    () => ({
      cep: initialData?.cep ?? "",
      street: initialData?.street ?? "",
      number: initialData?.number ?? "",
      neighborhood: initialData?.neighborhood ?? "",
      city: initialData?.city ?? "",
      state: initialData?.state ?? "SP",
    }),
    [initialData]
  );

  const [fields, setFields] = useState<AddrFields>(initialFields);
  const [resolved, setResolved] = useState<ResolvedAddress | null>(null);

  const initialAddress = initialData?.address ?? "";
  // Se o admin nao mexeu nos campos e nao escolheu novo endereco, podemos
  // reaproveitar lat/lng e evitar o geocode no submit.
  const fieldsUnchanged =
    initialData?.lat != null &&
    initialData?.lng != null &&
    !resolved &&
    fields.cep === initialFields.cep &&
    fields.street === initialFields.street &&
    fields.number === initialFields.number &&
    fields.neighborhood === initialFields.neighborhood &&
    fields.city === initialFields.city &&
    fields.state === initialFields.state;

  function setField<K extends keyof AddrFields>(key: K, value: AddrFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function handleResolved(addr: ResolvedAddress | null) {
    setResolved(addr);
    if (addr) {
      setFields({
        cep: addr.cep,
        street: addr.street,
        number: addr.number,
        neighborhood: addr.neighborhood,
        city: addr.city,
        state: addr.state || fields.state,
      });
    }
  }

  const addressLabel = resolved?.label ?? (fieldsUnchanged ? initialAddress : buildLabel(fields));

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="Nome *" required>
          <input name="name" required defaultValue={initialData?.name ?? ""} className={inputCls} />
        </Field>
        <Field label="Grupo *" required>
          <input name="group" required defaultValue={initialData?.group ?? ""} className={inputCls} />
        </Field>

        <Field
          label={mode === "create" ? "ID (slug — opcional, auto-gerado se vazio)" : "ID (não editável)"}
        >
          <input
            name="id"
            defaultValue={initialData?.id ?? ""}
            disabled={mode === "update"}
            placeholder="ex: brastex-jp"
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label="Tipo *" required>
          <select name="type" required defaultValue={initialData?.type ?? "fiacao"} className={inputCls}>
            {TYPE_OPTIONS.map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>

        <Field label="Região *" required>
          <select name="region" required defaultValue={initialData?.region ?? "SE"} className={inputCls}>
            {REGION_OPTIONS.map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Capacidade">
          <input name="capacity" defaultValue={initialData?.capacity ?? ""} className={inputCls} placeholder="ex: 1.500 ton/mês" />
        </Field>
      </div>

      <div
        className="rounded-lg p-3 space-y-3"
        style={{ background: "var(--bg)", border: "1px solid var(--card-border)" }}
      >
        <Field label="Buscar endereço (auto-preenche os campos abaixo)">
          <AddressAutocomplete
            placeholder="Endereço completo da empresa (rua, cidade/UF, CEP)"
            initialLabel={initialAddress}
            onResolved={handleResolved}
          />
          <p className="text-[10.5px] mt-1" style={{ color: "var(--text-light)" }}>
            {fieldsUnchanged
              ? "Endereço inalterado: lat/lng e distâncias já estão calculadas."
              : "A latitude/longitude e distâncias para Sapezal/Sorriso/LEM serão calculadas automaticamente via Google Maps ao salvar."}
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
              className={inputCls}
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
          <Field label="Cidade *" required>
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
              {STATE_OPTIONS.map(([uf, nome]) => (
                <option key={uf} value={uf}>{uf} — {nome}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Campos derivados enviados no POST */}
      <input type="hidden" name="address" value={addressLabel} />
      {fieldsUnchanged && (
        <>
          <input type="hidden" name="lat" value={initialData!.lat} />
          <input type="hidden" name="lng" value={initialData!.lng} />
        </>
      )}
      {!fieldsUnchanged && resolved && (
        <>
          <input type="hidden" name="lat" value={resolved.lat} />
          <input type="hidden" name="lng" value={resolved.lng} />
        </>
      )}

      <Field label="Descrição">
        <textarea
          name="desc"
          rows={3}
          defaultValue={initialData?.desc ?? ""}
          className={`${inputCls} resize-y`}
        />
      </Field>

      <Field label="Produtos">
        <input name="products" defaultValue={initialData?.products ?? ""} className={inputCls} />
      </Field>

      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <Field label="Site (sem https)">
          <input name="site" defaultValue={initialData?.site ?? ""} className={inputCls} placeholder="empresa.com.br" />
        </Field>
        <Field label="Telefone">
          <input name="contact" defaultValue={initialData?.contact ?? ""} className={inputCls} />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" defaultValue={initialData?.email ?? ""} className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="Status do funil">
          <select
            name="status"
            defaultValue={initialData?.status ?? "frio"}
            className={inputCls}
          >
            {STATUS_OPTIONS.map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Prioridade">
          <select
            name="priority"
            defaultValue={initialData?.priority ?? "media"}
            className={inputCls}
          >
            {PRIORITY_OPTIONS.map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 text-[12px] cursor-pointer" style={{ color: "var(--text)" }}>
          <input type="checkbox" name="bci" defaultChecked={initialData?.bci ?? false} />
          Certificação BCI
        </label>
        <label className="flex items-center gap-2 text-[12px] cursor-pointer" style={{ color: "var(--text)" }}>
          <input type="checkbox" name="published" defaultChecked={initialData?.published ?? true} />
          Publicada (visível no site)
        </label>
      </div>

      {state.error && (
        <div
          className="px-3 py-2 rounded-md text-[12px]"
          style={{ background: "rgba(193,50,47,0.1)", color: "#c1322f", border: "1px solid rgba(193,50,47,0.3)" }}
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
          {pending ? "Salvando..." : mode === "create" ? "Criar empresa" : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer hover:opacity-80"
          style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text-dim)" }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-md text-sm outline-none border [background:var(--card)] [border-color:var(--card-border)] [color:var(--text)]";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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
