// supabase/functions/_shared/errors.ts
// Standardized error handling and responses

import { corsHeaders, getCorsHeaders } from './cors.ts';

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorResponse(err: unknown, req?: Request): Response {
  let message = 'An unexpected error occurred.';
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';

  if (err instanceof AppError) {
    message = err.message;
    statusCode = err.statusCode;
    code = err.code;
  } else if (err instanceof Error) {
    message = 'An internal error occurred while processing your request.';
    statusCode = 500;
    code = 'INTERNAL_ERROR';
  } else if (typeof err === 'object' && err !== null && 'code' in err) {
    const obj = err as { code?: unknown; status?: unknown };
    if (typeof obj.code === 'string' && obj.code.trim().length > 0 && obj.code.length <= 40) {
      code = obj.code;
    }
    if (typeof obj.status === 'number' && obj.status >= 400 && obj.status < 600) {
      statusCode = obj.status;
    }
    message = statusCode >= 500
      ? 'An internal error occurred while processing your request.'
      : 'Invalid request parameters.';
  }

  console.error(`[API_ERROR] ${code} (${statusCode}):`, err);

  const headers = req ? getCorsHeaders(req) : corsHeaders;

  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code,
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    }
  );
}

export function successResponse(data: unknown, statusCode = 200, req?: Request): Response {
  const headers = req ? getCorsHeaders(req) : corsHeaders;

  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    }
  );
}
