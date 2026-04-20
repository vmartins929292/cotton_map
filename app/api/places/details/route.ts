import { NextResponse } from "next/server";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import type { PlaceDetails } from "@/lib/places-types";

export const dynamic = "force-dynamic";

const RATE_LIMIT = Number(
  process.env.GOOGLE_PLACES_RATE_LIMIT_PER_MIN ?? 30
);

type GoogleResp = {
  id?: string;
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  displayName?: { text?: string };
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
  const rl = checkRateLimit(`places:details:${ip}`, RATE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas requisicoes." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  const url = new URL(req.url);
  const placeId = url.searchParams.get("placeId")?.trim();
  const sessionToken = url.searchParams.get("sessionToken") ?? undefined;
  if (!placeId) {
    return NextResponse.json({ error: "placeId obrigatorio." }, { status: 400 });
  }

  const detailsUrl = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`
  );
  if (sessionToken) detailsUrl.searchParams.set("sessionToken", sessionToken);

  let data: GoogleResp;
  try {
    const res = await fetch(detailsUrl.toString(), {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,location,formattedAddress,displayName",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Places details HTTP ${res.status}: ${text.slice(0, 200)}`,
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

  if (data.error || !data.location) {
    return NextResponse.json(
      {
        error: `Places: ${data.error?.message ?? data.error?.status ?? "sem location"}`,
      },
      { status: 502 }
    );
  }

  const details: PlaceDetails = {
    placeId: data.id ?? placeId,
    lat: data.location.latitude,
    lng: data.location.longitude,
    formattedAddress: data.formattedAddress ?? "",
    displayName: data.displayName?.text ?? data.formattedAddress ?? "",
  };

  return NextResponse.json(details);
}
