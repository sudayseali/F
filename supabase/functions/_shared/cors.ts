// supabase/functions/_shared/cors.ts
// Hardened CORS with strict origin allowlist for Telegram WebApp and Admin Frontend

const DEFAULT_ALLOWED_ORIGINS = [
  'https://web.telegram.org',
  'https://webk.telegram.org',
  'https://webz.telegram.org',
  'https://t.me',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'https://payvora-tan.vercel.app',
];

/**
 * Checks if the request origin matches the allowlist or allowed domain patterns
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const normalized = origin.trim().replace(/\/$/, '').toLowerCase();

  // 1. Check custom environment variable
  const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(o => o.trim().replace(/\/$/, '').toLowerCase())
    .filter(Boolean);

  if (envOrigins.includes(normalized)) return true;

  // 2. Check default allowed origins
  if (DEFAULT_ALLOWED_ORIGINS.some(o => o.toLowerCase() === normalized)) return true;

  // 3. Check trusted domain patterns (Vercel previews and Google Cloud Run dev urls)
  try {
    const url = new URL(normalized);
    const host = url.hostname;
    if (
      host.endsWith('.vercel.app') ||
      host.endsWith('.run.app') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Generates CORS headers tailored to the incoming request
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || req.headers.get('origin');
  const allowed = isOriginAllowed(origin);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-init-data',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };

  if (origin && allowed) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  } else if (!origin) {
    // Non-browser request (e.g. server-to-server webhook)
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}

export const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-init-data',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

/**
 * Handles CORS preflight OPTIONS requests with strict origin enforcement
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin') || req.headers.get('origin');
    if (origin && !isOriginAllowed(origin)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed by CORS policy' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = getCorsHeaders(req);
    return new Response('ok', { headers });
  }
  return null;
}
