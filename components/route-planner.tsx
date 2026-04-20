"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  MapPin,
  Plus,
  Route,
  Trash2,
  X,
} from "lucide-react";
import {
  getCustomRouteAction,
  type CustomRouteResult,
} from "@/app/actions/routes";
import type { Company, Origin } from "@/data/types";
import AddressAutocomplete, {
  type ResolvedAddress,
} from "@/components/address-autocomplete";
import { formatDuration } from "@/lib/format";

type OriginChoice =
  | { kind: "fixed"; id: string }
  | { kind: "custom"; addr: ResolvedAddress | null };

interface Props {
  open: boolean;
  onClose: () => void;
  origins: Origin[];
  selectedCompany: Company | null;
  customRoute: CustomRouteResult | null;
  onRouteReady: (r: CustomRouteResult | null) => void;
  onClearSelection: () => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40";

export default function RoutePlanner({
  open,
  onClose,
  origins,
  selectedCompany,
  customRoute,
  onRouteReady,
  onClearSelection,
}: Props) {
  const [origin, setOrigin] = useState<OriginChoice>(() => ({
    kind: "fixed",
    id: origins[0]?.id ?? "",
  }));
  const [waypoints, setWaypoints] = useState<Array<ResolvedAddress | null>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);
  const prevSelectedId = useRef<string | null>(null);
  const destLabelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const newId = selectedCompany?.id ?? null;
    if (newId && newId !== prevSelectedId.current) {
      setJustAdded(true);
      const t = window.setTimeout(() => setJustAdded(false), 1500);
      prevSelectedId.current = newId;
      return () => window.clearTimeout(t);
    }
    prevSelectedId.current = newId;
  }, [open, selectedCompany?.id]);

  function setOriginFixed(id: string) {
    setOrigin({ kind: "fixed", id });
    setError(null);
  }

  function setOriginCustom() {
    setOrigin({ kind: "custom", addr: null });
    setError(null);
  }

  const fallbackOriginId = origins[0]?.id ?? "";

  function addWaypoint() {
    if (waypoints.length >= 3) return;
    setWaypoints((w) => [...w, null]);
  }

  function setWaypoint(i: number, addr: ResolvedAddress | null) {
    setWaypoints((w) => w.map((x, idx) => (idx === i ? addr : x)));
  }

  function removeWaypoint(i: number) {
    setWaypoints((w) => w.filter((_, idx) => idx !== i));
  }

  function clearRoute() {
    onRouteReady(null);
    setError(null);
  }

  function tracar() {
    setError(null);
    if (!selectedCompany) {
      setError("Clique numa empresa na lista ao lado para definir o destino.");
      return;
    }

    let originPayload: { lat: number; lng: number; label: string };

    if (origin.kind === "fixed") {
      const o = origins.find((x) => x.id === origin.id);
      if (!o) {
        setError("Origem invalida.");
        return;
      }
      originPayload = { lat: o.lat, lng: o.lng, label: o.name };
    } else {
      if (!origin.addr) {
        setError("Escolha um endereço de origem.");
        return;
      }
      originPayload = {
        lat: origin.addr.lat,
        lng: origin.addr.lng,
        label: origin.addr.label,
      };
    }

    const wptPayload = waypoints
      .filter((w): w is ResolvedAddress => w !== null)
      .map((w) => ({ lat: w.lat, lng: w.lng, label: w.label }));

    const validWaypoints = waypoints.filter((w) => w !== null).length;
    const filledWaypoints = waypoints.length;
    if (validWaypoints !== filledWaypoints) {
      setError("Preencha (ou remova) todas as paradas adicionadas.");
      return;
    }

    startTransition(async () => {
      const res = await getCustomRouteAction({
        origin: originPayload,
        destination: { companyId: selectedCompany.id },
        waypoints: wptPayload,
        withAlternatives: true,
      });
      if ("error" in res) {
        setError(res.error);
        onRouteReady(null);
        return;
      }
      onRouteReady(res);
    });
  }

  return (
    <div
      id="route-planner-bar"
      className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
        open
          ? "max-h-[600px] opacity-100"
          : "max-h-0 opacity-0 pointer-events-none"
      }`}
      style={{
        background: "linear-gradient(180deg, #f5f2ec 0%, #efeae0 100%)",
        borderBottom: open ? "1px solid var(--card-border)" : "none",
      }}
      aria-hidden={!open}
    >
      <div className="px-4 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <Route
              className="w-3.5 h-3.5"
              style={{ color: "var(--accent-dark)" }}
              aria-hidden
            />
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--accent-dark)" }}
            >
              Rota
            </span>
          </div>

          <FieldRow label="Origem">
            <OriginSegmented
              origins={origins}
              origin={origin}
              fallbackOriginId={fallbackOriginId}
              onPickFixed={setOriginFixed}
              onPickCustom={setOriginCustom}
            />
            {origin.kind === "custom" && (
              <div className="w-[180px] shrink-0">
                {origin.addr ? (
                  <ResolvedOriginCard
                    addr={origin.addr}
                    onClear={() => setOrigin({ kind: "custom", addr: null })}
                  />
                ) : (
                  <div
                    className="h-8 rounded-md flex items-center"
                    style={{
                      background: "white",
                      border: "1px solid var(--accent)",
                    }}
                  >
                    <AddressAutocomplete
                      placeholder="Endereço de origem…"
                      initialLabel=""
                      autoFocus
                      compact
                      onResolved={(addr) =>
                        setOrigin({ kind: "custom", addr })
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </FieldRow>

          <ArrowRight
            className="w-4 h-4 shrink-0"
            style={{ color: "var(--text-light)" }}
            aria-hidden
          />

          <FieldRow label="Destino" labelId={destLabelId} grow>
            {selectedCompany ? (
              <div
                className="h-8 flex items-center gap-2 px-2.5 rounded-md transition-colors min-w-0 w-full"
                style={{
                  background: justAdded ? "rgba(45,122,62,0.10)" : "white",
                  border: `1px solid ${
                    justAdded ? "#2d7a3e" : "var(--accent2)"
                  }`,
                }}
                aria-labelledby={destLabelId}
              >
                <MapPin
                  className="w-3.5 h-3.5 shrink-0"
                  style={{
                    color: justAdded ? "#2d7a3e" : "var(--accent2)",
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                  <span
                    className="text-[12px] font-semibold truncate leading-none"
                    style={{ color: "var(--text)" }}
                  >
                    {selectedCompany.name}
                  </span>
                  <span
                    className="text-[10.5px] truncate leading-none hidden sm:inline"
                    style={{ color: "var(--text-dim)" }}
                  >
                    · {selectedCompany.city}/{selectedCompany.state}
                  </span>
                </div>
                {justAdded && (
                  <span
                    className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider px-1.5 h-5 rounded-full shrink-0"
                    style={{ background: "#2d7a3e", color: "white" }}
                  >
                    <Check className="w-2.5 h-2.5" />
                    Adicionada
                  </span>
                )}
                <button
                  type="button"
                  onClick={onClearSelection}
                  className={`p-0.5 rounded hover:bg-black/5 cursor-pointer shrink-0 ${focusRing}`}
                  style={{ color: "var(--text-light)" }}
                  title="Remover destino"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                className="h-8 px-2.5 rounded-md text-[11.5px] flex items-center gap-2 w-full"
                style={{
                  background: "rgba(255,255,255,0.5)",
                  border: "1px dashed var(--card-border)",
                  color: "var(--text-light)",
                }}
                aria-labelledby={destLabelId}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  Clique numa empresa na lista para definir o destino…
                </span>
              </div>
            )}
          </FieldRow>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={addWaypoint}
              disabled={waypoints.length >= 3}
              title="Adicionar parada (até 3)"
              className={`h-8 flex items-center gap-1 px-2.5 rounded-md text-[11px] font-semibold cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${focusRing}`}
              style={{
                background: "white",
                border: "1px solid var(--card-border)",
                color: "var(--text-dim)",
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Parada
            </button>
            <button
              type="button"
              onClick={tracar}
              disabled={pending}
              className={`h-8 flex items-center gap-1.5 px-3 rounded-md text-[11.5px] font-bold cursor-pointer hover:opacity-90 disabled:opacity-60 ${focusRing}`}
              style={{ background: "var(--accent)", color: "white" }}
            >
              <Route className="w-3.5 h-3.5" />
              {pending ? "Calculando…" : "Traçar rota"}
            </button>

            <span
              className="w-px h-5 shrink-0"
              style={{ background: "var(--card-border)" }}
              aria-hidden
            />

            <button
              type="button"
              onClick={clearRoute}
              disabled={!customRoute}
              title="Limpar rota traçada"
              className={`h-8 px-2.5 rounded-md text-[11px] font-semibold cursor-pointer hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed ${focusRing}`}
              style={{ background: "transparent", color: "var(--text-dim)" }}
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fechar planejador (Esc)"
              className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 cursor-pointer ${focusRing}`}
              style={{ color: "var(--text-dim)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {waypoints.length > 0 && (
          <div
            className="mt-2.5 pt-2.5 flex items-center gap-2 flex-wrap"
            style={{ borderTop: "1px dashed var(--card-border)" }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.14em] shrink-0"
              style={{ color: "var(--text-light)" }}
            >
              Paradas
            </span>
            {waypoints.map((w, i) => (
              <div
                key={i}
                className="h-8 flex items-center rounded-md overflow-hidden"
                style={{
                  background: "white",
                  border: "1px solid var(--card-border)",
                  minWidth: 240,
                  maxWidth: 320,
                }}
              >
                <span
                  className="flex items-center justify-center w-7 h-full text-[10px] font-bold shrink-0 border-r"
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    borderColor: "var(--accent)",
                  }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 px-1">
                  <AddressAutocomplete
                    placeholder={`Parada ${i + 1}`}
                    initialLabel={w?.label ?? ""}
                    compact
                    onResolved={(addr) => setWaypoint(i, addr)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeWaypoint(i)}
                  className={`w-7 h-full flex items-center justify-center cursor-pointer hover:bg-black/5 shrink-0 ${focusRing}`}
                  style={{ color: "#c1322f" }}
                  title="Remover parada"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {(error || customRoute) && (
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            {error && (
              <div
                className="flex items-start gap-2 px-2.5 py-1.5 rounded-md text-[11.5px]"
                style={{
                  background: "rgba(193,50,47,0.10)",
                  color: "#c1322f",
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {customRoute && !error && (
              <div
                className="px-2.5 py-1.5 rounded-md text-[11.5px] flex items-center gap-2"
                style={{
                  background: "rgba(45,122,62,0.10)",
                  color: "var(--text-dim)",
                  border: "1px solid rgba(45,122,62,0.25)",
                }}
              >
                <Check
                  className="w-3.5 h-3.5"
                  style={{ color: "#2d7a3e" }}
                  aria-hidden
                />
                <span>
                  <strong style={{ color: "#2d7a3e" }}>Rota ativa:</strong>{" "}
                  {customRoute.distanceKm.toLocaleString("pt-BR")} km ·{" "}
                  {formatDuration(customRoute.durationMin)}
                  {customRoute.durationMinTraffic != null &&
                    customRoute.durationMinTraffic !==
                      customRoute.durationMin && (
                      <>
                        {" · "}
                        {formatDuration(customRoute.durationMinTraffic)} c/
                        trânsito
                      </>
                    )}
                  {customRoute.tollsBRL != null &&
                    customRoute.tollsBRL > 0 && (
                      <>
                        {" · "}
                        Pedágio{" "}
                        {customRoute.tollsBRL.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 2,
                        })}
                      </>
                    )}
                  {customRoute.alternatives.length > 0 && (
                    <>
                      {" · "}
                      {customRoute.alternatives.length} alternativa
                      {customRoute.alternatives.length > 1 ? "s" : ""}
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  labelId,
  children,
  grow,
}: {
  label: string;
  labelId?: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 ${grow ? "flex-1 min-w-[160px] max-w-[280px]" : ""}`}
    >
      <span
        id={labelId}
        className="text-[9.5px] font-bold uppercase tracking-[0.14em] shrink-0"
        style={{ color: "var(--text-light)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function OriginSegmented({
  origins,
  origin,
  fallbackOriginId,
  onPickFixed,
  onPickCustom,
}: {
  origins: Origin[];
  origin: OriginChoice;
  fallbackOriginId: string;
  onPickFixed: (id: string) => void;
  onPickCustom: () => void;
}) {
  const isCustom = origin.kind === "custom";
  return (
    <div
      className="inline-flex items-center h-8 p-0.5 rounded-md shrink-0 flex-wrap"
      style={{
        background: "white",
        border: "1px solid var(--card-border)",
      }}
      role="radiogroup"
      aria-label="Origem"
    >
      {origins.map((o) => {
        const active = origin.kind === "fixed" && origin.id === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onPickFixed(o.id)}
            title={o.short}
            className={`h-7 px-2 rounded text-[11px] font-semibold leading-none transition cursor-pointer ${focusRing}`}
            style={{
              background: active ? o.color : "transparent",
              color: active ? "white" : "var(--text-dim)",
            }}
          >
            {o.short}
          </button>
        );
      })}
      <button
        type="button"
        role="radio"
        aria-checked={isCustom}
        onClick={isCustom ? () => onPickFixed(fallbackOriginId) : onPickCustom}
        disabled={!fallbackOriginId && isCustom}
        title={
          isCustom ? "Voltar para origem fixa" : "Usar um endereço personalizado"
        }
        className={`h-7 px-2 rounded text-[11px] font-semibold leading-none transition cursor-pointer flex items-center gap-1 ${focusRing}`}
        style={{
          background: isCustom ? "var(--accent)" : "transparent",
          color: isCustom ? "white" : "var(--text-dim)",
        }}
      >
        <MapPin className="w-3 h-3" />
        Outro
      </button>
    </div>
  );
}

function ResolvedOriginCard({
  addr,
  onClear,
}: {
  addr: ResolvedAddress;
  onClear: () => void;
}) {
  const commaIdx = addr.label.indexOf(",");
  const primary =
    commaIdx > 0 ? addr.label.slice(0, commaIdx).trim() : addr.label;
  const secondary =
    commaIdx > 0 ? addr.label.slice(commaIdx + 1).trim() : null;

  return (
    <div
      className="h-8 flex items-center gap-2 px-2.5 rounded-md min-w-0"
      style={{
        background: "white",
        border: "1px solid var(--accent)",
      }}
    >
      <MapPin
        className="w-3.5 h-3.5 shrink-0"
        style={{ color: "var(--accent)" }}
        aria-hidden
      />
      <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
        <span
          className="text-[12px] font-semibold truncate leading-none"
          style={{ color: "var(--text)" }}
          title={addr.label}
        >
          {primary}
        </span>
        {secondary && (
          <span
            className="text-[10.5px] truncate leading-none hidden sm:inline"
            style={{ color: "var(--text-dim)" }}
          >
            · {secondary}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onClear}
        className={`p-0.5 rounded hover:bg-black/5 cursor-pointer shrink-0 ${focusRing}`}
        style={{ color: "var(--text-light)" }}
        title="Trocar endereço"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
