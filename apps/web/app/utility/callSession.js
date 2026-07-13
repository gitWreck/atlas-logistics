const SESSION_KEY = "atlas.calls.session-id";
const DEVICE_KEY = "atlas.calls.device-id";

const createId = (prefix) =>
  `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 12)}`;

const runtimeSessionId = createId("manager-web");

export function getCallIdentity() {
  if (typeof window === "undefined") {
    return { sessionId: runtimeSessionId, deviceId: runtimeSessionId };
  }

  let sessionId = window.sessionStorage.getItem(SESSION_KEY);
  let deviceId = window.localStorage.getItem(DEVICE_KEY);
  if (!sessionId) {
    sessionId = runtimeSessionId;
    window.sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  if (!deviceId) {
    deviceId = createId("manager-device");
    window.localStorage.setItem(DEVICE_KEY, deviceId);
  }
  return { sessionId, deviceId };
}

export function getCallSessionId() {
  return getCallIdentity().sessionId;
}
