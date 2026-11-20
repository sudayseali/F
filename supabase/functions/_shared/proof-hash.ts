// supabase/functions/_shared/proof-hash.ts
// Authoritative server-side screenshot path validation, image magic-byte check,
// and SHA-256 fingerprint computation for duplicate-proof anti-fraud enforcement.

import { AppError } from "./errors.ts";

const ALLOWED_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp"]);
const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5MB bucket limit
const MIN_PROOF_BYTES = 32;

export function isValidSha256Hex(val: string | null | undefined): boolean {
  return typeof val === "string" && /^[a-f0-9]{64}$/i.test(val.trim());
}

/**
 * Ensures the proof object path belongs strictly to the authenticated user's
 * folder inside the `proofs` bucket and has an allowed image extension.
 */
export function isValidUserProofPath(userId: string, rawPath: string): boolean {
  const path = String(rawPath || "").trim();
  if (!userId || !path) return false;
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) return false;
  if (!path.startsWith(`${userId}/`)) return false;

  const rest = path.slice(userId.length + 1);
  if (!rest || rest.includes("/")) return false;

  const dotIdx = rest.lastIndexOf(".");
  if (dotIdx <= 0) return false;
  const ext = rest.slice(dotIdx + 1).toLowerCase();
  return ALLOWED_IMAGE_EXTS.has(ext) && /^[A-Za-z0-9._-]+$/.test(rest);
}

/**
 * Verifies image file headers (magic bytes) for PNG, JPEG, or WebP so arbitrary
 * non-image payloads renamed to `.png` cannot bypass image validation.
 */
export function hasValidImageMagicBytes(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 12) return false;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) return true;

  // JPEG: FF D8 FF
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isJpeg) return true;

  // WebP: "RIFF" .... "WEBP"
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  return isWebp;
}

export async function computeSha256HexFromBytes(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface VerifiedProofFile {
  proofPath: string;
  sha256Hex: string;
  byteLength: number;
}

/**
 * Downloads the uploaded screenshot from the private `proofs` bucket using service_role,
 * verifies path ownership, byte limits, and real image headers, and computes its
 * authoritative SHA-256 hash.
 */
export async function verifyAndHashUploadedProof(
  supabaseAdmin: any,
  userId: string,
  proofPath: string
): Promise<VerifiedProofFile> {
  const cleanPath = String(proofPath || "").trim();

  if (!isValidUserProofPath(userId, cleanPath)) {
    throw new AppError(
      "Screenshot proof must be uploaded to your own account folder as PNG, JPG, JPEG, or WebP.",
      400,
      "INVALID_PROOF_PATH"
    );
  }

  const { data: fileData, error: dlErr } = await supabaseAdmin.storage
    .from("proofs")
    .download(cleanPath);

  if (dlErr || !fileData) {
    throw new AppError(
      "Uploaded screenshot proof could not be verified in storage. Please re-upload and try again.",
      400,
      "PROOF_FILE_NOT_FOUND"
    );
  }

  const arrayBuf = await fileData.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);

  if (bytes.byteLength < MIN_PROOF_BYTES || !hasValidImageMagicBytes(bytes)) {
    throw new AppError(
      "Uploaded file is not a valid PNG, JPEG, or WebP image screenshot.",
      400,
      "INVALID_PROOF_IMAGE"
    );
  }

  if (bytes.byteLength > MAX_PROOF_BYTES) {
    throw new AppError(
      "Screenshot image exceeds the maximum allowed size of 5MB.",
      400,
      "PROOF_TOO_LARGE"
    );
  }

  const sha256Hex = await computeSha256HexFromBytes(bytes);

  return {
    proofPath: cleanPath,
    sha256Hex,
    byteLength: bytes.byteLength,
  };
}
