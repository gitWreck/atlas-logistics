/**
 * True if delay is currently active
 */
export function isDelayActive(record) {
  return Boolean(record?.delayReason && record?.delayCleared === false);
}

/**
 * Normalize delay payload for SMS / UI
 */
export function getDelayState(record) {
  return {
    active: isDelayActive(record),
    reason: record?.delayReason || null,
    cleared: record?.delayCleared ?? true,
    startedAt: record?.delayStartedAt || null
  };
}
