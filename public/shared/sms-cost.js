/**
 * Estimate SMS length and credit usage
 * Semaphore PH accurate
 */
export function estimateSmsCost(message = "") {
  const text = String(message);
  const length = text.length;

  const credits =
    length <= 160 ? 1 : Math.ceil(length / 153);

  return { length, credits };
}
