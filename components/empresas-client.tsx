"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Globe,
  Navigation,
  ExternalLink,
  Search,
  Copy,
  Check,
  Download,
  LayoutList,
  Table2,
  ArrowUpDown,
} from "lucide-react";
import {
  Company,
  Origin,
  TYPE_COLORS,
  TYPE_LABELS,
  STATE_NAMES,
} from "@/data/types";
import { matchesSearch } from "@/lib/search";

type ViewMode = "states" | "table";
type SortKey = "name" | "state" | "type" | "capacity" | { kind: "origin"; id: string };

function sortKeyEquals(a: SortKey, b: SortKey): boolean {
  if (typeof a === "string" || typeof b === "string") return a === b;
  return a.kind === "origin" && b.kind === "origin" && a.id === b.id;
}

export default function EmpresasClient({
  companies,
  origins,
}: {
  companies: Company[];
  origins: Origin[];
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("states");
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<SortKey>("state");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    return companies.filter((c) => matchesSearch(c, search));
  }, [companies, search]);

  const grouped = useMemo(() => {
    const byState: Record<string, Company[]> = {};
    for (const c of filtered) {
      if (!byState[c.state]) byState[c.state] = [];
      byState[c.state].push(c);
    }
    return byState;
  }, [filtered]);

  const sortedTable = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (typeof sortKey === "string") {
        switch (sortKey) {
          case "name":
            cmp = a.name.localeCompare(b.name);
            break;
          case "state":
            cmp =
              a.state.localeCompare(b.state) ||
              a.city.localeCompare(b.city);
            break;
          case "type":
            cmp = a.type.localeCompare(b.type);
            break;
          case "capacity":
            cmp = a.capacity.localeCompare(b.capacity);
            break;
        }
      } else if (sortKey.kind === "origin") {
        const da = a.distancesByOrigin?.[sortKey.id];
        const db = b.distancesByOrigin?.[sortKey.id];
        if (da == null && db == null) cmp = 0;
        else if (da == null) cmp = 1;
        else if (db == null) cmp = -1;
        else cmp = da - db;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortAsc]);

  const sortedStates = Object.keys(grouped).sort((a, b) => {
    return (grouped[b]?.length ?? 0) - (grouped[a]?.length ?? 0);
  });

  const toggleState = (state: string) => {
    setOpenStates((prev) => ({ ...prev, [state]: !prev[state] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    sortedStates.forEach((s) => (all[s] = true));
    setOpenStates(all);
  };

  const collapseAll = () => setOpenStates({});

  const handleSort = (key: SortKey) => {
    if (sortKeyEquals(sortKey, key)) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Empresa",
      "Grupo",
      "Tipo",
      "BCI",
      "Cidade",
      "Estado",
      "Endereço",
      "Telefone",
      "Email",
      "Site",
      "Produtos",
      "Capacidade",
      ...origins.map((o) => `km ${o.short}`),
    ];
    const rows = filtered.map((c) => [
      c.name,
      c.group,
      TYPE_LABELS[c.type],
      c.bci ? "Sim" : "Não",
      c.city,
      c.state,
      `"${c.address}"`,
      c.contact,
      c.email,
      c.site,
      `"${c.products}"`,
      `"${c.capacity}"`,
      ...origins.map((o) => c.distancesByOrigin?.[o.id]?.toString() ?? ""),
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compradores_algodao.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="px-5 py-4 flex items-center justify-between flex-wrap gap-3 sticky top-0 z-20"
        style={{
          background: "linear-gradient(135deg, #fdfbf6 0%, #f5f2ec 100%)",
          borderBottom: "2px solid var(--accent)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Mapa
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="VALOR AG Commodities"
            className="h-9 hidden sm:block"
          />
          <div>
            <h1
              className="text-[17px] font-extrabold"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: "var(--accent-dark)",
              }}
            >
              LISTA DE COMPRADORES
            </h1>
            <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
              {filtered.length} empresas em {sortedStates.length} estados · VALOR AG
              COMMODITIES
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--text-dim)" }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa..."
              className="pl-9 pr-3 py-2 rounded-md text-sm outline-none w-56"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--card-border)",
                color: "var(--text)",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--card-border)" }}
          >
            <button
              onClick={() => setView("states")}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium cursor-pointer transition-all"
              style={{
                background: view === "states" ? "var(--accent)" : "var(--bg)",
                color: view === "states" ? "white" : "var(--text-dim)",
              }}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Por Estado
            </button>
            <button
              onClick={() => setView("table")}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium cursor-pointer transition-all"
              style={{
                background: view === "table" ? "var(--accent)" : "var(--bg)",
                color: view === "table" ? "white" : "var(--text-dim)",
              }}
            >
              <Table2 className="w-3.5 h-3.5" />
              Lista Completa
            </button>
          </div>

          {view === "states" && (
            <>
              <button
                onClick={expandAll}
                className="px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--card-border)",
                  color: "var(--text-dim)",
                }}
              >
                Expandir todos
              </button>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--card-border)",
                  color: "var(--text-dim)",
                }}
              >
                Recolher
              </button>
            </>
          )}

          <button
            onClick={exportCSV}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: "var(--green)", color: "white" }}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </header>

      {view === "states" && (
        <div className="max-w-5xl mx-auto p-5 space-y-3">
          {sortedStates.map((state) => {
            const list = grouped[state];
            const isOpen = openStates[state] ?? false;
            const stateName = STATE_NAMES[state] ?? state;

            return (
              <div
                key={state}
                className="rounded-xl overflow-hidden"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                }}
              >
                <button
                  onClick={() => toggleState(state)}
                  className="w-full flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-black/[0.02] transition"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? (
                      <ChevronDown
                        className="w-5 h-5"
                        style={{ color: "var(--accent)" }}
                      />
                    ) : (
                      <ChevronRight
                        className="w-5 h-5"
                        style={{ color: "var(--text-dim)" }}
                      />
                    )}
                    <div className="text-left">
                      <span
                        className="font-bold text-[15px]"
                        style={{ color: "var(--accent-dark)" }}
                      >
                        {state}
                      </span>
                      <span
                        className="ml-2 text-[13px]"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {stateName}
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                    style={{
                      background: "rgba(139,90,43,0.1)",
                      color: "var(--accent-dark)",
                    }}
                  >
                    {list.length} {list.length === 1 ? "empresa" : "empresas"}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--card-border)" }}>
                    {list.map((c) => (
                      <CompanyRow key={c.id} company={c} origins={origins} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "table" && (
        <div className="p-5">
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div className="overflow-x-auto">
              <table
                className="w-full text-left"
                style={{ minWidth: 1200 + origins.length * 130 }}
              >
                <thead>
                  <tr
                    style={{
                      background: "rgba(139,90,43,0.06)",
                      borderBottom: "2px solid var(--card-border)",
                    }}
                  >
                    <SortHeader label="#" width={40} />
                    <SortHeader
                      label="Empresa"
                      sortKey="name"
                      current={sortKey}
                      asc={sortAsc}
                      onSort={handleSort}
                      width={200}
                    />
                    <SortHeader
                      label="Tipo"
                      sortKey="type"
                      current={sortKey}
                      asc={sortAsc}
                      onSort={handleSort}
                      width={110}
                    />
                    <SortHeader
                      label="Cidade / UF"
                      sortKey="state"
                      current={sortKey}
                      asc={sortAsc}
                      onSort={handleSort}
                      width={160}
                    />
                    <SortHeader label="Endereço" width={260} />
                    <SortHeader label="Telefone" width={120} />
                    <SortHeader label="Email / Site" width={160} />
                    <SortHeader label="Produtos" width={200} />
                    <SortHeader
                      label="Capacidade"
                      sortKey="capacity"
                      current={sortKey}
                      asc={sortAsc}
                      onSort={handleSort}
                      width={130}
                    />
                    <SortHeader label="BCI" width={45} />
                    {origins.map((o) => (
                      <SortHeader
                        key={o.id}
                        label={o.short}
                        sortKey={{ kind: "origin", id: o.id }}
                        current={sortKey}
                        asc={sortAsc}
                        onSort={handleSort}
                        width={130}
                        preserveLabelCase
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTable.map((c, i) => (
                    <TableRow
                      key={c.id}
                      company={c}
                      origins={origins}
                      index={i}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  sortKey: sk,
  current,
  asc,
  onSort,
  width,
  preserveLabelCase = false,
}: {
  label: string;
  sortKey?: SortKey;
  current?: SortKey;
  asc?: boolean;
  onSort?: (k: SortKey) => void;
  width?: number;
  preserveLabelCase?: boolean;
}) {
  const isActive = !!sk && current != null && sortKeyEquals(current, sk);
  const canSort = !!sk && !!onSort;

  return (
    <th
      className={`px-3 py-2.5 text-[10px] font-bold ${
        preserveLabelCase
          ? "tracking-wide leading-snug"
          : "uppercase tracking-wider whitespace-nowrap"
      } ${canSort ? "cursor-pointer select-none hover:bg-black/[0.03]" : ""}`}
      style={{
        color: isActive ? "var(--accent-dark)" : "var(--text-dim)",
        width,
      }}
      onClick={() => canSort && sk && onSort(sk)}
    >
      <span className="flex items-center gap-1">
        {label}
        {canSort && (
          <ArrowUpDown
            className="w-3 h-3"
            style={{
              opacity: isActive ? 1 : 0.3,
              color: isActive ? "var(--accent)" : "var(--text-light)",
            }}
          />
        )}
        {isActive && (
          <span className="text-[8px]">{asc ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );
}

function TableRow({
  company: c,
  origins,
  index,
}: {
  company: Company;
  origins: Origin[];
  index: number;
}) {
  const typeColor = TYPE_COLORS[c.type];
  const isEven = index % 2 === 0;

  return (
    <tr
      className="hover:bg-black/[0.02] transition-colors"
      style={{
        background: isEven ? "transparent" : "rgba(0,0,0,0.015)",
        borderBottom: "1px solid var(--card-border)",
      }}
    >
      <td
        className="px-3 py-2.5 text-[10px] font-medium"
        style={{ color: "var(--text-light)" }}
      >
        {index + 1}
      </td>
      <td className="px-3 py-2.5">
        <div
          className="text-[12px] font-semibold"
          style={{ color: "var(--text)" }}
        >
          {c.name}
        </div>
        <div className="text-[10px]" style={{ color: "var(--text-light)" }}>
          {c.group}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span
          className="text-[9px] px-1.5 py-0.5 rounded font-semibold inline-block"
          style={{ background: `${typeColor}1F`, color: typeColor }}
        >
          {TYPE_LABELS[c.type]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-[11px] font-medium" style={{ color: "var(--text)" }}>
          {c.city}
        </div>
        <div className="text-[10px]" style={{ color: "var(--text-dim)" }}>
          {c.state} — {STATE_NAMES[c.state] ?? c.state}
        </div>
      </td>
      <td className="px-3 py-2.5 text-[10px]" style={{ color: "var(--text-dim)" }}>
        {c.address || "—"}
      </td>
      <td className="px-3 py-2.5">
        {c.contact ? (
          <a
            href={`tel:${c.contact.replace(/\D/g, "")}`}
            className="text-[11px] underline hover:opacity-80"
            style={{ color: "var(--accent2)" }}
          >
            {c.contact}
          </a>
        ) : (
          <span className="text-[10px]" style={{ color: "var(--text-light)" }}>
            —
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {c.email && (
          <a
            href={`mailto:${c.email}`}
            className="text-[10px] underline hover:opacity-80 block"
            style={{ color: "var(--accent2)" }}
          >
            {c.email}
          </a>
        )}
        {c.site && (
          <a
            href={`https://${c.site}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] underline hover:opacity-80 block"
            style={{ color: "var(--text-dim)" }}
          >
            {c.site}
          </a>
        )}
        {!c.email && !c.site && (
          <span className="text-[10px]" style={{ color: "var(--text-light)" }}>
            —
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-[10px]" style={{ color: "var(--text-dim)" }}>
        {c.products}
      </td>
      <td
        className="px-3 py-2.5 text-[10px] font-medium"
        style={{ color: "var(--text)" }}
      >
        {c.capacity}
      </td>
      <td className="px-3 py-2.5 text-center">
        {c.bci ? (
          <span className="text-[9px] font-bold" style={{ color: "var(--green)" }}>
            ✓
          </span>
        ) : (
          <span className="text-[9px]" style={{ color: "var(--text-light)" }}>
            —
          </span>
        )}
      </td>
      {origins.map((o) => {
        const v = c.distancesByOrigin?.[o.id];
        return (
          <td
            key={o.id}
            className="px-3 py-2.5 text-[10px] font-bold text-center"
            style={{ color: o.color }}
          >
            {v != null ? v.toLocaleString("pt-BR") : "—"}
          </td>
        );
      })}
    </tr>
  );
}

function CompanyRow({
  company: c,
  origins,
}: {
  company: Company;
  origins: Origin[];
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const typeColor = TYPE_COLORS[c.type];
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div
      className="px-5 py-4"
      style={{ borderBottom: "1px solid var(--card-border)" }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[14px]" style={{ color: "var(--text)" }}>
              {c.name}
            </h3>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: `${typeColor}1F`, color: typeColor }}
            >
              {TYPE_LABELS[c.type]}
            </span>
            {c.bci && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
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

          <p className="text-[11px] mt-1" style={{ color: "var(--text-dim)" }}>
            {c.desc}
          </p>

          <div className="mt-2 space-y-1">
            <ContactRow
              icon={<MapPin className="w-3.5 h-3.5" />}
              value={`${c.city} — ${c.state}`}
            />
            {c.address && (
              <ContactRow
                icon={<Navigation className="w-3.5 h-3.5" />}
                value={c.address}
                copiable
                copied={copied === "addr"}
                onCopy={() => copyText(c.address, "addr")}
              />
            )}
            {c.contact && (
              <ContactRow
                icon={<Phone className="w-3.5 h-3.5" />}
                value={c.contact}
                href={`tel:${c.contact.replace(/\D/g, "")}`}
                copiable
                copied={copied === "phone"}
                onCopy={() => copyText(c.contact, "phone")}
              />
            )}
            {c.email && (
              <ContactRow
                icon={<Mail className="w-3.5 h-3.5" />}
                value={c.email}
                href={`mailto:${c.email}`}
                copiable
                copied={copied === "email"}
                onCopy={() => copyText(c.email, "email")}
              />
            )}
            {c.site && (
              <ContactRow
                icon={<Globe className="w-3.5 h-3.5" />}
                value={c.site}
                href={`https://${c.site}`}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="text-[10px] text-right" style={{ color: "var(--text-dim)" }}>
            <div>
              <strong>Produtos:</strong> {c.products}
            </div>
            <div className="mt-0.5">
              <strong>Capacidade:</strong> {c.capacity}
            </div>
          </div>
          <div className="flex gap-1.5 mt-1 flex-wrap justify-end">
            {origins.map((o) => (
              <DistBadge
                key={o.id}
                label={o.short}
                value={c.distancesByOrigin?.[o.id]}
                color={o.color}
              />
            ))}
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 mt-1 text-[10px] font-medium hover:opacity-80 transition"
            style={{ color: "var(--accent2)" }}
          >
            <ExternalLink className="w-3 h-3" />
            Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  value,
  href,
  copiable,
  copied,
  onCopy,
}: {
  icon: React.ReactNode;
  value: string;
  href?: string;
  copiable?: boolean;
  copied?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-1.5 text-[11px]"
      style={{ color: "var(--text-dim)" }}
    >
      <span className="flex-shrink-0" style={{ color: "var(--accent)" }}>
        {icon}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80"
        >
          {value}
        </a>
      ) : (
        <span>{value}</span>
      )}
      {copiable && onCopy && (
        <button
          onClick={onCopy}
          className="ml-1 p-0.5 rounded hover:bg-black/5 transition cursor-pointer"
          title="Copiar"
        >
          {copied ? (
            <Check className="w-3 h-3" style={{ color: "var(--green)" }} />
          ) : (
            <Copy className="w-3 h-3" style={{ color: "var(--text-light)" }} />
          )}
        </button>
      )}
    </div>
  );
}

function DistBadge({
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
      className="text-center px-2 py-1 rounded max-w-[130px]"
      style={{ background: `${color}10`, border: `1px solid ${color}30` }}
    >
      <div className="text-[9px]" style={{ color, fontWeight: 700 }}>
        {value != null ? value.toLocaleString("pt-BR") : "—"}
      </div>
      <div
        className="text-[8px] leading-tight mt-0.5"
        style={{ color: "var(--text-light)" }}
      >
        {label}
      </div>
    </div>
  );
}
