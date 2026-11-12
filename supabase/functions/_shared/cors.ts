// Strict CORS allowlist for Payvora Telegram WebApp and production frontend.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://web.telegram.org',
  'https://webk.telegram.org',
  'https://webz.telegram.org',
  'https://t.me',
  'https://payvora-tan.vercel.app',
  'https://f-ozuz8j4yk-guul-s-projects.vercel.app',
  'https://f-qwy8lo3e9-guul-s-projects.vercel.app',
  'https://f-guul-s-projects.vercel.app',
  'https://f-steel-eight.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
];

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const normalized = origin.trim().replace(/\/$/, '').toLowerCase();
  
  // Mobile Telegram Mini Apps send 'null' origin from sandboxed webviews
  if (normalized === 'null') return true;

  const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, '').toLowerCase())
    .filter(Boolean);

  if (DEFAULT_ALLOWED_ORIGINS.includes(normalized) || envOrigins.includes(normalized)) {
    return true;
  }

  // Trusted domain patterns (Vercel previews and Google Cloud Run)
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
    // Malformed url
  }

  return false;
}

export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('Origin') || req?.headers.get('origin');
  const allowed = origin ? isOriginAllowed(origin) : true;
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin && allowed ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-init-data',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  return headers;
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-init-data',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export function handleCors(req: Request): Response | null {
  const origin = req.headers.get('Origin') || req.headers.get('origin');
  if (origin && !isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ success: false, error: 'Origin not allowed', code: 'CORS_ORIGIN_DENIED' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Vary': 'Origin' },
    });
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  return null;
}
