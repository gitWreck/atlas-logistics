import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { arrayUnion, collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";

import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  acceptConversationCall,
  createCallHistoryMessage,
  heartbeatConversationCall,
  updateConversationCallStatus,
} from "../utilities/FirebaseFunctions";
import { getCallSessionId } from "./callSession";
import useTencentWebCall from "./useTencentWebCall";
import {
  CallControls,
  VideoCallHeader,
  VideoPlaceholder,
} from "./CallPresentation";

function getCallTitle(call) {
  const type = String(call?.type || "voice").toLowerCase();
  return type === "video" ? "Incoming video call" : "Incoming voice call";
}

function getInitials(name = "") {
  return String(name || "Atlas")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

function callActivityMillis(call = {}) {
  const timestamp = call.updatedAt || call.createdAt || call.startedAt;
  if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
  const parsed = new Date(timestamp || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function terminalCallToast(status) {
  switch (String(status || "").trim().toLowerCase()) {
    case "declined":
      return "Call declined";
    case "missed":
      return "Missed call";
    case "cancelled":
      return "Call cancelled";
    case "ended":
      return "Call ended";
    default:
      return "";
  }
}

const ACTIVE_CALL_STATUSES_FOR_CLIENT = ["ringing", "connecting", "accepted", "connected", "ongoing"];
const REMOTE_HEARTBEAT_STALE_MS = 90_000;

function heartbeatMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  const seconds = Number(value?.seconds || value?._seconds || 0);
  if (seconds > 0) return seconds * 1000;
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function belongsToCallSession(call, userId, sessionId) {
  const isCaller = String(call?.callerId || "") === String(userId || "");
  const status = String(call?.status || "").trim().toLowerCase();
  if (status === "ringing" && !isCaller) return true;
  const boundSessionId = isCaller ? call?.callerSessionId : call?.receiverSessionId;
  return !boundSessionId || String(boundSessionId) === String(sessionId || "");
}

function WebMediaElement({ stream, muted = false, hidden = false, style }) {
  const elementRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !elementRef.current) return;
    elementRef.current.srcObject = stream || null;
    if (stream) {
      const playAttempt = elementRef.current.play?.();
      playAttempt?.catch?.(() => {});
    }
  }, [stream]);

  if (Platform.OS !== "web") return null;

  return React.createElement("video", {
    ref: elementRef,
    autoPlay: true,
    playsInline: true,
    muted,
    style: hidden
      ? { position: "absolute", width: 1, height: 1, opacity: 0 }
      : style,
  });
}

export default function IncomingCallListener() {
  const { user, loading, isReady } = useAuth();
  const { resolvedScheme } = useTheme();
  const isDarkCallTheme = resolvedScheme === "dark";
  const callPalette = isDarkCallTheme
    ? { background: "#07111F", surface: "#172337", text: "#FFFFFF", muted: "#94A3B8" }
    : { background: "#EEF4FC", surface: "#FFFFFF", text: "#0F172A", muted: "#64748B" };
  const [activeCall, setActiveCall] = useState(null);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [isCallFullscreen, setIsCallFullscreen] = useState(false);
  const [conversationTitle, setConversationTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [callToast, setCallToast] = useState("");
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [cameraType, setCameraType] = useState("front");
  const [callSessionId, setCallSessionId] = useState("");
  const [localMediaStream, setLocalMediaStream] = useState(null);
  const [remoteMediaStream, setRemoteMediaStream] = useState(null);
  const [rtcNotice, setRtcNotice] = useState("");
  const callMapRef = useRef(new Map());
  const prevCallStatusRef = useRef(new Map());
  const activeCallRef = useRef(null);
  const timeoutRef = useRef(null);
  const toastTimerRef = useRef(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(12)).current;
  const callDurationRef = useRef(0);
  const nativeVideoStageRef = useRef({ width: 0, height: 0 });
  const nativePreviewPositionRef = useRef({ x: 0, y: 0 });
  const nativePreviewDragStartRef = useRef({ x: 0, y: 0 });
  const nativePreviewPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const ringingPulse = useRef(new Animated.Value(0)).current;
  const nativePreviewSize = { width: 112, height: 184 };
  const peerConnectionRef = useRef(null);
  const rtcCallIdRef = useRef(null);
  const processedCandidatesRef = useRef(new Set());
  const remoteTimeoutEndingRef = useRef(false);
  const callSurfaceRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    getCallSessionId().then((value) => {
      if (mounted) setCallSessionId(value);
    }).catch((error) => console.warn("Unable to initialize call session", error));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const isRinging = String(activeCall?.status || "").trim().toLowerCase() === "ringing";
    if (!isRinging) {
      ringingPulse.stopAnimation();
      ringingPulse.setValue(0);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(ringingPulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(ringingPulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [activeCall?.status, ringingPulse]);

  useEffect(() => {
    setIsCallMinimized(false);
    setIsCallFullscreen(false);
  }, [activeCall?.id]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return undefined;
    const syncFullscreen = () => setIsCallFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  const {
    localViewId,
    remoteViewId,
    localVideoReady,
    remoteVideoReady,
    remoteUserId,
    mediaNotice,
    NativeLocalVideoView,
    NativeRemoteVideoView,
    nativeVideoStreamType,
    nativeVideoViewType,
  } = useTencentWebCall({
    activeCall,
    userId: user?.uid,
    isMuted,
    isSpeakerOn,
    isCameraOn,
    cameraType,
  });

  const positionNativePreview = (x, y) => {
    const stage = nativeVideoStageRef.current;
    const maxX = Math.max(0, stage.width - nativePreviewSize.width);
    const maxY = Math.max(0, stage.height - nativePreviewSize.height);
    const next = {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
    nativePreviewPositionRef.current = next;
    nativePreviewPan.setValue(next);
  };

  const resetNativePreview = () => {
    const stage = nativeVideoStageRef.current;
    positionNativePreview(
      Math.max(0, stage.width - nativePreviewSize.width - 20),
      Math.max(0, stage.height - nativePreviewSize.height - 126),
    );
  };

  const nativePreviewPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        nativePreviewDragStartRef.current = { ...nativePreviewPositionRef.current };
      },
      onPanResponderMove: (_event, gesture) => {
        const start = nativePreviewDragStartRef.current;
        const stage = nativeVideoStageRef.current;
        const maxX = Math.max(0, stage.width - 112);
        const maxY = Math.max(0, stage.height - 184);
        const next = {
          x: Math.min(Math.max(0, start.x + gesture.dx), maxX),
          y: Math.min(Math.max(0, start.y + gesture.dy), maxY),
        };
        nativePreviewPositionRef.current = next;
        nativePreviewPan.setValue(next);
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const cleanupWebRtc = () => {
    const peer = peerConnectionRef.current;
    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
      peer.close();
    }
    peerConnectionRef.current = null;
    rtcCallIdRef.current = null;
    processedCandidatesRef.current.clear();

    setLocalMediaStream((current) => {
      current?.getTracks?.().forEach((track) => track.stop());
      return null;
    });
    setRemoteMediaStream(null);
    setRtcNotice("");
  };

  const syncRemoteSignals = async (call, peer, isCaller) => {
    if (!peer || !call) return;

    const remoteDescription = isCaller ? call.rtcAnswer : call.rtcOffer;
    if (remoteDescription?.sdp && !peer.currentRemoteDescription) {
      await peer.setRemoteDescription(remoteDescription);
    }

    if (!peer.currentRemoteDescription) return;

    const remoteUserId = isCaller ? call.receiverId : call.callerId;
    const candidates = call.rtcCandidates?.[remoteUserId] || [];
    for (const candidate of candidates) {
      const candidateKey = JSON.stringify(candidate);
      if (processedCandidatesRef.current.has(candidateKey)) continue;
      try {
        await peer.addIceCandidate(candidate);
        processedCandidatesRef.current.add(candidateKey);
      } catch (error) {
        console.warn("Unable to add remote ICE candidate", error);
      }
    }
  };

  const ensureWebRtc = async (call) => {
    if (
      Platform.OS !== "web" ||
      !call?.id ||
      !user?.uid ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof RTCPeerConnection === "undefined"
    ) {
      return;
    }

    const isCaller = String(call.callerId || "") === user.uid;
    const existingPeer = peerConnectionRef.current;
    if (existingPeer && rtcCallIdRef.current === call.id) {
      await syncRemoteSignals(call, existingPeer, isCaller);
      if (
        !isCaller &&
        call.rtcOffer?.sdp &&
        !call.rtcAnswer?.sdp &&
        existingPeer.currentRemoteDescription &&
        !existingPeer.currentLocalDescription
      ) {
        const answer = await existingPeer.createAnswer();
        await existingPeer.setLocalDescription(answer);
        await updateDoc(doc(db, "calls", call.id), {
          rtcAnswer: { type: answer.type, sdp: answer.sdp },
          rtcAnswerBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      }
      return;
    }
    if (!existingPeer && rtcCallIdRef.current === call.id) return;

    cleanupWebRtc();
    rtcCallIdRef.current = call.id;

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: call.type === "video" ? { facingMode: cameraType } : false,
        });
      } catch (mediaError) {
        if (call.type !== "video" || mediaError?.name !== "NotReadableError") {
          throw mediaError;
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setRtcNotice("Camera is being used by another app. Voice will continue without video.");
      }
      if (rtcCallIdRef.current !== call.id) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setLocalMediaStream(stream);
      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      peerConnectionRef.current = peer;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (event) => {
        const remoteStream = event.streams?.[0];
        if (remoteStream) setRemoteMediaStream(remoteStream);
      };
      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        const candidate = event.candidate.toJSON
          ? event.candidate.toJSON()
          : JSON.parse(JSON.stringify(event.candidate));
        updateDoc(doc(db, "calls", call.id), {
          [`rtcCandidates.${user.uid}`]: arrayUnion(candidate),
          updatedAt: serverTimestamp(),
        }).catch((error) => console.warn("Unable to publish ICE candidate", error));
      };
      peer.onconnectionstatechange = () => {
        console.log("[WebRTC] Connection state:", peer?.connectionState);
        console.log("[WebRTC] ICE state:", peer?.iceConnectionState);
        console.log("[WebRTC] Signaling state:", peer?.signalingState);
        if (peer.connectionState === "connected") {
          setRtcNotice("");
          updateConversationCallStatus({ callId: call.id, status: "connected" }).catch(
            (error) => console.warn("Unable to mark call connected", error),
          );
        } else if (["failed", "disconnected"].includes(peer.connectionState)) {
          setRtcNotice("Media connection was interrupted.");
        }
      };
      peer.oniceconnectionstatechange = () => {
        console.log("[WebRTC] Connection state:", peer?.connectionState);
        console.log("[WebRTC] ICE state:", peer?.iceConnectionState);
        console.log("[WebRTC] Signaling state:", peer?.signalingState);
      };

      if (isCaller) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await updateDoc(doc(db, "calls", call.id), {
          rtcOffer: { type: offer.type, sdp: offer.sdp },
          rtcOfferBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        if (!call.rtcOffer?.sdp) {
          setRtcNotice("Waiting for the caller's media connection...");
          return;
        }
        await peer.setRemoteDescription(call.rtcOffer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await updateDoc(doc(db, "calls", call.id), {
          rtcAnswer: { type: answer.type, sdp: answer.sdp },
          rtcAnswerBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      }

      await syncRemoteSignals(call, peer, isCaller);
    } catch (error) {
      console.error("Browser call media failed:", error);
      const permissionDenied = ["NotAllowedError", "PermissionDeniedError"].includes(error?.name);
      setRtcNotice(
        permissionDenied
          ? "Allow microphone and camera access in your browser to continue the call."
          : "Microphone or camera could not be started.",
      );
    }
  };

  useEffect(() => {
    if (!user?.uid || loading || !isReady || !callSessionId) {
      callMapRef.current.clear();
      prevCallStatusRef.current.clear();
      activeCallRef.current = null;
      setActiveCall(null);
      setConversationTitle("");
      setCallToast("");
      toastOpacity.setValue(0);
      toastTranslateY.setValue(12);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      return undefined;
    }

    const uid = user.uid;
    const receiverQuery = query(collection(db, "calls"), where("receiverId", "==", uid));
    const callerQuery = query(collection(db, "calls"), where("callerId", "==", uid));

    const syncActiveCall = () => {
      const entries = [...callMapRef.current.values()]
        .filter((call) => String(call?.receiverId || "").trim() === uid || String(call?.callerId || "").trim() === uid)
        .filter((call) => belongsToCallSession(call, uid, callSessionId))
        .filter((call) => {
          const status = String(call?.status || "").trim().toLowerCase();
          return ["ringing", "accepted", "connecting", "connected", "ongoing", "declined", "missed", "cancelled", "ended"].includes(status);
        })
        .sort((left, right) => callActivityMillis(right) - callActivityMillis(left));

      const preferred = entries.find((call) => ["connected", "ongoing", "accepted", "connecting"].includes(String(call?.status || "").trim().toLowerCase()));
      const ringingCall = entries.find((call) => String(call?.callerId || "").trim() === uid && String(call?.status || "").trim().toLowerCase() === "ringing") || entries.find((call) => String(call?.receiverId || "").trim() === uid && String(call?.status || "").trim().toLowerCase() === "ringing");
      const nextCall = preferred || ringingCall || null;
      // update both state and ref synchronously so snapshot handlers can respond immediately
      if (!nextCall) {
        if (activeCallRef.current?.id) setConversationTitle("");
        activeCallRef.current = null;
        setActiveCall(null);
      } else {
        activeCallRef.current = nextCall;
        setActiveCall(nextCall);
      }
    };

    const applySnapshot = (snap) => {
      const docs = snap.docs || [];
      const nextIds = new Set();
      const prevStatusMap = new Map();

      docs.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const callId = docSnap.id;
        nextIds.add(callId);

        const nextStatus = String(data.status || "").trim().toLowerCase();
        const prevStatus = prevCallStatusRef.current.get(callId);
        prevStatusMap.set(callId, prevStatus);

        prevCallStatusRef.current.set(callId, nextStatus);
        callMapRef.current.set(callId, { id: callId, ...data });
      });

      Array.from(prevCallStatusRef.current.keys()).forEach((callId) => {
        if (!nextIds.has(callId)) {
          prevCallStatusRef.current.delete(callId);
        }
      });

      // Inspect the previous active call before syncActiveCall removes terminal calls.
      const currentActiveCallId = activeCallRef.current?.id;
      if (currentActiveCallId) {
        const prev = prevStatusMap.get(currentActiveCallId);
        const current = String(callMapRef.current.get(currentActiveCallId)?.status || "").trim().toLowerCase();
        if (prev !== current && ["declined", "missed", "cancelled", "ended"].includes(current)) {
          const toastMessage = terminalCallToast(current);
          if (toastMessage) showCallToast(toastMessage);
          try { cleanupWebRtc(); } catch (err) { console.warn("cleanupWebRtc error on terminal status:", err); }
          closeDialog();
          return;
        }
      }
      syncActiveCall();
    };

    const unsubscribeReceiver = onSnapshot(receiverQuery, applySnapshot, (error) => {
      console.error("Incoming call receiver listener error:", error);
    });
    const unsubscribeCaller = onSnapshot(callerQuery, applySnapshot, (error) => {
      console.error("Incoming call caller listener error:", error);
    });

    return () => {
      unsubscribeReceiver?.();
      unsubscribeCaller?.();
      callMapRef.current.clear();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [user?.uid, loading, isReady, callSessionId]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    remoteTimeoutEndingRef.current = false;
  }, [activeCall?.id]);

  useEffect(() => {
    const status = String(activeCall?.status || "").trim().toLowerCase();
    const isCaller = String(activeCall?.callerId || "") === String(user?.uid || "");
    const shouldHeartbeat = Boolean(
      activeCall?.id &&
      callSessionId &&
      ACTIVE_CALL_STATUSES_FOR_CLIENT.includes(status) &&
      (status !== "ringing" || isCaller),
    );
    if (!shouldHeartbeat) return undefined;

    const pulse = () => heartbeatConversationCall({ callId: activeCall.id }).catch(() => {});
    pulse();
    const interval = setInterval(pulse, 20_000);
    return () => clearInterval(interval);
  }, [activeCall?.id, activeCall?.status, activeCall?.callerId, callSessionId, user?.uid]);

  useEffect(() => {
    const status = String(activeCall?.status || "").trim().toLowerCase();
    if (!activeCall?.id || !["accepted", "connecting", "connected", "ongoing"].includes(status)) {
      return undefined;
    }

    const checkRemoteHeartbeat = async () => {
      if (remoteTimeoutEndingRef.current) return;
      try {
        const snap = await getDoc(doc(db, "calls", activeCall.id));
        if (!snap.exists()) return;
        const call = snap.data() || {};
        const latestStatus = String(call.status || "").trim().toLowerCase();
        if (!["accepted", "connecting", "connected", "ongoing"].includes(latestStatus)) return;
        const isCaller = String(call.callerId || "") === String(user?.uid || "");
        const remoteHeartbeat = heartbeatMillis(
          isCaller ? call.receiverLastHeartbeatAt : call.callerLastHeartbeatAt,
        );
        if (!remoteHeartbeat || Date.now() - remoteHeartbeat <= REMOTE_HEARTBEAT_STALE_MS) return;

        remoteTimeoutEndingRef.current = true;
        await updateConversationCallStatus({
          callId: activeCall.id,
          status: "ended",
          duration: callDurationRef.current,
          endReason: "remote_heartbeat_timeout",
        });
      } catch (error) {
        remoteTimeoutEndingRef.current = false;
        console.warn("Remote call heartbeat check failed", error);
      }
    };

    const interval = setInterval(checkRemoteHeartbeat, 15_000);
    return () => clearInterval(interval);
  }, [activeCall?.id, activeCall?.status, user?.uid]);

  useEffect(() => {
    resetNativePreview();
  }, [activeCall?.id]);

  useEffect(() => {
    callDurationRef.current = callDurationSeconds;
  }, [callDurationSeconds]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") return;
      const call = activeCallRef.current;
      const currentStatus = String(call?.status || "").toLowerCase();
      if (!call?.id || !["ringing", "accepted", "connecting", "connected", "ongoing"].includes(currentStatus)) return;
      updateConversationCallStatus({
        callId: call.id,
        status: currentStatus === "ringing" ? "cancelled" : "ended",
        duration: callDurationRef.current,
        endReason: "app_backgrounded",
      }).catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  // Also listen directly to the active call document so terminal updates tear down immediately
  useEffect(() => {
    if (!activeCall?.id) return undefined;
    const callRef = doc(db, "calls", activeCall.id);
    const unsub = onSnapshot(callRef, (snap) => {
      const data = snap.data() || {};
      const status = String(data.status || "").trim().toLowerCase();
      if (["declined", "missed", "cancelled", "ended"].includes(status)) {
        const toastMessage = terminalCallToast(status);
        if (toastMessage) showCallToast(toastMessage);
        try { cleanupWebRtc(); } catch (err) { console.warn("cleanupWebRtc error on doc listener:", err); }
        closeDialog();
      }
    }, (err) => console.warn("active call doc listener error:", err));

    return () => unsub();
  }, [activeCall?.id]);

  useEffect(() => {
    const stream = localMediaStream;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = isCameraOn;
    });
  }, [isCameraOn, isMuted, localMediaStream]);

  useEffect(() => {
    if (Platform.OS !== "web" || !localMediaStream) return;
    const videoTrack = localMediaStream.getVideoTracks()[0];
    videoTrack?.applyConstraints?.({ facingMode: cameraType }).catch(() => {});
  }, [cameraType, localMediaStream]);

  useEffect(() => () => {
    cleanupWebRtc();
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!activeCall?.conversationId) {
      setConversationTitle("");
      return;
    }

    let isMounted = true;
    const loadConversationTitle = async () => {
      try {
        const snap = await getDoc(doc(db, "conversations", activeCall.conversationId));
        if (!isMounted) return;
        const conversation = snap.data() || {};
        const nextTitle = conversation?.conversationTitle || conversation?.title || conversation?.customerName || conversation?.subject || "Conversation";
        setConversationTitle(String(nextTitle || "Conversation"));
      } catch (error) {
        console.warn("Unable to load conversation title", error);
      }
    };

    loadConversationTitle();
    return () => {
      isMounted = false;
    };
  }, [activeCall?.conversationId]);

  useEffect(() => {
    if (!activeCall || String(activeCall?.status || "").trim().toLowerCase() !== "ringing") {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return undefined;
    }

    if (String(activeCall?.receiverId || "").trim() !== user?.uid) {
      return undefined;
    }

    timeoutRef.current = setTimeout(() => {
      void handleTimeout(activeCall?.id, activeCall?.status);
    }, 25000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [activeCall?.id, activeCall?.status, activeCall?.receiverId, user?.uid]);

  const closeDialog = () => {
    // ensure any active WebRTC peer and media tracks are cleaned up
    try {
      cleanupWebRtc();
    } catch (e) {
      console.warn("cleanupWebRtc failed:", e);
    }
    setActiveCall(null);
    setIsCallMinimized(false);
    setConversationTitle("");
    setCallDurationSeconds(0);
    setIsMuted(false);
    setIsSpeakerOn(true);
    setIsCameraOn(true);
    setCameraType("front");
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const status = String(activeCall?.status || "").trim().toLowerCase();
    const bothParticipantsJoined = Boolean(
      activeCall && ["connected", "ongoing"].includes(status),
    );

    if (!bothParticipantsJoined) {
      setCallDurationSeconds(0);
      return undefined;
    }

    const connectedAt = activeCall?.connectedAt;
    const initialSeconds = connectedAt?.toMillis
      ? Math.max(0, Math.floor((Date.now() - connectedAt.toMillis()) / 1000))
      : 0;
    setCallDurationSeconds(initialSeconds);

    const intervalId = setInterval(() => {
      setCallDurationSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeCall?.id, activeCall?.status, activeCall?.connectedAt]);

  const toggleMute = () => setIsMuted((current) => !current);
  const toggleSpeaker = () => setIsSpeakerOn((current) => !current);
  const toggleCamera = () => setIsCameraOn((current) => !current);
  const switchCamera = () => setCameraType((current) => (current === "front" ? "back" : "front"));

  const toggleCallFullscreen = async () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else {
        await callSurfaceRef.current?.requestFullscreen?.();
      }
    } catch (error) {
      console.warn("Unable to toggle call fullscreen", error);
    }
  };

  const showCallToast = (message) => {
    if (!message) return;

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastOpacity.stopAnimation();
    toastTranslateY.stopAnimation();
    setCallToast(message);
    toastOpacity.setValue(0);
    toastTranslateY.setValue(12);

    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.spring(toastTranslateY, {
        toValue: 0,
        speed: 24,
        bounciness: 3,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();

    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(toastTranslateY, {
          toValue: 8,
          duration: 180,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start(({ finished }) => {
        if (finished) setCallToast("");
      });
    }, 2400);
  };

  const logCallEvent = async ({ conversationId, callId, text }) => {
    if (!conversationId || !callId) return;
    try {
      await createCallHistoryMessage({ conversationId, callId, text });
    } catch (error) {
      console.warn("Unable to log call event", error);
    }
  };

  const handleTimeout = async (callId = activeCall?.id, currentStatus = activeCall?.status) => {
    const normalizedStatus = String(currentStatus || "").trim().toLowerCase();
    console.info("[call-timeout] executing", {
      source: "mobile",
      callId,
      status: normalizedStatus,
      receiverId: user?.uid || null,
    });

    if (!callId) return;

    try {
      const result = await updateConversationCallStatus({
        callId,
        status: "missed",
        endReason: "timeout",
      });
      const timedOut = result?.data?.changed === true || result?.changed === true;

      if (timedOut) {
        await logCallEvent({ conversationId: activeCall?.conversationId, callId: activeCall?.id, text: `📞 ${activeCall?.type === "video" ? "Video" : "Voice"} Call\nMissed Call` });
        closeDialog();
      }
    } catch (error) {
      console.error("Incoming call timeout failed:", error);
      closeDialog();
    }
  };


  const handleAccept = async () => {
    if (!activeCall?.id || isProcessing) return;

    setIsProcessing(true);
    try {
      const result = await acceptConversationCall({ callId: activeCall.id });
      const accepted = result?.data?.accepted === true || result?.accepted === true;

      if (!accepted) {
        throw new Error("The call could not be accepted.");
      }

      await updateDoc(doc(db, "calls", activeCall.id), {
        startedAt: serverTimestamp(),
        answeredAt: serverTimestamp(),
        acceptedBy: user?.uid || null,
        updatedAt: serverTimestamp(),
      });
      await logCallEvent({ conversationId: activeCall.conversationId, callId: activeCall.id, text: `📞 ${activeCall?.type === "video" ? "Video" : "Voice"} Call\nOngoing Call` });
    } catch (error) {
      console.error("Incoming call accept failed:", error);
      showCallToast("This call can no longer be accepted");
      closeDialog();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async (reason = "declined") => {
    if (!activeCall?.id || isProcessing) {
      closeDialog();
      return;
    }

    setIsProcessing(true);
    try {
      await updateConversationCallStatus({
        callId: activeCall.id,
        status: "declined",
      });
      await updateDoc(doc(db, "calls", activeCall.id), {
        endedReason: reason,
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logCallEvent({ conversationId: activeCall.conversationId, callId: activeCall.id, text: `📞 ${activeCall?.type === "video" ? "Video" : "Voice"} Call\nMissed Call` });
      closeDialog();
    } catch (error) {
      console.error("Incoming call decline failed:", error);
      closeDialog();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelCall = async () => {
    if (!activeCall?.id || isProcessing) return;

    setIsProcessing(true);
    try {
      await updateConversationCallStatus({ callId: activeCall.id, status: "cancelled" });
      await updateDoc(doc(db, "calls", activeCall.id), {
        endedReason: "cancelled",
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logCallEvent({ conversationId: activeCall.conversationId, callId: activeCall.id, text: `📞 ${activeCall?.type === "video" ? "Video" : "Voice"} Call\nCall Cancelled` });
      closeDialog();
    } catch (error) {
      console.error("Call cancel failed:", error);
      closeDialog();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndCall = async () => {
    if (!activeCall?.id || isProcessing) return;

    setIsProcessing(true);
    try {
      await updateConversationCallStatus({ callId: activeCall.id, status: "ended", duration: callDurationSeconds, endReason: "hangup" });
      closeDialog();
    } catch (error) {
      console.error("Call end failed:", error);
      closeDialog();
    } finally {
      setIsProcessing(false);
    }
  };

  const status = String(activeCall?.status || "").trim().toLowerCase();
  const isIncoming = Boolean(activeCall && String(activeCall?.receiverId || "").trim() === user?.uid && status === "ringing");
  const isCallerRinging = Boolean(activeCall && String(activeCall?.callerId || "").trim() === user?.uid && status === "ringing");
  const isActiveCall = Boolean(activeCall && ["accepted", "connecting", "connected", "ongoing"].includes(status));
  const showIncomingControls = isIncoming && status === "ringing";
  const peerName = String(activeCall?.callerId || "") === String(user?.uid || "")
    ? activeCall?.receiverName || activeCall?.receiverDisplayName || "Atlas staff"
    : activeCall?.callerName || "Atlas support";
  const callTypeLabel = activeCall?.type === "video" ? "Video Call" : "Voice Call";
  const mediaFailed = Boolean(mediaNotice && /failed|unable|could not|permission/i.test(mediaNotice));
  const statusLabel = isIncoming
    ? `Incoming ${callTypeLabel}`
    : isCallerRinging
      ? "Ringing"
      : status === "reconnecting"
        ? "Reconnecting"
        : mediaFailed
          ? "Failed"
          : ["connected", "ongoing"].includes(status)
            ? "Connected"
        : isActiveCall
          ? "Connecting"
          : status === "declined"
            ? "Declined"
            : status === "missed"
              ? "Missed"
              : status === "cancelled"
                ? "Cancelled"
                : status === "ended"
                  ? "Call Ended"
                  : "Calling";

  if (!activeCall && !callToast) {
    return null;
  }

  return (
    <>
      {callToast ? (
        <View style={[styles.callToastLayer, { pointerEvents: "none" }]}>
          <Animated.View
            accessibilityLiveRegion="polite"
            style={[
              styles.callToast,
              {
                opacity: toastOpacity,
                transform: [{ translateY: toastTranslateY }],
              },
            ]}
          >
            <FontAwesome5 name="phone-slash" size={13} color="#FFFFFF" />
            <Text style={styles.callToastText}>{callToast}</Text>
          </Animated.View>
        </View>
      ) : null}
      {activeCall && isActiveCall && isCallMinimized ? (
        <View pointerEvents="box-none" style={styles.miniCallLayer}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => setIsCallMinimized(false)}
            style={[styles.miniCallWidget, { backgroundColor: callPalette.surface }]}
            accessibilityRole="button"
            accessibilityLabel={`Return to ${callTypeLabel.toLowerCase()} with ${peerName}`}
          >
            <View style={styles.miniAvatar}>
              <Text style={styles.miniAvatarText}>{getInitials(peerName)}</Text>
            </View>
            <View style={styles.miniCallCopy}>
              <Text style={[styles.miniCallName, { color: callPalette.text }]} numberOfLines={1}>{peerName}</Text>
              <View style={styles.miniStatusRow}>
                <View style={styles.connectionDot} />
                <Text style={[styles.miniCallStatus, { color: callPalette.muted }]}>In Call · {formatDuration(callDurationSeconds)}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={(event) => { event.stopPropagation?.(); toggleMute(); }}
              style={[styles.miniActionButton, isMuted && styles.miniActionButtonMuted]}
              accessibilityLabel={isMuted ? "Unmute call" : "Mute call"}
            >
              <FontAwesome5 name={isMuted ? "microphone-slash" : "microphone"} size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={(event) => { event.stopPropagation?.(); void handleEndCall(); }}
              disabled={isProcessing}
              style={[styles.miniActionButton, styles.miniEndButton]}
              accessibilityLabel="End call"
            >
              {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="phone-slash" size={16} color="#fff" />}
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      ) : null}
      {activeCall ? (
        <Modal
          visible={!isCallMinimized}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (isActiveCall) setIsCallMinimized(true);
            else void handleDecline("declined");
          }}
        >
          <View
            ref={callSurfaceRef}
            style={[styles.messengerBackdrop, { backgroundColor: callPalette.background }]}
          >
            <View pointerEvents="none" style={styles.backgroundGlowTop} />
            <View pointerEvents="none" style={styles.backgroundGlowBottom} />
            {isActiveCall && activeCall?.type !== "video" ? (
              <TouchableOpacity
                onPress={() => setIsCallMinimized(true)}
                style={styles.minimizeCallButton}
                accessibilityRole="button"
                accessibilityLabel="Minimize call"
              >
                <FontAwesome5 name="chevron-down" size={19} color="#fff" />
              </TouchableOpacity>
            ) : null}
            {/* Video display for active video calls */}
            {activeCall?.type === "video" && isActiveCall ? (
              <>
                {Platform.OS === "web" && (
                  <View
                    style={styles.webVideoContainer}
                    onLayout={({ nativeEvent }) => {
                      nativeVideoStageRef.current = nativeEvent.layout;
                      resetNativePreview();
                    }}
                  >
                    {React.createElement(
                      "style",
                      null,
                      `#${remoteViewId}, #${remoteViewId} > *, #${remoteViewId} video, #${localViewId}, #${localViewId} > *, #${localViewId} video { width: 100% !important; height: 100% !important; } #${remoteViewId} video, #${localViewId} video { object-fit: cover !important; }`,
                    )}
                    {React.createElement("div", {
                      id: remoteViewId,
                      style: styles.remoteVideoFull,
                    })}
                    <Animated.View
                      {...nativePreviewPanResponder.panHandlers}
                      style={[
                        styles.nativeLocalPreview,
                        { transform: nativePreviewPan.getTranslateTransform() },
                      ]}
                    >
                      {React.createElement("div", {
                        id: localViewId,
                        style: {
                          ...styles.webLocalVideoFill,
                          opacity: localVideoReady ? 1 : 0,
                          transform: cameraType === "back" ? "none" : "scaleX(-1)",
                        },
                      })}
                      {!localVideoReady ? (
                        <View style={styles.localPreviewPlaceholder}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        </View>
                      ) : null}
                      <View style={[styles.previewDragHandle, { pointerEvents: "none" }]}>
                        <FontAwesome5 name="grip-lines" size={13} color="#fff" />
                      </View>
                    </Animated.View>
                    {!remoteVideoReady ? (
                      <View style={styles.videoPlaceholderOverlay}>
                        <View style={styles.videoWaitingAvatar}>
                          <Text style={styles.videoWaitingAvatarText}>{getInitials(activeCall?.callerName || "Atlas")}</Text>
                        </View>
                        <Text style={styles.videoPlaceholderText}>Connecting video…</Text>
                      </View>
                    ) : null}
                  </View>
                )}
                {Platform.OS !== "web" && (
                  <View
                    style={styles.nativeVideoContainer}
                    onLayout={({ nativeEvent }) => {
                      nativeVideoStageRef.current = nativeEvent.layout;
                      resetNativePreview();
                    }}
                  >
                    {remoteUserId && remoteVideoReady && NativeRemoteVideoView ? (
                      <NativeRemoteVideoView
                        userId={remoteUserId}
                        streamType={nativeVideoStreamType}
                        viewType={nativeVideoViewType}
                        style={styles.remoteVideoFull}
                      />
                    ) : (
                      <VideoPlaceholder name={peerName} status={statusLabel} />
                    )}
                    <Animated.View
                      {...nativePreviewPanResponder.panHandlers}
                      style={[
                        styles.nativeLocalPreview,
                        { transform: nativePreviewPan.getTranslateTransform() },
                      ]}
                    >
                      {localVideoReady && NativeLocalVideoView ? (
                        <NativeLocalVideoView
                          frontCamera={cameraType !== "back"}
                          mirror={cameraType !== "back"}
                          viewType={nativeVideoViewType}
                          style={styles.nativeLocalVideoFill}
                        />
                      ) : (
                        <View style={styles.localPreviewPlaceholder}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        </View>
                      )}
                      <View style={[styles.previewDragHandle, { pointerEvents: "none" }]}>
                        <FontAwesome5 name="grip-lines" size={13} color="#fff" />
                      </View>
                    </Animated.View>
                  </View>
                )}
              </>
            ) : null}

            {activeCall?.type === "video" && isActiveCall ? (
              <VideoCallHeader
                name={peerName}
                status={statusLabel}
                timer={formatDuration(callDurationSeconds)}
                fullscreen={isCallFullscreen}
                onMinimize={() => setIsCallMinimized(true)}
                onToggleFullscreen={toggleCallFullscreen}
              />
            ) : null}

            {/* Messenger-style centered content when no video or not active */}
            {!isActiveCall || activeCall?.type !== "video" ? (
              <View style={styles.messengerContent}>
                <Text style={[styles.callEyebrow, { color: callPalette.muted }]}>
                  {isIncoming ? peerName : isCallerRinging ? "Calling..." : status === "connected" ? formatDuration(callDurationSeconds) : "Connecting..."}
                </Text>
                <Text style={[styles.messengerName, { color: callPalette.text }]}>{peerName}</Text>
                <Text style={[styles.callTypeText, { color: callPalette.text }]}>{callTypeLabel}</Text>
                <View style={styles.connectionRow}>
                  {isActiveCall ? <View style={styles.connectionDot} /> : null}
                  <Text style={[styles.messengerStatus, { color: callPalette.muted }]}>{statusLabel}</Text>
                </View>

                <Animated.View style={[styles.avatarPulseOuter, (isIncoming || isCallerRinging) && styles.avatarPulseActive, (isIncoming || isCallerRinging) && { transform: [{ scale: ringingPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }] }]}>
                  <View style={styles.avatarPulseMiddle}>
                    <View style={styles.largeAvatar}>
                      <Text style={styles.largeAvatarText}>{getInitials(peerName)}</Text>
                    </View>
                  </View>
                </Animated.View>

                {/* Media notice if present */}
                {mediaNotice ? (
                  <Text style={styles.mediaNoticeText}>{mediaNotice}</Text>
                ) : null}

                {/* Action buttons */}
                <View style={styles.messengerActions}>
                  {showIncomingControls ? (
                    <>
                      <View style={styles.labeledAction}>
                        <TouchableOpacity style={styles.messengerDeclineBtn} onPress={() => handleDecline("declined")} disabled={isProcessing}>
                          {isProcessing ? <ActivityIndicator color="#fff" /> : <FontAwesome5 name="phone-slash" size={25} color="#fff" />}
                        </TouchableOpacity>
                        <Text style={[styles.actionLabel, { color: callPalette.text }]}>Decline</Text>
                      </View>
                      <View style={styles.labeledAction}>
                        <TouchableOpacity style={styles.messengerAcceptBtn} onPress={handleAccept} disabled={isProcessing}>
                          {isProcessing ? <ActivityIndicator color="#fff" /> : <FontAwesome5 name="phone-alt" size={25} color="#fff" />}
                        </TouchableOpacity>
                        <Text style={[styles.actionLabel, { color: callPalette.text }]}>Accept</Text>
                      </View>
                    </>
                  ) : isCallerRinging ? (
                    <View style={styles.ringingControls}>
                      <View style={styles.compactControlRow}>
                        <View style={styles.labeledAction}>
                          <TouchableOpacity style={[styles.secondaryCallButton, { backgroundColor: callPalette.surface }]} onPress={toggleMute}>
                            <FontAwesome5 name={isMuted ? "microphone-slash" : "microphone"} size={20} color={callPalette.text} />
                          </TouchableOpacity>
                          <Text style={[styles.actionLabel, { color: callPalette.text }]}>Mute</Text>
                        </View>
                        <View style={styles.labeledAction}>
                          <TouchableOpacity style={[styles.secondaryCallButton, { backgroundColor: callPalette.surface }]} onPress={toggleSpeaker}>
                            <FontAwesome5 name={isSpeakerOn ? "volume-up" : "volume-mute"} size={20} color={callPalette.text} />
                          </TouchableOpacity>
                          <Text style={[styles.actionLabel, { color: callPalette.text }]}>Speaker</Text>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.cancelCallPill} onPress={() => handleDecline("cancelled")} disabled={isProcessing}>
                        {isProcessing ? <ActivityIndicator color="#fff" /> : <FontAwesome5 name="phone-slash" size={18} color="#fff" />}
                        <Text style={styles.cancelCallText}>Cancel Call</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Controls overlay for active calls - bottom bar */}
            {isActiveCall ? (
              <CallControls
                video={activeCall?.type === "video"}
                muted={isMuted}
                speakerOn={isSpeakerOn}
                cameraOn={isCameraOn}
                processing={isProcessing}
                onMute={toggleMute}
                onSpeaker={toggleSpeaker}
                onCamera={toggleCamera}
                onSwitchCamera={switchCamera}
                onEnd={handleEndCall}
              />
            ) : null}
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  callToastLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Platform.OS === "ios" ? 42 : 28,
    zIndex: 20000,
    elevation: 20000,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  callToast: {
    maxWidth: 420,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "rgba(17, 24, 39, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 12,
  },
  callToastText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#111827",
  },
  card: {
    width: "100%",
    height: "100%",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 64 : 36,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    backgroundColor: "#111827",
    alignItems: "center",
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f8cff",
    marginBottom: 18,
  },
  avatarBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#263449",
    marginBottom: 14,
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 6,
    textAlign: "center",
  },
  caller: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 2,
  },
  role: {
    fontSize: 13,
    color: "#a9b4c5",
    marginBottom: 6,
    textAlign: "center",
  },
  meta: {
    fontSize: 13,
    color: "#8390a3",
    marginBottom: 14,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    marginTop: "auto",
  },
  statusText: {
    color: "#cbd5e1",
    fontSize: 13,
    marginTop: 8,
    marginBottom: 12,
    textAlign: "center",
  },
  videoStage: {
    width: "100%",
    flex: 1,
    minHeight: 280,
    maxHeight: 520,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    position: "relative",
    marginBottom: 8,
  },
  remoteVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    backgroundColor: "#0f172a",
  },
  remoteVideoPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  remoteVideoText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
  localVideo: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 104,
    height: 142,
    borderRadius: 14,
    objectFit: "cover",
    backgroundColor: "#1e293b",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "#ffffff",
  },
  rtcNotice: {
    width: "100%",
    color: "#fecaca",
    backgroundColor: "rgba(127, 29, 29, 0.45)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginBottom: 4,
  },
  activeStateBox: {
    width: "100%",
    paddingTop: 6,
    backgroundColor: "transparent",
  },
  activeStateText: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  button: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  declineButton: {
    backgroundColor: "#ef4444",
  },
  acceptButton: {
    backgroundColor: "#0f8cff",
  },
  declineText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 11,
  },
  acceptText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 11,
  },
  timerText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },
  controlRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    justifyContent: "center",
    gap: 14,
    marginTop: 12,
  },
  controlButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#263449",
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonActive: {
    backgroundColor: "#1877f2",
  },
  controlLabel: {
    color: "#ffffff",
    fontSize: 10,
    marginTop: 4,
    fontWeight: "700",
    textAlign: "center",
  },
  controlRowCentered: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  endCallButton: {
    backgroundColor: "#ef4444",
  },

  /* Messenger-like styles */
  messengerBackdrop: {
    flex: 1,
    backgroundColor: "#07111F",
    overflow: "hidden",
  },
  minimizeCallButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 24,
    left: 18,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.72)",
    zIndex: 100,
    elevation: 100,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  miniCallLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: Platform.OS === "ios" ? 56 : 18,
    paddingHorizontal: 12,
  },
  miniCallWidget: {
    width: "100%",
    maxWidth: 460,
    minHeight: 68,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
    shadowColor: "#020617",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  miniAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.86)",
  },
  miniAvatarText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  miniCallCopy: { flex: 1, minWidth: 0 },
  miniCallName: { fontSize: 14, fontWeight: "800" },
  miniStatusRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  miniCallStatus: { fontSize: 11, fontWeight: "600" },
  miniActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#334155",
  },
  miniActionButtonMuted: { backgroundColor: "#F59E0B" },
  miniEndButton: { backgroundColor: "#EF4444" },
  backgroundGlowTop: {
    position: "absolute",
    width: 440,
    height: 440,
    borderRadius: 220,
    top: -210,
    right: -170,
    backgroundColor: "rgba(37,99,235,0.14)",
  },
  backgroundGlowBottom: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 260,
    bottom: -330,
    left: -230,
    backgroundColor: "rgba(29,78,216,0.12)",
  },
  webVideoContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#000",
  },
  nativeVideoContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#000",
  },
  remoteVideoFull: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
    overflow: "hidden",
    zIndex: 1,
  },
  nativeLocalPreview: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 112,
    height: 184,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    overflow: "hidden",
    backgroundColor: "#1e293b",
    zIndex: 30,
    elevation: 30,
  },
  nativeLocalVideoFill: {
    width: "100%",
    height: "100%",
  },
  webLocalVideoFill: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#1E293B",
  },
  localPreviewPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E293B",
  },
  previewDragHandle: {
    position: "absolute",
    top: 7,
    alignSelf: "center",
    minWidth: 30,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  videoPlaceholderOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    gap: 14,
  },
  videoWaitingAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  videoWaitingAvatarText: { color: "#fff", fontSize: 32, fontWeight: "800" },
  connectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  connectionDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#22C55E" },
  videoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  videoPlaceholderText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
  messengerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 52 : 28,
    paddingBottom: Platform.OS === "ios" ? 44 : 30,
  },
  callEyebrow: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginBottom: 7,
  },
  callTypeText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 7,
  },
  avatarPulseOuter: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.14)",
  },
  avatarPulseActive: {
    borderColor: "rgba(37,99,235,0.42)",
    backgroundColor: "rgba(37,99,235,0.05)",
  },
  avatarPulseMiddle: {
    width: 164,
    height: 164,
    borderRadius: 82,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.55)",
  },
  largeAvatar: {
    width: 142,
    height: 142,
    borderRadius: 71,
    backgroundColor: "#172337",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOpacity: 0.34,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  largeAvatarText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 48,
  },
  messengerName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 7,
  },
  messengerStatus: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    fontWeight: "600",
  },
  mediaNoticeText: {
    color: "#fecaca",
    backgroundColor: "rgba(127, 29, 29, 0.45)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginBottom: 24,
    marginHorizontal: 16,
  },
  messengerActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 84,
    marginTop: 26,
    width: "100%",
  },
  labeledAction: { alignItems: "center", minWidth: 52, gap: 8 },
  actionLabel: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  ringingControls: { width: "100%", alignItems: "center", gap: 22 },
  compactControlRow: { flexDirection: "row", justifyContent: "center", gap: 64 },
  secondaryCallButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#172337",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  cancelCallPill: {
    width: "100%",
    maxWidth: 310,
    minHeight: 54,
    borderRadius: 28,
    backgroundColor: "#EF3340",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#EF4444",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  cancelCallText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  messengerDeclineBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  messengerAcceptBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
});
