import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing! Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.'
  );
}

const STORAGE_KEY = 'payvora_auth_token';

let customAccessToken: string | null = (() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
})();

export const setSupabaseToken = (token: string) => {
  customAccessToken = token;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        localStorage.setItem(STORAGE_KEY, token);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage write errors
  }
};

export const getSupabaseToken = (): string | null => {
  if (customAccessToken) return customAccessToken;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      customAccessToken = localStorage.getItem(STORAGE_KEY);
      return customAccessToken;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
};

export const clearSupabaseToken = () => {
  customAccessToken = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage removal errors
  }
};

export interface JwtPayload {
  sub?: string;
  exp?: number;
  aud?: string;
  role?: string;
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string | null): JwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null, bufferSeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 <= Date.now() + bufferSeconds * 1000;
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    global: {
      fetch: async (url, options) => {
        const _options = options || {};
        const headers = new Headers(_options.headers);
        const token = getSupabaseToken();
        if (token && !isTokenExpired(token, 0)) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        return fetch(url, { ..._options, headers });
      }
    }
  }
);

export class EdgeFunctionError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'EdgeFunctionError';
    this.code = code;
    this.status = status;
  }
}

export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body?: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: body ?? {},
  });

  if (error) {
    let message = error.message || 'Request failed';
    let code: string | undefined;
    let status: number | undefined;

    const ctx = (error as any).context;
    if (ctx && typeof ctx.status === 'number') {
      status = ctx.status;
    }
    if (ctx && typeof ctx.clone === 'function') {
      try {
        const errJson = await ctx.clone().json();
        if (errJson && typeof errJson === 'object') {
          message = errJson.error || errJson.message || message;
          code = errJson.code;
        }
      } catch {
        // Ignore non-JSON error responses
      }
    }

    throw new EdgeFunctionError(message, code, status);
  }

  if (data && typeof data === 'object' && 'success' in data) {
    if ((data as any).success === false) {
      throw new EdgeFunctionError(
        (data as any).error || 'Request failed',
        (data as any).code
      );
    }
    if ('data' in data) {
      return (data as any).data as T;
    }
  }

  return data as T;
}
