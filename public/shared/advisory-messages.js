/**
 * Canonical Atlas advisory messages
 *
 * Usage:
 * - SMS broadcasts
 * - Admin bulk notifications
 * - Operational announcements
 *
 * Rules:
 * - Courier-grade tone (J&T / NinjaVan style)
 * - Neutral, factual
 * - SMS-safe length
 */
export const ADVISORY_MESSAGES = Object.freeze({
  LOADING_TOMORROW_DIVISORIA:
    "ATLAS Advisory: Truck loading is scheduled tomorrow at our Divisoria warehouse. Please send shipments early to ensure inclusion.",

  LOADING_NOW_DIVISORIA:
    "ATLAS Advisory: Truck loading is currently in progress at our Divisoria warehouse.",

  WEATHER_RORO_DELAY:
    "ATLAS Advisory: Weather conditions may impact sailing schedules. Customers are advised to ship early. Early-loaded trucks will remain at the port until RORO operations resume."
});
