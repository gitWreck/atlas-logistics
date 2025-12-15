export function normalizePHPhone(input) {
  if (!input) return null;

  let raw = String(input).trim();

  // Remove spaces, dashes, non-digits
  raw = raw.replace(/\D/g, "");

  // 63XXXXXXXXXX → 0XXXXXXXXXX
  if (raw.startsWith("63") && raw.length === 12) {
    raw = "0" + raw.slice(2);
  }

  // 9XXXXXXXXX → 09XXXXXXXXX
  if (raw.length === 10 && raw.startsWith("9")) {
    raw = "0" + raw;
  }

  // Final strict validation
  if (!/^09\d{9}$/.test(raw)) {
    return null;
  }

  return raw;
}
