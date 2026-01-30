/**
 * AI-style delay explanation generator
 * Deterministic, customer-safe, no hallucinations
 */

export function generateDelayExplanation({
  delayReason,
  delayDuration,
  status
}) {
  if (!delayReason) return null;

  const durationText = delayDuration
    ? `This delay has lasted approximately ${delayDuration}. `
    : "";

  switch (delayReason) {
    case "RORO_FULL":
      return (
        "The assigned RORO vessel reached full capacity before boarding. " +
        durationText +
        "We are prioritizing the next available sailing to move your shipment safely."
      );

    case "WEATHER":
      return (
        "Operations were temporarily paused due to weather conditions for safety reasons. " +
        durationText +
        "Movement will resume once conditions are cleared by port authorities."
      );

    case "PORT_CONGESTION":
      return (
        "High port traffic caused slower processing of outbound trucks. " +
        durationText +
        "Your shipment remains secured and queued for the next movement window."
      );

    case "TRUCK_REPAIR":
      return (
        "The assigned truck required maintenance to ensure safe delivery. " +
        durationText +
        "The shipment will continue once the vehicle is cleared or reassigned."
      );

    case "DOCUMENT_ISSUE":
      return (
        "A documentation issue required verification before proceeding. " +
        durationText +
        "This is being resolved to avoid delivery complications."
      );

    default:
      return (
        "An operational delay occurred. " +
        durationText +
        "We are actively working to resume normal delivery."
      );
  }
}
