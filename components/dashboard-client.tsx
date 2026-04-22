"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { List, Lock, LogOut, Route, Shield } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import {
  getRouteAction,
  type RouteResult,
  type CustomRouteResult,
} from "@/app/actions/routes";
import {
  Company,
  CompanyType,
  Origin,
  Region,
  TYPE_COLORS,
  TYPE_LABELS,
  originShortLabel,
} from "@/data/types";
import type { RouteStep } from "@/lib/route-types";
import { matchesSearch } from "@/lib/search";
import { sortByDistance } from "@/lib/companies-utils";
import { computeDistancesByOrigin, haversine } from "@/lib/distance";
import StatsBar from "@/components/stats-bar";
import SidebarFilters from "@/components/sidebar-filters";
import CompanyCard from "@/components/company-card";
import CompanyDetailDialog from "@/components/company-detail-dialog";
import RoutePlanner from "@/components/route-planner";
import RouteInstructionsDrawer from "@/components/route-instructions-drawer";
import type { CustomMapRoute } from "@/components/map-view";

type RouteKey = `${string}:${string}`;
type ActiveRoute = {
  companyId: string;
  originId: string;
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
  durationMinTraffic: number | null;
  tollsBRL: number | null;
  steps: RouteStep[];
};

const MapView = dynamic(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <p style={{ color: "var(--text-dim)" }}>Carregando mapa...</p>
    </div>
  ),
});

export default function DashboardClient({
  companies,
  origins,
  isAdmin = false,
}: {
  companies: Company[];
  origins: Origin[];
  isAdmin?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [activeRegion, setActiveRegion] = useState<Region | "all">("all");
  const [activeType, setActiveType] = useState<CompanyType | null>(null);
  const [originId, setOriginId] = useState<string>(
    () => origins[0]?.id ?? ""
  );
  /**
   * Origem custom (efemera) usada SOMENTE para ordenar a lista por distancia.
   * Nao gera chips no card nem rotas tracadas no mapa; e Haversine puro.
   */
  const [customSortOrigin, setCustomSortOrigin] = useState<{
    label: string;
    lat: number;
    lng: number;
  } | null>(null);
  const CUSTOM_SORT_ID = "__custom_sort__";
  const [bciOnly, setBciOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [activeRoutes, setActiveRoutes] = useState<Map<RouteKey, ActiveRoute>>(
    new Map()
  );
  const [loadingRoutes, setLoadingRoutes] = useState<Set<RouteKey>>(new Set());
  /**
   * Cache local de distancias REAIS calculadas nesta sessao.
   * Usado para atualizar o chip do card imediatamente apos o calculo, sem esperar
   * o RSC revalidar. Persiste mesmo quando a polyline e desativada (toggle off).
   */
  const [freshDistances, setFreshDistances] = useState<
    Map<RouteKey, { distanceKm: number; durationMin: number }>
  >(new Map());
  const router = useRouter();
  const [routeError, setRouteError] = useState<string | null>(null);
  const [customRoute, setCustomRoute] = useState<CustomRouteResult | null>(null);
  const [activeAlternativeIdx, setActiveAlternativeIdx] = useState<number | null>(
    null
  );
  const [routePlannerOpen, setRoutePlannerOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructionsData, setInstructionsData] = useState<{
    steps: RouteStep[];
    title: string;
  }>({ steps: [], title: "" });

  // Mapa rapido originId -> Origin (para popups, polylines etc.)
  const originsById = useMemo(() => {
    const m = new Map<string, Origin>();
    for (const o of origins) m.set(o.id, o);
    return m;
  }, [origins]);

  /**
   * Empresas com distancias REAIS recem-calculadas mescladas em distancesByOrigin.
   * Substitui o array original em filtros, ordenacao e render — assim o chip,
   * a ordenacao e a busca passam a ver o valor real imediatamente.
   */
  const companiesWithFresh = useMemo(() => {
    if (freshDistances.size === 0) return companies;
    // Indexa fresh por companyId pra evitar varredura quadratica.
    const byCompany = new Map<string, Record<string, number>>();
    freshDistances.forEach((v, key) => {
      const sep = key.indexOf(":");
      if (sep < 0) return;
      const cid = key.slice(0, sep);
      const oid = key.slice(sep + 1);
      const existing = byCompany.get(cid) ?? {};
      existing[oid] = v.distanceKm;
      byCompany.set(cid, existing);
    });
    if (byCompany.size === 0) return companies;
    return companies.map((c) => {
      const fresh = byCompany.get(c.id);
      if (!fresh) return c;
      return {
        ...c,
        distancesByOrigin: { ...(c.distancesByOrigin ?? {}), ...fresh },
      };
    });
  }, [companies, freshDistances]);

  // Fallback Haversine pre-computado por empresa (so usado se a rota real nao existir).
  // Inclui a origem custom (se houver) sob a chave CUSTOM_SORT_ID.
  const fallbackByCompany = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    for (const c of companies) {
      out[c.id] = computeDistancesByOrigin(c.lat, c.lng, origins);
      if (customSortOrigin) {
        out[c.id][CUSTOM_SORT_ID] = Math.round(
          haversine(c.lat, c.lng, customSortOrigin.lat, customSortOrigin.lng)
        );
      }
    }
    return out;
  }, [companies, origins, customSortOrigin]);

  const toggleRoute = useCallback(
    async (companyId: string, originIdArg: string) => {
      const key: RouteKey = `${companyId}:${originIdArg}`;

      if (activeRoutes.has(key)) {
        setActiveRoutes((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        return;
      }

      if (loadingRoutes.has(key)) return;

      setLoadingRoutes((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setRouteError(null);

      const result = await getRouteAction(companyId, originIdArg);

      setLoadingRoutes((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      if ("error" in result) {
        setRouteError(result.error);
        return;
      }

      const r = result as RouteResult;
      const route: ActiveRoute = {
        companyId,
        originId: originIdArg,
        coords: r.coords,
        distanceKm: r.distanceKm,
        durationMin: r.durationMin,
        durationMinTraffic: r.durationMinTraffic,
        tollsBRL: r.tollsBRL,
        steps: r.steps,
      };
      setActiveRoutes((prev) => {
        const next = new Map(prev);
        next.set(key, route);
        return next;
      });
      // Atualiza o chip do card imediatamente com a distancia real recem-calculada.
      setFreshDistances((prev) => {
        const next = new Map(prev);
        next.set(key, {
          distanceKm: Math.round(r.distanceKm),
          durationMin: r.durationMin,
        });
        return next;
      });
      // Revalida o RSC em background para sincronizar c.distancesByOrigin com o banco.
      router.refresh();
    },
    [activeRoutes, loadingRoutes, router]
  );

  const getActiveOriginsForCompany = useCallback(
    (companyId: string): Set<string> => {
      const set = new Set<string>();
      activeRoutes.forEach((r) => {
        if (r.companyId === companyId) set.add(r.originId);
      });
      return set;
    },
    [activeRoutes]
  );

  const getLoadingOriginsForCompany = useCallback(
    (companyId: string): Set<string> => {
      const set = new Set<string>();
      loadingRoutes.forEach((key) => {
        const sep = key.indexOf(":");
        if (sep < 0) return;
        const cid = key.slice(0, sep);
        const oid = key.slice(sep + 1);
        if (cid === companyId) set.add(oid);
      });
      return set;
    },
    [loadingRoutes]
  );

  const routesForMap = useMemo(
    () => Array.from(activeRoutes.values()),
    [activeRoutes]
  );

  const customRoutesForMap = useMemo<CustomMapRoute[]>(() => {
    if (!customRoute) return [];
    const all: CustomMapRoute[] = [];
    const altIdx = activeAlternativeIdx;
    const useAltAsPrimary =
      altIdx != null && altIdx >= 0 && altIdx < customRoute.alternatives.length;

    if (useAltAsPrimary) {
      const alt = customRoute.alternatives[altIdx];
      all.push({
        id: "custom-primary",
        coords: alt.coords,
        distanceKm: alt.distanceKm,
        durationMin: alt.durationMin,
        durationMinTraffic: alt.durationMinTraffic,
        tollsBRL: alt.tollsBRL,
        steps: alt.steps,
        origin: customRoute.origin,
        destination: customRoute.destination,
        waypoints: customRoute.waypoints,
        isAlternative: false,
        altLabel: alt.label,
      });
      all.push({
        id: "custom-alt-primary",
        coords: customRoute.coords,
        distanceKm: customRoute.distanceKm,
        durationMin: customRoute.durationMin,
        durationMinTraffic: customRoute.durationMinTraffic,
        tollsBRL: customRoute.tollsBRL,
        steps: customRoute.steps,
        origin: customRoute.origin,
        destination: customRoute.destination,
        waypoints: customRoute.waypoints,
        isAlternative: true,
        altLabel: "Principal (Google)",
      });
      customRoute.alternatives.forEach((a, i) => {
        if (i === altIdx) return;
        all.push({
          id: `custom-alt-${i}`,
          coords: a.coords,
          distanceKm: a.distanceKm,
          durationMin: a.durationMin,
          durationMinTraffic: a.durationMinTraffic,
          tollsBRL: a.tollsBRL,
          steps: a.steps,
          origin: customRoute.origin,
          destination: customRoute.destination,
          waypoints: customRoute.waypoints,
          isAlternative: true,
          altLabel: a.label,
        });
      });
    } else {
      all.push({
        id: "custom-primary",
        coords: customRoute.coords,
        distanceKm: customRoute.distanceKm,
        durationMin: customRoute.durationMin,
        durationMinTraffic: customRoute.durationMinTraffic,
        tollsBRL: customRoute.tollsBRL,
        steps: customRoute.steps,
        origin: customRoute.origin,
        destination: customRoute.destination,
        waypoints: customRoute.waypoints,
        isAlternative: false,
      });
      customRoute.alternatives.forEach((a, i) => {
        all.push({
          id: `custom-alt-${i}`,
          coords: a.coords,
          distanceKm: a.distanceKm,
          durationMin: a.durationMin,
          durationMinTraffic: a.durationMinTraffic,
          tollsBRL: a.tollsBRL,
          steps: a.steps,
          origin: customRoute.origin,
          destination: customRoute.destination,
          waypoints: customRoute.waypoints,
          isAlternative: true,
          altLabel: a.label,
        });
      });
    }
    return all;
  }, [customRoute, activeAlternativeIdx]);

  const handleSelectCompany = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (!routePlannerOpen) setDetailId(id);
    },
    [routePlannerOpen]
  );

  const openRoutePlanner = useCallback(() => {
    setRoutePlannerOpen((v) => !v);
  }, []);

  const openInstructions = useCallback(
    (steps: RouteStep[], title: string) => {
      setInstructionsData({ steps, title });
      setInstructionsOpen(true);
    },
    []
  );

  const onPickAlternative = useCallback(
    (id: string) => {
      if (!customRoute) return;
      if (id === "custom-alt-primary") {
        setActiveAlternativeIdx(null);
        return;
      }
      const m = id.match(/^custom-alt-(\d+)$/);
      if (!m) return;
      setActiveAlternativeIdx(Number(m[1]));
    },
    [customRoute]
  );

  const filtered = useMemo(() => {
    let list = [...companiesWithFresh];
    if (activeRegion !== "all") list = list.filter((c) => c.region === activeRegion);
    if (activeType) list = list.filter((c) => c.type === activeType);
    if (bciOnly) list = list.filter((c) => c.bci);
    if (search.trim()) {
      list = list.filter((c) => matchesSearch(c, search));
    }
    return sortByDistance(list, originId, fallbackByCompany);
  }, [
    companiesWithFresh,
    search,
    activeRegion,
    activeType,
    bciOnly,
    originId,
    fallbackByCompany,
  ]);

  const detailCompany = detailId
    ? companiesWithFresh.find((c) => c.id === detailId) ?? null
    : null;
  const selectedCompany = selectedId
    ? companiesWithFresh.find((c) => c.id === selectedId) ?? null
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 flex-wrap gap-2 relative z-20"
        style={{
          background: "linear-gradient(135deg, #fdfbf6 0%, #f5f2ec 100%)",
          borderBottom: "2px solid var(--accent)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="VALOR AG Commodities" className="h-8 w-auto" />
          <div>
            <h1
              className="text-[17px] font-extrabold tracking-wide"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: "var(--accent-dark)",
              }}
            >
              MAPA NACIONAL — COMPRADORES DE ALGODÃO
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>
              Prospecção Comercial · VALOR AG COMMODITIES
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatsBar companies={companies} />
          <Link
            href="/empresas"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--accent2)", color: "white" }}
          >
            <List className="w-3.5 h-3.5" />
            Lista por Estado
          </Link>
          <button
            type="button"
            onClick={openRoutePlanner}
            title="Abrir / fechar planejador de rotas"
            aria-expanded={routePlannerOpen}
            aria-controls="route-planner-bar"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80 cursor-pointer"
            style={{
              background: routePlannerOpen
                ? "var(--accent-dark)"
                : "var(--accent)",
              color: "white",
              boxShadow: routePlannerOpen
                ? "inset 0 2px 4px rgba(0,0,0,0.2)"
                : undefined,
            }}
          >
            <Route className="w-3.5 h-3.5" />
            Planejador de Rotas
            {customRoute && (
              <span
                className="ml-1 px-1.5 rounded-full text-[10px] font-bold leading-none flex items-center justify-center min-w-[18px] h-[18px]"
                style={{ background: "white", color: "var(--accent)" }}
                title="Rota traçada"
              >
                1
              </span>
            )}
          </button>
          <AdminButton isAdmin={isAdmin} />
          <button
            onClick={() => setShowHelp(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer transition-transform hover:scale-110"
            style={{
              background: "var(--accent)",
              boxShadow: "0 2px 8px rgba(31,91,58,0.3)",
            }}
          >
            ?
          </button>
        </div>
      </header>

      {/* Barra do Planejador de Rotas */}
      <RoutePlanner
        open={routePlannerOpen}
        onClose={() => setRoutePlannerOpen(false)}
        origins={origins}
        selectedCompany={selectedCompany}
        customRoute={customRoute}
        onRouteReady={(r) => {
          setCustomRoute(r);
          setActiveAlternativeIdx(null);
        }}
        onClearSelection={() => setSelectedId(null)}
      />

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-[340px_1fr] max-lg:grid-cols-1 max-lg:grid-rows-[50vh_1fr] overflow-hidden">
        {/* Sidebar */}
        <div
          className="overflow-y-auto max-lg:order-2"
          style={{
            background: "var(--bg-paper)",
            borderRight: "1px solid var(--card-border)",
          }}
        >
          <SidebarFilters
            origins={origins}
            search={search}
            onSearchChange={setSearch}
            activeRegion={activeRegion}
            onRegionChange={setActiveRegion}
            activeType={activeType}
            onTypeChange={setActiveType}
            sortOriginId={originId}
            onSortOriginChange={setOriginId}
            bciOnly={bciOnly}
            onBciChange={setBciOnly}
            customSortOrigin={customSortOrigin}
            customSortOriginId={CUSTOM_SORT_ID}
            onCustomSortOriginChange={(o) => {
              setCustomSortOrigin(o);
              if (o) {
                setOriginId(CUSTOM_SORT_ID);
              } else if (originId === CUSTOM_SORT_ID) {
                setOriginId(origins[0]?.id ?? "");
              }
            }}
          />
          <div>
            {filtered.map((c) => (
              <CompanyCard
                key={c.id}
                company={c}
                origins={origins}
                isSelected={selectedId === c.id}
                activeOrigins={getActiveOriginsForCompany(c.id)}
                loadingOrigins={getLoadingOriginsForCompany(c.id)}
                fallbackDistances={fallbackByCompany[c.id]}
                onToggleRoute={(o) => toggleRoute(c.id, o)}
                onClick={() => handleSelectCompany(c.id)}
              />
            ))}
            {filtered.length === 0 && (
              <div
                className="p-8 text-center text-sm"
                style={{ color: "var(--text-light)" }}
              >
                Nenhuma empresa encontrada.
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div
          className="relative max-lg:order-1"
          style={{ background: "var(--bg-paper)" }}
        >
          <MapView
            companies={filtered}
            origins={origins}
            selectedId={selectedId}
            routes={routesForMap}
            customRoutes={customRoutesForMap}
            onSelectCompany={handleSelectCompany}
            onShowInstructions={openInstructions}
            onPickAlternative={onPickAlternative}
            onReset={() => {
              // Limpa rotas tra\u00e7adas (chips do card + rota custom do planejador)
              // e qualquer estado visual associado. O fly-to do mapa em si e feito
              // pelo proprio controle dentro do MapView.
              setActiveRoutes(new Map());
              setCustomRoute(null);
              setActiveAlternativeIdx(null);
              setRouteError(null);
              setSelectedId(null);
            }}
          />

          {routeError && (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] px-4 py-2 rounded-lg text-[12px] font-semibold flex items-center gap-3 max-w-[90%]"
              style={{
                background: "rgba(193,50,47,0.95)",
                color: "white",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              }}
            >
              <span className="leading-snug">{routeError}</span>
              <button
                onClick={() => setRouteError(null)}
                className="text-white/80 hover:text-white text-base leading-none cursor-pointer"
                aria-label="Fechar"
              >
                &times;
              </button>
            </div>
          )}

          {/* Legend */}
          <div
            className="absolute bottom-3 right-3 px-2.5 py-2 rounded-lg z-[400]"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            }}
          >
            <h4
              className="text-[8.5px] font-bold uppercase tracking-[0.12em] mb-1.5"
              style={{ color: "var(--text-light)" }}
            >
              Legenda
            </h4>
            <div className="space-y-[3px]">
              {(Object.keys(TYPE_LABELS) as CompanyType[]).map((t) => (
                <LegendItem
                  key={t}
                  color={TYPE_COLORS[t]}
                  label={TYPE_LABELS[t]}
                />
              ))}
            </div>
            <div
              className="mt-1.5 pt-1.5 space-y-[3px]"
              style={{ borderTop: "1px solid var(--card-border)" }}
            >
              {origins.map((o) => (
                <OriginLegend key={o.id} color={o.color} label={originShortLabel(o)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <RouteInstructionsDrawer
        open={instructionsOpen}
        title={instructionsData.title}
        steps={instructionsData.steps}
        onClose={() => setInstructionsOpen(false)}
      />

      {detailCompany && (
        <CompanyDetailDialog
          company={detailCompany}
          origins={origins}
          isAdmin={isAdmin}
          onClose={() => setDetailId(null)}
        />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* Reservado para uso futuro: lookup originsById em rotas no mapa */}
      <span style={{ display: "none" }} aria-hidden>
        {originsById.size}
      </span>
    </div>
  );
}

function AdminButton({ isAdmin }: { isAdmin: boolean }) {
  const [pending, start] = useTransition();
  if (!isAdmin) {
    return (
      <Link
        href="/admin"
        title="Acessar painel administrativo"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
        style={{ background: "var(--accent-dark)", color: "white" }}
      >
        <Lock className="w-3.5 h-3.5" />
        Admin
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/admin"
        title="Painel administrativo"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
        style={{ background: "var(--accent-dark)", color: "white" }}
      >
        <Shield className="w-3.5 h-3.5" />
        Admin
      </Link>
      <button
        onClick={() => start(() => logoutAction())}
        disabled={pending}
        title="Sair do admin"
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80 cursor-pointer disabled:opacity-50"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--card-border)",
          color: "var(--text-dim)",
        }}
      >
        <LogOut className="w-3.5 h-3.5" />
        Sair
      </button>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div
      className="flex items-center gap-1.5 leading-none"
      style={{ color: "var(--text-dim)", fontSize: "10.5px" }}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      {label}
    </div>
  );
}

function OriginLegend({ color, label }: { color: string; label: string }) {
  return (
    <div
      className="flex items-center gap-1.5 leading-none"
      style={{ color: "var(--text-dim)", fontSize: "10.5px" }}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ border: `1.5px solid ${color}`, background: "transparent" }}
      />
      {label}
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-5"
      style={{ background: "rgba(26,31,46,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-7 relative"
        style={{
          background: "var(--bg-paper)",
          border: "1px solid var(--card-border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-black/5 transition cursor-pointer"
        >
          <span className="text-xl" style={{ color: "var(--text-dim)" }}>
            ✕
          </span>
        </button>

        <h2
          className="text-xl font-bold"
          style={{
            fontFamily: "'Playfair Display', serif",
            color: "var(--accent-dark)",
          }}
        >
          Glossário & Legenda Técnica
        </h2>
        <p className="text-xs mt-1 mb-4" style={{ color: "var(--text-dim)" }}>
          Entendendo as classificações do mapa para melhor abordagem comercial
        </p>

        <Section title="Tipos de Empresa">
          <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            <TypeCard
              color="#1e6091"
              name="Fiação Pura"
              desc="Compra pluma e transforma apenas em fio. O algodão é 100% matéria-prima deles — são seus compradores diretos mais óbvios."
            />
            <TypeCard
              color="#c13299"
              name="Integrada"
              desc="Possui fiação + tecelagem. Consome grandes volumes de pluma, muitas vezes comprando direto do produtor."
            />
            <TypeCard
              color="#b86a1e"
              name="Denim/Índigo"
              desc="Focado em denim (jeans). Consomem alto volume de algodão de fibra média-longa para resistência."
            />
            <TypeCard
              color="#2d7a3e"
              name="Malharia/Confecção"
              desc="Muitas têm fiação própria verticalizada. Podem comprar pluma diretamente ou fio já pronto."
            />
            <TypeCard
              color="#6b7280"
              name="Comercial / Trading"
              desc="Distribuidoras, traders e representantes comerciais. Não consomem pluma diretamente, mas movimentam grande volume de fios e podem influenciar a cadeia."
            />
          </div>
        </Section>

        <Section title="Certificação BCI">
          <p
            className="text-[12.5px] leading-relaxed"
            style={{ color: "var(--text)" }}
          >
            <strong>Better Cotton Initiative</strong> — Padrão global de
            sustentabilidade. Empresas com selo BCI{" "}
            <strong>exigem pluma certificada</strong> e pagam prêmio sobre o
            convencional. Se seus produtores têm certificação BCI/ABR, essas são as
            contas mais fáceis de abrir e de maior ticket.
          </p>
        </Section>

        <Section title="Terminologia dos Fios">
          <ul
            className="text-[12.5px] space-y-1.5 list-disc ml-4"
            style={{ color: "var(--text)" }}
          >
            <li>
              <strong>Penteado:</strong> fio premium — exige pluma de fibra longa
              (UHML ≥ 1.10&quot;). Maior valor agregado.
            </li>
            <li>
              <strong>Cardado:</strong> fio convencional — aceita fibra média.
              Menor valor, maior volume.
            </li>
            <li>
              <strong>Open-End (OE):</strong> fiação por rotor. Aceita fibra curta.
              Usado em malharia básica, jeans rústico.
            </li>
            <li>
              <strong>Compactado:</strong> fio penteado com processo adicional de
              compactação. Maior resistência.
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h3
        className="text-[14px] font-bold mb-2 pl-3"
        style={{
          fontFamily: "'Playfair Display', serif",
          color: "var(--accent-dark)",
          borderLeft: "3px solid var(--accent)",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function TypeCard({
  color,
  name,
  desc,
}: {
  color: string;
  name: string;
  desc: string;
}) {
  return (
    <div
      className="p-3 rounded-lg"
      style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
    >
      <div className="flex items-center gap-2 font-bold text-[12px] mb-1">
        <span
          className="w-[10px] h-[10px] rounded-full"
          style={{ background: color }}
        />
        {name}
      </div>
      <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
        {desc}
      </p>
    </div>
  );
}
