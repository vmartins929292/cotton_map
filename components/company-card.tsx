"use client";

import { Company, Origin, TYPE_COLORS, TYPE_LABELS, originShortLabel } from "@/data/types";

interface CompanyCardProps {
  company: Company;
  origins: Origin[];
  isSelected: boolean;
  /** Conjunto de originIds com rota ativa (desenhada no mapa) para esta empresa. */
  activeOrigins: Set<string>;
  /** Conjunto de originIds carregando rota para esta empresa. */
  loadingOrigins: Set<string>;
  /**
   * Distancia em LINHA RETA (Haversine) por origem. Usado SOMENTE como fallback
   * quando a empresa nao tem rota real cacheada (raro: caso o cadastro tenha falhado).
   */
  fallbackDistances?: Record<string, number>;
  onClick: () => void;
  onToggleRoute: (originId: string) => void;
}

export default function CompanyCard({
  company: c,
  origins,
  isSelected,
  activeOrigins,
  loadingOrigins,
  fallbackDistances,
  onClick,
  onToggleRoute,
}: CompanyCardProps) {
  const typeColor = TYPE_COLORS[c.type];

  // Ordena as origens por distancia ASC (mais perto no topo). Origens sem
  // distancia conhecida (nem real nem fallback) caem no final via Infinity.
  const sortedOrigins = [...origins].sort((a, b) => {
    const da =
      c.distancesByOrigin?.[a.id] ?? fallbackDistances?.[a.id] ?? Infinity;
    const db =
      c.distancesByOrigin?.[b.id] ?? fallbackDistances?.[b.id] ?? Infinity;
    return da - db;
  });

  return (
    <div
      onClick={onClick}
      className="px-4 py-3 cursor-pointer transition-all flex items-stretch gap-2.5"
      style={{
        borderBottom: "1px solid var(--card-border)",
        borderLeft: `3px solid ${isSelected ? "var(--accent)" : "transparent"}`,
        background: isSelected ? "rgba(31,91,58,0.06)" : "var(--bg-paper)",
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[13px]" style={{ color: "var(--text)" }}>
          {c.name}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>
          {c.city} — {c.state}
        </div>

        <div className="flex gap-1 mt-1.5 flex-wrap">
          <span
            className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold"
            style={{ background: `${typeColor}1F`, color: typeColor }}
          >
            {TYPE_LABELS[c.type]}
          </span>
          {c.bci && (
            <span
              className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold"
              style={{
                background: "rgba(45,122,62,0.15)",
                color: "var(--green)",
                border: "1px solid rgba(45,122,62,0.3)",
              }}
            >
              BCI ✓
            </span>
          )}
        </div>
      </div>

      <div
        aria-hidden
        style={{
          width: 1,
          alignSelf: "stretch",
          background: "var(--card-border)",
        }}
      />

      <div className="flex flex-col gap-1 shrink-0" style={{ width: 168 }}>
        {sortedOrigins.map((o) => (
          <RouteToggle
            key={o.id}
            origin={o}
            realValue={c.distancesByOrigin?.[o.id]}
            fallbackValue={fallbackDistances?.[o.id]}
            isActive={activeOrigins.has(o.id)}
            isLoading={loadingOrigins.has(o.id)}
            onClick={() => onToggleRoute(o.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface RouteToggleProps {
  origin: Origin;
  realValue?: number;
  fallbackValue?: number;
  isActive: boolean;
  isLoading: boolean;
  onClick: () => void;
}

function RouteToggle({
  origin,
  realValue,
  fallbackValue,
  isActive,
  isLoading,
  onClick,
}: RouteToggleProps) {
  const color = origin.color;
  const municipality = originShortLabel(origin);

  const showReal = realValue != null;
  const showFallback = !showReal && fallbackValue != null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={isLoading}
      title={
        isActive
          ? `Ocultar rota desde ${municipality}`
          : showReal
          ? `Traçar rota desde ${municipality} (${realValue!.toLocaleString(
              "pt-BR"
            )} km por estrada)`
          : showFallback
          ? `Traçar rota desde ${municipality} (estimativa em linha reta: ~${fallbackValue!.toLocaleString(
              "pt-BR"
            )} km — rota real ainda nao calculada)`
          : `Traçar rota desde ${municipality}`
      }
      className="text-[10px] flex items-center gap-1.5 px-2 py-1 rounded-md font-semibold transition-all cursor-pointer disabled:cursor-wait hover:scale-[1.04] active:scale-[0.98] w-full justify-between"
      style={{
        background: isActive ? color : "transparent",
        color: isActive ? "white" : color,
        border: `1.5px solid ${color}`,
        opacity: isLoading ? 0.6 : 1,
      }}
    >
      <span className="flex items-center gap-1.5 min-w-0 flex-1">
        {isLoading ? (
          <span
            className="inline-block w-[8px] h-[8px] rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
            aria-hidden
          />
        ) : (
          <span
            className="w-[7px] h-[7px] rounded-full inline-block shrink-0"
            style={{ background: isActive ? "white" : color }}
          />
        )}
        <span className="text-left leading-tight truncate">{municipality}</span>
      </span>
      {showReal && (
        <span
          className="shrink-0"
          style={{
            opacity: isActive ? 0.95 : 0.85,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {realValue!.toLocaleString("pt-BR")}
        </span>
      )}
      {showFallback && (
        <span
          className="shrink-0"
          style={{
            opacity: isActive ? 0.7 : 0.55,
            fontStyle: "italic",
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ~{fallbackValue!.toLocaleString("pt-BR")}
        </span>
      )}
    </button>
  );
}
