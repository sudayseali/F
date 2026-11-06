// supabase/functions/_shared/validation.ts
// Financial and input validation utilities

import { AppError } from './errors.ts';

export function validatePositiveAmount(amount: any, min = 1.0, max = 10000.0): number {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num) || !isFinite(num)) {
    throw new AppError('Invalid numerical amount.', 400, 'INVALID_AMOUNT');
  }
  if (num < min) {
    throw new AppError(`Amount must be at least $${min.toFixed(2)}.`, 400, 'AMOUNT_TOO_LOW');
  }
  if (num > max) {
    throw new AppError(`Amount exceeds maximum allowable limit of $${max.toFixed(2)}.`, 400, 'AMOUNT_TOO_HIGH');
  }
  // Check decimal places (max 2 decimals for fiat/stablecoins)
  const parts = num.toString().split('.');
  if (parts.length > 1 && parts[1].length > 2) {
    return Math.floor(num * 100) / 100;
  }
  return num;
}

export function validatePayoutAddress(method: string, address: string): string {
  if (!address || typeof address !== 'string') {
    throw new AppError('Wallet or account address is required.', 400, 'MISSING_ADDRESS');
  }
  const clean = address.trim();

  if (method === 'usdt' || method === 'trx') {
    // TRON address standard: 34 characters, starts with T
    const tronRegex = /^T[a-km-zA-HJ-NP-Z1-9]{33}$/;
    if (!tronRegex.test(clean)) {
      throw new AppError('Invalid TRON / USDT (TRC20) address format. Must begin with T and be 34 characters.', 400, 'INVALID_TRON_ADDRESS');
    }
  } else if (method === 'usdt_bep20') {
    // EVM / BNB Smart Chain address standard: 0x followed by 40 hex characters
    const evmRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!evmRegex.test(clean)) {
      throw new AppError('Invalid BNB Smart Chain (BEP20) address format. Must begin with 0x and be 42 characters long.', 400, 'INVALID_BEP20_ADDRESS');
    }
  } else if (method === 'payeer') {
    // Payeer account format: P followed by 7 to 12 digits
    const payeerRegex = /^P[0-9]{7,12}$/;
    if (!payeerRegex.test(clean)) {
      throw new AppError('Invalid Payeer account number. Must begin with P followed by digits (e.g. P10000000).', 400, 'INVALID_PAYEER_ACCOUNT');
    }
  } else {
    if (clean.length < 5 || clean.length > 120) {
      throw new AppError('Invalid payment recipient identifier.', 400, 'INVALID_RECIPIENT');
    }
  }

  return clean;
}

export function sanitizeString(val: any, maxLength = 500): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  // Strip control characters & potential script tags
  return str.replace(/<[^>]*>?/gm, '').slice(0, maxLength);
}

export function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
