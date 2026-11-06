// supabase/functions/_shared/errors.ts
// Standardized error handling and responses

import { corsHeaders } from './cors.ts';

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

export function errorResponse(err: unknown): Response {
  let message = 'An unexpected error occurred.';
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';

  if (err instanceof AppError) {
    message = err.message;
    statusCode = err.statusCode;
    code = err.code;
  } else if (err instanceof Error) {
    message = err.message;
    statusCode = 400;
    code = 'BAD_REQUEST';
  }

  console.error(`[API_ERROR] ${code} (${statusCode}):`, message);

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
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

export function successResponse(data: unknown, statusCode = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}
