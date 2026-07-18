import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const DEVICE_STORAGE_KEY = "@atlas/calls/device-id";
const WEB_SESSION_KEY = "atlas.calls.session-id";
const WEB_DEVICE_KEY = "atlas.calls.device-id";

const createId = (prefix) =>
  `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 12)}`;

const runtimeSessionId = createId(Platform.OS === "web" ? "web" : "mobile");
let identityPromise = null;

async function loadIdentity() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    let sessionId = window.sessionStorage.getItem(WEB_SESSION_KEY);
    let deviceId = window.localStorage.getItem(WEB_DEVICE_KEY);
    if (!sessionId) {
      sessionId = runtimeSessionId;
      window.sessionStorage.setItem(WEB_SESSION_KEY, sessionId);
    }
    if (!deviceId) {
      deviceId = createId("web-device");
      window.localStorage.setItem(WEB_DEVICE_KEY, deviceId);
    }
    return { sessionId, deviceId };
  }

  let deviceId = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
  if (!deviceId) {
    deviceId = createId("mobile-device");
    await AsyncStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
  }
  return { sessionId: runtimeSessionId, deviceId };
}

export function getCallIdentity() {
  if (!identityPromise) identityPromise = loadIdentity();
  return identityPromise;
}

export async function getCallSessionId() {
  return (await getCallIdentity()).sessionId;
}
