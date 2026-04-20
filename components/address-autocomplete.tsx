"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import type { PlaceSuggestion, PlaceDetails } from "@/lib/places-types";

export type ResolvedAddress = {
  lat: number;
  lng: number;
  label: string;
  placeId: string;
};

interface Props {
  placeholder?: string;
  initialLabel?: string;
  onResolved: (addr: ResolvedAddress | null) => void;
  autoFocus?: boolean;
  compact?: boolean;
}

function uuid(): string {
  // Fallback se crypto.randomUUID nao existir
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function AddressAutocomplete({
  placeholder = "Digite um endereço...",
  initialLabel = "",
  onResolved,
  autoFocus = false,
  compact = false,
}: Props) {
  const [query, setQuery] = useState(initialLabel);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<ResolvedAddress | null>(null);
  const [highlight, setHighlight] = useState(0);
  const sessionToken = useMemo(uuid, []);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Click fora fecha popover
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function fetchSuggestions(q: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const url = `/api/places/autocomplete?q=${encodeURIComponent(q)}&sessionToken=${sessionToken}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { suggestions: PlaceSuggestion[] };
        setSuggestions(data.suggestions);
        setOpen(true);
        setHighlight(0);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Falha ao buscar.");
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  async function pick(s: PlaceSuggestion) {
    setResolving(true);
    setError(null);
    try {
      const url = `/api/places/details?placeId=${encodeURIComponent(s.placeId)}&sessionToken=${sessionToken}`;
      const res = await fetch(url);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const det = (await res.json()) as PlaceDetails;
      const resolved: ResolvedAddress = {
        lat: det.lat,
        lng: det.lng,
        label: det.formattedAddress || s.full,
        placeId: det.placeId,
      };
      setPicked(resolved);
      setQuery(resolved.label);
      setOpen(false);
      onResolved(resolved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao resolver endereço.");
    } finally {
      setResolving(false);
    }
  }

  function clearAll() {
    setPicked(null);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    onResolved(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = suggestions[highlight];
      if (s) void pick(s);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const padY = compact ? "py-1.5" : "py-2";
  const fontSize = compact ? "text-[12px]" : "text-[13px]";

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search
          className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${compact ? "w-3.5 h-3.5" : "w-4 h-4"} pointer-events-none`}
          style={{ color: "var(--text-light)" }}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setPicked(null);
            onResolved(null);
            fetchSuggestions(v);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          className={`w-full pl-8 pr-8 ${padY} ${fontSize} rounded-md outline-none transition-colors`}
          style={{
            background: "var(--bg)",
            border: `1px solid ${picked ? "var(--accent2)" : "var(--card-border)"}`,
            color: "var(--text)",
            fontFamily: "inherit",
          }}
        />
        {(loading || resolving) && (
          <Loader2
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${compact ? "w-3.5 h-3.5" : "w-4 h-4"} animate-spin`}
            style={{ color: "var(--text-light)" }}
            aria-hidden
          />
        )}
        {!loading && !resolving && query && (
          <button
            type="button"
            onClick={clearAll}
            title="Limpar"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-black/5 cursor-pointer"
            style={{ color: "var(--text-light)" }}
          >
            <X className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          </button>
        )}
      </div>

      {error && (
        <p
          className="mt-1 text-[10.5px]"
          style={{ color: "#c1322f" }}
          role="alert"
        >
          {error}
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 rounded-md max-h-72 overflow-y-auto"
          style={{
            background: "var(--bg-paper)",
            border: "1px solid var(--card-border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                void pick(s);
              }}
              className="px-2.5 py-2 cursor-pointer flex items-start gap-2"
              style={{
                background:
                  i === highlight ? "rgba(139,90,43,0.08)" : "transparent",
                borderBottom:
                  i < suggestions.length - 1
                    ? "1px solid var(--card-border)"
                    : "none",
              }}
            >
              <MapPin
                className="w-3.5 h-3.5 shrink-0 mt-0.5"
                style={{ color: "var(--accent)" }}
                aria-hidden
              />
              <div className="min-w-0">
                <div
                  className="text-[12.5px] font-semibold truncate"
                  style={{ color: "var(--text)" }}
                >
                  {s.primary}
                </div>
                {s.secondary && (
                  <div
                    className="text-[10.5px] truncate"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {s.secondary}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
