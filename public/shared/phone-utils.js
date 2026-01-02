/**
 * Normalize Philippine mobile numbers to strict 09XXXXXXXXX format
 *
 * Accepts:
 * - 09XXXXXXXXX
 * - 9XXXXXXXXX
 * - +639XXXXXXXXX
 * - 639XXXXXXXXX
 * - 009639XXXXXXXXX
 *
 * Rejects:
 * - Landlines (02, 03, etc.)
 * - Shortcodes
 * - Invalid lengths
 * - Non-PH numbers
 */
export function normalizePHPhone(input) {
  if (!input) return null;

  let raw = String(input).trim();

  // Remove all non-digits
  raw = raw.replace(/\D/g, "");

  // Handle 00963 prefix
  if (raw.startsWith("00963")) {
    raw = raw.slice(4);
  }

  // Handle +63 / 63 prefix
  if (raw.startsWith("63")) {
    raw = raw.slice(2);
  }

  // Convert 9XXXXXXXXX → 09XXXXXXXXX
  if (raw.length === 10 && raw.startsWith("9")) {
    raw = "0" + raw;
  }

  // Fast length sanity check
  if (raw.length !== 11) return null;

  // Strict PH mobile validation (09XXXXXXXXX)
  if (!/^09\d{9}$/.test(raw)) {
    return null;
  }

  return raw;
}
