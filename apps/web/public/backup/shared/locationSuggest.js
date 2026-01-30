// shared/locationSuggest.js
import { LOCATIONS } from "./locations.js";

function normalize(s) {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

/* Simple distance matcher (fast + good enough) */
function scoreMatch(input, target) {
  if (target.startsWith(input)) return 100;
  if (target.includes(input)) return 80;

  let score = 0;
  for (const c of input) {
    if (target.includes(c)) score++;
  }
  return score;
}

export function suggestLocation(input) {
  if (!input) return null;

  const key = normalize(input);

  // Exact match
  const exact = LOCATIONS.find(l => l.label === key);
  if (exact) return { exact: true, match: exact };

  // Best guess
  let best = null;
  let bestScore = 0;

  for (const loc of LOCATIONS) {
    const score = scoreMatch(key, loc.label);
    if (score > bestScore) {
      bestScore = score;
      best = loc;
    }
  }

  return bestScore >= 60
    ? { exact: false, match: best }
    : null;
}
