import crypto from "node:crypto";

/**
 * Meta signs every webhook POST with `X-Hub-Signature-256: sha256=<hmac>` where
 * the HMAC is computed over the EXACT raw request body using the app secret.
 * Always verify against the raw bytes — re-serializing parsed JSON will not match.
 */

export function computeSignature(rawBody: string, appSecret: string): string {
  const hmac = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return `sha256=${hmac}`;
}

export function verifySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected = computeSignature(rawBody, appSecret);
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
