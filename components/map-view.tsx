"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Company, Origin, TYPE_COLORS, TYPE_LABELS, originShortLabel } from "@/data/types";
import type { RouteStep } from "@/lib/route-types";
import { formatDuration } from "@/lib/format";

const DEFAULT_CENTER: L.LatLngExpression = [-14.5, -49];
const DEFAULT_ZOOM = 5;

export interface MapRoute {
  companyId: string;
  originId: string;
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
  durationMinTraffic?: number | null;
  tollsBRL?: number | null;
  steps?: RouteStep[];
}

export interface CustomMapRoute {
  id: string;
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
  durationMinTraffic?: number | null;
  tollsBRL?: number | null;
  steps?: RouteStep[];
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  waypoints: Array<{ lat: number; lng: number; label: string }>;
  isAlternative?: boolean;
  altLabel?: string;
}

interface MapViewProps {
  companies: Company[];
  origins: Origin[];
  selectedId: string | null;
  routes?: MapRoute[];
  customRoutes?: CustomMapRoute[];
  onSelectCompany: (id: string) => void;
  onShowInstructions?: (steps: RouteStep[], title: string) => void;
  onPickAlternative?: (id: string) => void;
  /**
   * Disparado quando o usuario clica no botao "Resetar visualizacao" do mapa.
   * Use para limpar polylines (rotas fixas + custom), sele\u00e7\u00e3o, erros etc.
   * O fly-to do mapa em si ja e feito pelo proprio controle.
   */
  onReset?: () => void;
}

function isMapReady(map: L.Map): boolean {
  try {
    return !!(map.getContainer() && map.getPane("markerPane"));
  } catch {
    return false;
  }
}

function FitToRoutes({
  routes,
  customRoutes,
}: {
  routes: MapRoute[];
  customRoutes: CustomMapRoute[];
}) {
  const map = useMap();
  const prevSig = useRef<string>("");

  useEffect(() => {
    if (!isMapReady(map)) return;
    const sig = [
      ...routes.map((r) => `f:${r.companyId}:${r.originId}`),
      ...customRoutes
        .filter((c) => !c.isAlternative)
        .map((c) => `c:${c.id}:${c.coords.length}`),
    ]
      .sort()
      .join("|");
    if (sig === prevSig.current) return;
    prevSig.current = sig;

    const allPoints: L.LatLngExpression[] = [];
    routes.forEach((r) => r.coords.forEach((c) => allPoints.push(c)));
    customRoutes
      .filter((c) => !c.isAlternative)
      .forEach((c) => c.coords.forEach((p) => allPoints.push(p)));

    if (allPoints.length === 0) return;
    const bounds = L.latLngBounds(allPoints);
    map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8, maxZoom: 9 });
  }, [routes, customRoutes, map]);

  return null;
}

function safeRemove(map: L.Map, layer: L.Layer) {
  try {
    if (map.hasLayer(layer)) map.removeLayer(layer);
  } catch {
    // ignora erros durante teardown
  }
}

function OriginMarkers({ origins }: { origins: Origin[] }) {
  const map = useMap();

  useEffect(() => {
    if (!isMapReady(map)) return;
    const layers: L.Layer[] = [];

    origins.forEach((origin) => {
      const pulse = L.circleMarker([origin.lat, origin.lng], {
        radius: 14,
        color: origin.color,
        fillColor: origin.color,
        fillOpacity: 0.2,
        weight: 2,
        opacity: 0.6,
      }).addTo(map);
      layers.push(pulse);

      const inner = L.circleMarker([origin.lat, origin.lng], {
        radius: 5,
        color: origin.color,
        fillColor: origin.color,
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
      layers.push(inner);

      const icon = L.divIcon({
        className: "origin-label",
        html: `<div style="
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 800;
          color: ${origin.color};
          text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;
          white-space: nowrap;
          text-align: center;
          transform: translateX(-50%);
        ">${origin.name}</div>`,
        iconSize: [80, 16],
        iconAnchor: [40, -10],
      });
      const label = L.marker([origin.lat, origin.lng], {
        icon,
        interactive: false,
        keyboard: false,
      }).addTo(map);
      layers.push(label);
    });

    return () => {
      layers.forEach((l) => safeRemove(map, l));
    };
  }, [map, origins]);

  return null;
}

function CustomEndpoints({
  customRoutes,
}: {
  customRoutes: CustomMapRoute[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!isMapReady(map)) return;
    if (!customRoutes || customRoutes.length === 0) return;

    const layers: L.Layer[] = [];
    const seen = new Set<string>();

    function addPin(
      lat: number,
      lng: number,
      color: string,
      label: string,
      letter: string
    ) {
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}:${letter}`;
      if (seen.has(key)) return;
      seen.add(key);

      const icon = L.divIcon({
        className: "custom-endpoint-pin",
        html: `<div style="
          display: flex; align-items: center; justify-content: center;
          width: 22px; height: 22px;
          background: ${color}; color: white;
          border: 2px solid white; border-radius: 50%;
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 900;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        ">${letter}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const m = L.marker([lat, lng], { icon }).addTo(map);
      m.bindTooltip(label, { direction: "top", offset: [0, -10] });
      layers.push(m);
    }

    customRoutes
      .filter((c) => !c.isAlternative)
      .forEach((c) => {
        if (c.origin.label) {
          addPin(c.origin.lat, c.origin.lng, "#0f766e", c.origin.label, "A");
        }
        c.waypoints.forEach((w, i) => {
          addPin(w.lat, w.lng, "#1f5b3a", w.label || `Parada ${i + 1}`, String(i + 1));
        });
        addPin(
          c.destination.lat,
          c.destination.lng,
          "#c1322f",
          c.destination.label,
          "B"
        );
      });

    return () => {
      layers.forEach((l) => safeRemove(map, l));
    };
  }, [customRoutes, map]);

  return null;
}

function FitToSelected({ company }: { company: Company | null }) {
  const map = useMap();
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (!isMapReady(map)) return;
    if (company && company.id !== prevId.current) {
      map.flyTo([company.lat, company.lng], 8, { duration: 0.8 });
      prevId.current = company.id;
    }
  }, [company, map]);

  return null;
}

interface HomeButtonOptions extends L.ControlOptions {
  onResetRef?: { current: (() => void) | undefined };
}

const HomeButtonClass = L.Control.extend({
  options: { position: "topleft" as L.ControlPosition } as HomeButtonOptions,
  onAdd: function (this: L.Control & { options: HomeButtonOptions }, map: L.Map) {
    const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
    const link = L.DomUtil.create(
      "a",
      "leaflet-control-home",
      container
    ) as HTMLAnchorElement;
    link.href = "#";
    link.title = "Resetar visualização";
    link.setAttribute("role", "button");
    link.setAttribute("aria-label", "Resetar visualização");
    link.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;">
        <path d="M3 11.5 12 4l9 7.5"/>
        <path d="M5 10v10h14V10"/>
        <path d="M10 20v-6h4v6"/>
      </svg>
    `;
    link.style.display = "flex";
    link.style.alignItems = "center";
    link.style.justifyContent = "center";
    link.style.width = "30px";
    link.style.height = "30px";
    link.style.color = "var(--accent, #1f5b3a)";

    const onResetRef = this.options.onResetRef;
    L.DomEvent.on(link, "click", (e) => {
      L.DomEvent.preventDefault(e);
      L.DomEvent.stopPropagation(e);
      // Limpa rotas/sele\u00e7\u00e3o no React (lido via ref pra pegar a callback atual)
      onResetRef?.current?.();
      map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.6 });
    });

    return container;
  },
});

function HomeControl({ onReset }: { onReset?: () => void }) {
  const map = useMap();
  // Ref atualizada a cada render mantem a callback "fresh" sem re-criar o controle.
  const onResetRef = useRef<(() => void) | undefined>(onReset);
  onResetRef.current = onReset;

  useEffect(() => {
    if (!isMapReady(map)) return;
    const control = new HomeButtonClass({ onResetRef } as HomeButtonOptions);
    try {
      control.addTo(map);
    } catch {
      return;
    }
    return () => {
      try {
        control.remove();
      } catch {
        // ignora
      }
    };
  }, [map]);

  return null;
}

function trafficColor(
  durationMin: number,
  traffic: number | null | undefined
): string {
  if (!traffic || durationMin === 0) return "var(--text-dim)";
  const ratio = traffic / durationMin;
  if (ratio < 1.1) return "#2d7a3e";
  if (ratio < 1.3) return "#d97706";
  return "#c1322f";
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

export default function MapView({
  companies,
  origins,
  selectedId,
  routes = [],
  customRoutes = [],
  onSelectCompany,
  onShowInstructions,
  onPickAlternative,
  onReset,
}: MapViewProps) {
  const selected = companies.find((c) => c.id === selectedId) ?? null;

  const originsById = useMemo(() => {
    const m = new Map<string, Origin>();
    for (const o of origins) m.set(o.id, o);
    return m;
  }, [origins]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={4}
        maxZoom={15}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <HomeControl onReset={onReset} />
        <OriginMarkers origins={origins} />
        <CustomEndpoints customRoutes={customRoutes} />
        <FitToSelected company={selected} />
        <FitToRoutes routes={routes} customRoutes={customRoutes} />

        {/* Rotas fixas (origens cadastradas, ativadas pelos chips do card) */}
        {routes.map((r) => {
          const o = originsById.get(r.originId);
          const color = o?.color ?? "#1f5b3a";
          const originName = o?.name ?? r.originId;
          const tColor = trafficColor(r.durationMin, r.durationMinTraffic);
          const company = companies.find((c) => c.id === r.companyId);
          const popupTitle = `${originName} → ${company?.name ?? r.companyId}`;
          return (
            <Polyline
              key={`fixed:${r.companyId}:${r.originId}`}
              positions={r.coords}
              pathOptions={{
                color,
                weight: 4,
                opacity: 0.85,
                lineCap: "round",
                lineJoin: "round",
              }}
            >
              <Popup>
                <RoutePopupContent
                  title={popupTitle}
                  color={color}
                  distanceKm={r.distanceKm}
                  durationMin={r.durationMin}
                  durationMinTraffic={r.durationMinTraffic ?? null}
                  tollsBRL={r.tollsBRL ?? null}
                  trafficColor={tColor}
                  steps={r.steps}
                  onShowInstructions={onShowInstructions}
                />
              </Popup>
            </Polyline>
          );
        })}

        {/* Rotas custom (planejador) */}
        {customRoutes.map((c) => {
          const isAlt = !!c.isAlternative;
          const color = isAlt ? "#6b7280" : "#1f5b3a";
          const popupTitle = `${c.origin.label || "Origem"} → ${
            c.destination.label || "Destino"
          }`;
          return (
            <Polyline
              key={`custom:${c.id}`}
              positions={c.coords}
              pathOptions={{
                color,
                weight: isAlt ? 3 : 5,
                opacity: isAlt ? 0.5 : 0.9,
                lineCap: "round",
                lineJoin: "round",
                dashArray: isAlt ? "6,6" : undefined,
              }}
              eventHandlers={
                isAlt && onPickAlternative
                  ? { click: () => onPickAlternative(c.id) }
                  : undefined
              }
            >
              <Popup>
                <RoutePopupContent
                  title={popupTitle}
                  subtitle={isAlt ? c.altLabel ?? "Alternativa" : "Rota principal"}
                  color={color}
                  distanceKm={c.distanceKm}
                  durationMin={c.durationMin}
                  durationMinTraffic={c.durationMinTraffic ?? null}
                  tollsBRL={c.tollsBRL ?? null}
                  trafficColor={trafficColor(c.durationMin, c.durationMinTraffic)}
                  steps={c.steps}
                  onShowInstructions={onShowInstructions}
                />
              </Popup>
            </Polyline>
          );
        })}

        {companies.map((c) => {
          const color = TYPE_COLORS[c.type];
          const isSel = c.id === selectedId;

          return (
            <CircleMarker
              key={c.id}
              center={[c.lat, c.lng]}
              radius={isSel ? 10 : 6}
              pathOptions={{
                color: "white",
                weight: isSel ? 2.5 : 1.5,
                fillColor: color,
                fillOpacity: isSel ? 1 : 0.85,
              }}
              eventHandlers={{
                click: () => onSelectCompany(c.id),
              }}
            >
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <div
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--accent-dark)",
                      marginBottom: 4,
                    }}
                  >
                    {c.name}
                  </div>
                  <div style={{ color: "var(--text-dim)", fontSize: 11 }}>
                    📍 {c.city} — {c.state}
                  </div>
                  <div
                    style={{
                      color: "var(--text-dim)",
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    <strong>Tipo:</strong> {TYPE_LABELS[c.type]}{" "}
                    {c.bci ? "· BCI ✓" : ""}
                  </div>
                  <div
                    style={{
                      color: "var(--text-dim)",
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    <strong>Produtos:</strong> {c.products}
                  </div>
                  <div
                    style={{
                      color: "var(--text-dim)",
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    <strong>Capacidade:</strong> {c.capacity}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${Math.min(
                        origins.length,
                        3
                      )}, 1fr)`,
                      gap: 4,
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: "1px solid var(--card-border)",
                    }}
                  >
                    {origins.map((o) => (
                      <DistCell
                        key={o.id}
                        label={originShortLabel(o)}
                        value={c.distancesByOrigin?.[o.id]}
                        color={o.color}
                      />
                    ))}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

interface RoutePopupContentProps {
  title: string;
  subtitle?: string;
  color: string;
  distanceKm: number;
  durationMin: number;
  durationMinTraffic: number | null;
  tollsBRL: number | null;
  trafficColor: string;
  steps?: RouteStep[];
  onShowInstructions?: (steps: RouteStep[], title: string) => void;
}

function RoutePopupContent({
  title,
  subtitle,
  color,
  distanceKm,
  durationMin,
  durationMinTraffic,
  tollsBRL,
  trafficColor,
  steps,
  onShowInstructions,
}: RoutePopupContentProps) {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: 220 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 10,
            color: "var(--text-light)",
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {subtitle}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gap: 4,
          fontSize: 11,
          color: "var(--text-dim)",
        }}
      >
        <div>
          <strong>Distância:</strong> {distanceKm.toLocaleString("pt-BR")} km
        </div>
        <div>
          <strong>Tempo (sem tráfego):</strong> {formatDuration(durationMin)}
        </div>
        {durationMinTraffic != null && (
          <div>
            <strong>Tempo agora (tráfego):</strong>{" "}
            <span style={{ color: trafficColor, fontWeight: 700 }}>
              {formatDuration(durationMinTraffic)}
            </span>
          </div>
        )}
        {tollsBRL != null && tollsBRL > 0 && (
          <div>
            <strong>Pedágios:</strong> {fmtBRL(tollsBRL)}
          </div>
        )}
      </div>
      {steps && steps.length > 0 && onShowInstructions && (
        <button
          type="button"
          onClick={() => onShowInstructions(steps, title)}
          style={{
            marginTop: 8,
            padding: "4px 10px",
            borderRadius: 6,
            background: color,
            color: "white",
            fontSize: 11,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Ver instruções ({steps.length})
        </button>
      )}
    </div>
  );
}

function DistCell({
  label,
  value,
  color,
}: {
  label: string;
  value?: number;
  color: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "3px 2px",
        borderRadius: 4,
        background: "rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color }}>
        {value != null ? value.toLocaleString("pt-BR") : "—"}
      </div>
      <div
        style={{
          fontSize: 8,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--text-light)",
        }}
      >
        km {label}
      </div>
    </div>
  );
}
