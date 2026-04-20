import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Rate limit simples in-memory (janela fixa por minuto).
 * Suficiente pra mitigar abuso casual num app server-render unico.
 * Em multi-instancia (Vercel scale-out) cada instancia tem seu proprio bucket;
 * para algo robusto, trocar por upstash/redis.
 */
export function checkRateLimit(
  key: string,
  limitPerMinute: number
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limitPerMinute) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true };
}

export function clientIpFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "anonymous";
}
