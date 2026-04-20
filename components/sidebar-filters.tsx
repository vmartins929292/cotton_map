"use client";

import { useId, useState } from "react";
import { MapPin, Plus, Search, X } from "lucide-react";
import { CompanyType, Origin, Region } from "@/data/types";
import AddressAutocomplete, {
  type ResolvedAddress,
} from "@/components/address-autocomplete";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)]";

const CUSTOM_SORT_COLOR = "#0f766e"; // teal pra diferenciar dos defaults

interface SidebarFiltersProps {
  origins: Origin[];
  search: string;
  onSearchChange: (v: string) => void;
  activeRegion: Region | "all";
  onRegionChange: (r: Region | "all") => void;
  activeType: CompanyType | null;
  onTypeChange: (t: CompanyType | null) => void;
  sortOriginId: string;
  onSortOriginChange: (originId: string) => void;
  bciOnly: boolean;
  onBciChange: (v: boolean) => void;
  customSortOrigin: { label: string; lat: number; lng: number } | null;
  customSortOriginId: string;
  onCustomSortOriginChange: (
    o: { label: string; lat: number; lng: number } | null
  ) => void;
}

const regions: { key: Region | "all"; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "NE", label: "Nordeste" },
  { key: "SE", label: "Sudeste" },
  { key: "S", label: "Sul" },
  { key: "CO", label: "Centro-Oeste" },
];

const types: { key: CompanyType; label: string }[] = [
  { key: "fiacao", label: "Fiações" },
  { key: "integrada", label: "Integradas" },
  { key: "denim", label: "Denim" },
  { key: "malharia", label: "Malharias" },
  { key: "comercial", label: "Comercial" },
];

const chipBase = `px-2 h-[20px] rounded text-[10px] font-medium leading-none transition-colors cursor-pointer inline-flex items-center ${focusRing}`;

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[9px] font-bold uppercase tracking-[0.14em] mb-1"
      style={{ color: "var(--text-light)" }}
    >
      {children}
    </div>
  );
}

function chipStyle(active: boolean, accent: string): React.CSSProperties {
  return active
    ? {
        background: accent,
        color: "white",
        border: `1px solid ${accent}`,
      }
    : {
        background: "transparent",
        color: "var(--text-dim)",
        border: "1px solid var(--card-border)",
      };
}

function BciSwitch({
  pressed,
  onPressedChange,
  id,
}: {
  pressed: boolean;
  onPressedChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label="Somente empresas BCI"
      onClick={() => onPressedChange(!pressed)}
      className={`relative h-[16px] w-[28px] shrink-0 rounded-full transition-colors ${focusRing}`}
      style={{
        background: pressed ? "var(--green)" : "var(--card-border)",
      }}
    >
      <span
        className="absolute top-[2px] left-[2px] h-[12px] w-[12px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
        style={{
          transform: pressed ? "translateX(12px)" : "translateX(0)",
        }}
        aria-hidden
      />
    </button>
  );
}

export default function SidebarFilters(props: SidebarFiltersProps) {
  const bciSwitchId = useId();
  const [pickerOpen, setPickerOpen] = useState(false);

  const customActive = props.sortOriginId === props.customSortOriginId;

  function shortLabel(label: string): string {
    // "Campo Novo do Parecis - MT, Brasil" -> "Campo Novo do Parecis - MT"
    const noBrasil = label.replace(/,\s*brasil\s*$/i, "");
    // limita pra caber no chip
    return noBrasil.length > 28 ? noBrasil.slice(0, 26) + "…" : noBrasil;
  }

  return (
    <div
      className="px-3 pt-2 pb-2 border-b sticky top-0 z-10"
      style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: "var(--text-light)" }}
            aria-hidden
          />
          <input
            type="search"
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="Buscar empresa, cidade, UF..."
            className={`w-full pl-7 pr-2 h-7 rounded-md text-[12px] outline-none transition-colors ${focusRing}`}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--card-border)",
              color: "var(--text)",
              fontFamily: "inherit",
            }}
          />
        </div>

        <label
          htmlFor={bciSwitchId}
          className="flex items-center gap-1.5 cursor-pointer shrink-0"
          title="Somente empresas com certificação BCI"
        >
          <span
            className="text-[10px] font-semibold leading-none"
            style={{ color: props.bciOnly ? "var(--green)" : "var(--text-dim)" }}
          >
            BCI
          </span>
          <BciSwitch
            id={bciSwitchId}
            pressed={props.bciOnly}
            onPressedChange={props.onBciChange}
          />
        </label>
      </div>

      <div className="mt-2">
        <GroupLabel>Região</GroupLabel>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Regiões">
          {regions.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => props.onRegionChange(r.key)}
              className={chipBase}
              style={chipStyle(props.activeRegion === r.key, "var(--accent)")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2">
        <GroupLabel>Segmento</GroupLabel>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Tipos de empresa">
          {types.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => props.onTypeChange(props.activeType === t.key ? null : t.key)}
              className={chipBase}
              style={chipStyle(props.activeType === t.key, "var(--accent2)")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2">
        <GroupLabel>Ordenar por distância</GroupLabel>
        <div
          className="flex flex-wrap gap-0.5 p-0.5 rounded-md"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--card-border)",
          }}
          role="radiogroup"
          aria-label="Origem para ordenar por distância"
        >
          {props.origins.map((o) => {
            const active = props.sortOriginId === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => props.onSortOriginChange(o.id)}
                title={`Ordenar por distância de ${o.short}`}
                className={`flex-1 min-w-[80px] flex items-center justify-center gap-1 h-[22px] px-1.5 rounded text-[10px] font-semibold leading-none transition-colors cursor-pointer ${focusRing}`}
                style={{
                  background: active ? "var(--card)" : "transparent",
                  color: active ? "var(--text)" : "var(--text-dim)",
                  border: active ? `1px solid ${o.color}` : "1px solid transparent",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: o.color }}
                  aria-hidden
                />
                <span className="truncate">{o.short}</span>
              </button>
            );
          })}

          {/* Chip da origem custom (se houver) */}
          {props.customSortOrigin && (
            <button
              type="button"
              role="radio"
              aria-checked={customActive}
              onClick={() =>
                props.onSortOriginChange(props.customSortOriginId)
              }
              title={`Ordenar por distância de ${props.customSortOrigin.label}`}
              className={`group flex-1 min-w-[110px] flex items-center justify-center gap-1 h-[22px] px-1.5 rounded text-[10px] font-semibold leading-none transition-colors cursor-pointer ${focusRing}`}
              style={{
                background: customActive ? "var(--card)" : "transparent",
                color: customActive ? "var(--text)" : "var(--text-dim)",
                border: customActive
                  ? `1px solid ${CUSTOM_SORT_COLOR}`
                  : "1px solid transparent",
                boxShadow: customActive ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: CUSTOM_SORT_COLOR }}
                aria-hidden
              />
              <span className="truncate">
                {shortLabel(props.customSortOrigin.label)}
              </span>
              <span
                role="button"
                aria-label="Remover origem personalizada"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onCustomSortOriginChange(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    props.onCustomSortOriginChange(null);
                  }
                }}
                className="ml-0.5 opacity-60 hover:opacity-100 cursor-pointer p-0.5 rounded"
                title="Remover"
              >
                <X className="w-2.5 h-2.5" />
              </span>
            </button>
          )}

          {/* Botão "+ Outro" para adicionar origem custom */}
          {!props.customSortOrigin && !pickerOpen && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              title="Ordenar por distância de um município personalizado"
              className={`flex items-center justify-center gap-1 h-[22px] px-2 rounded text-[10px] font-semibold leading-none cursor-pointer transition-colors hover:bg-black/[0.04] ${focusRing}`}
              style={{
                background: "transparent",
                color: CUSTOM_SORT_COLOR,
                border: `1px dashed ${CUSTOM_SORT_COLOR}`,
              }}
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Outro</span>
            </button>
          )}
        </div>

        {/* Picker inline */}
        {pickerOpen && (
          <div
            className="mt-1.5 p-2 rounded-md"
            style={{
              background: "var(--bg)",
              border: `1px solid ${CUSTOM_SORT_COLOR}`,
            }}
          >
            <div
              className="text-[9.5px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1"
              style={{ color: CUSTOM_SORT_COLOR }}
            >
              <MapPin className="w-3 h-3" />
              Município personalizado
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="ml-auto p-0.5 rounded hover:bg-black/5 cursor-pointer"
                title="Cancelar"
                style={{ color: "var(--text-light)" }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <AddressAutocomplete
              placeholder="Ex.: Campo Novo do Parecis, MT"
              compact
              autoFocus
              onResolved={(addr: ResolvedAddress | null) => {
                if (!addr) return;
                props.onCustomSortOriginChange({
                  label: addr.label,
                  lat: addr.lat,
                  lng: addr.lng,
                });
                setPickerOpen(false);
              }}
            />
            <p
              className="text-[10px] mt-1 leading-snug"
              style={{ color: "var(--text-light)" }}
            >
              A ordenação usa distância em linha reta (Haversine) — útil para
              encontrar empresas próximas a uma origem alternativa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
