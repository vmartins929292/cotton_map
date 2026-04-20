import { NextResponse } from "next/server";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import type { PlaceSuggestion } from "@/lib/places-types";

export const dynamic = "force-dynamic";

const PLACES_URL = "https://places.googleapis.com/v1/places:autocomplete";

const RATE_LIMIT = Number(
  process.env.GOOGLE_PLACES_RATE_LIMIT_PER_MIN ?? 30
);

type GoogleSuggestion = {
  placePrediction?: {
    placeId?: string;
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
    text?: { text?: string };
  };
};

type GoogleResp = {
  suggestions?: GoogleSuggestion[];
  error?: { message?: string; status?: string };
};

export async function GET(req: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY nao configurada." },
      { status: 500 }
    );
  }

  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`places:autocomplete:${ip}`, RATE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas requisicoes. Aguarde alguns segundos." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const sessionToken = url.searchParams.get("sessionToken") ?? undefined;
  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const body: Record<string, unknown> = {
    input: q,
    languageCode: "pt-BR",
    regionCode: "BR",
    includedPrimaryTypes: [], // todos os tipos
  };
  if (sessionToken) body.sessionToken = sessionToken;

  let data: GoogleResp;
  try {
    const res = await fetch(PLACES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Places autocomplete HTTP ${res.status}: ${text.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }
    data = (await res.json()) as GoogleResp;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha de rede." },
      { status: 502 }
    );
  }

  if (data.error) {
    return NextResponse.json(
      { error: `Places: ${data.error.message ?? data.error.status}` },
      { status: 502 }
    );
  }

  const suggestions: PlaceSuggestion[] = (data.suggestions ?? [])
    .map((s) => {
      const pp = s.placePrediction;
      if (!pp?.placeId) return null;
      const main = pp.structuredFormat?.mainText?.text ?? pp.text?.text ?? "";
      const sec = pp.structuredFormat?.secondaryText?.text ?? "";
      return {
        placeId: pp.placeId,
        primary: main,
        secondary: sec,
        full: pp.text?.text ?? `${main}${sec ? ", " + sec : ""}`,
      } satisfies PlaceSuggestion;
    })
    .filter((s): s is PlaceSuggestion => s !== null);

  return NextResponse.json({ suggestions });
}
