"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircle,
  faPhone,
  faSpinner,
  faTimes,
  faVideo,
  faVideoSlash,
  faMicrophone,
  faMicrophoneSlash,
  faVolumeUp,
  faVolumeMute,
  faRepeat,
  faPhoneSlash,
} from "@fortawesome/free-solid-svg-icons";

import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import {
  acceptConversationCall,
  createCallHistoryMessage,
  declineConversationCall,
  updateConversationCallStatus,
} from "@/app/utility/FirebaseFunctions";
import useWebRtcCall from "./useWebRtcCall";

function formatCallType(callType) {
  const value = String(callType || "voice").toLowerCase();
  return value === "video" ? "Video" : "Voice";
}

function getInitials(name = "") {
  return String(name || "Atlas")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

function formatConversationInfo(call, conversationTitle) {
  const parts = [];
  if (conversationTitle) parts.push(conversationTitle);
  else if (call?.conversationId) parts.push(`Conversation ${call.conversationId}`);
  if (call?.shipmentId) parts.push(`Shipment ${call.shipmentId}`);
  return parts.join(" • ");
}

function callActivityMillis(call = {}) {
  const timestamp = call.updatedAt || call.createdAt || call.startedAt;
  if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
  const parsed = new Date(timestamp || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function IncomingCallListener() {
  const { user, loading } = useAuth();
  const [activeCall, setActiveCall] = useState(null);
  const [conversationTitle, setConversationTitle] = useState("");
  const [processing, setProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notice, setNotice] = useState("");
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [cameraType, setCameraType] = useState("user");
  const callMapRef = useRef(new Map());
  const prevCallStatusRef = useRef(new Map());
  const activeCallRef = useRef(null);
  const timeoutRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const {
    localViewId,
    remoteViewId,
    localVideoReady,
    remoteVideoReady,
    mediaNotice,
  } = useWebRtcCall({
    activeCall,
    userId: user?.uid,
    isMuted,
    isSpeakerOn,
    isCameraOn,
    cameraType,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user?.uid || loading) {
      callMapRef.current.clear();
      prevCallStatusRef.current.clear();
      activeCallRef.current = null;
      setActiveCall(null);
      setConversationTitle("");
      setNotice("");
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
      return undefined;
    }

    const uid = user.uid;
    const receiverQuery = query(collection(db, "calls"), where("receiverId", "==", uid));
    const callerQuery = query(collection(db, "calls"), where("callerId", "==", uid));

    const syncActiveCall = () => {
      const entries = [...callMapRef.current.values()]
        .filter((call) => String(call?.receiverId || "").trim() === uid || String(call?.callerId || "").trim() === uid)
        .filter((call) => {
          const status = String(call?.status || "").trim().toLowerCase();
          return ["ringing", "accepted", "connecting", "connected", "ongoing", "declined", "missed", "cancelled", "ended"].includes(status);
        })
        .sort((left, right) => callActivityMillis(right) - callActivityMillis(left));

      const preferred = entries.find((call) => {
        const status = String(call?.status || "").trim().toLowerCase();
        return ["connected", "ongoing", "accepted", "connecting"].includes(status);
      });
      const ringingCall = entries.find((call) => String(call?.callerId || "").trim() === uid && String(call?.status || "").trim().toLowerCase() === "ringing") || entries.find((call) => String(call?.receiverId || "").trim() === uid && String(call?.status || "").trim().toLowerCase() === "ringing");
      const nextCall = preferred || ringingCall || null;

      // update both state and ref immediately so snapshot handlers can react synchronously
      if (!nextCall) {
        if (activeCallRef.current?.id) setConversationTitle("");
        activeCallRef.current = null;
        setActiveCall(null);
      } else {
        activeCallRef.current = nextCall;
        setActiveCall(nextCall);
      }
    };

    const getTerminalNotice = (status) => {
      switch (status) {
        case "declined":
          return "Staff declined the call.";
        case "missed":
          return "No answer from staff.";
        case "cancelled":
          return "The call was cancelled.";
        case "ended":
          return "The call has ended.";
        default:
          return null;
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

      // update active call synchronously so we can evaluate terminal transitions reliably
      syncActiveCall();

      // If the newly-determined active call reached a terminal status during this snapshot, tear down now
      const currentActiveCallId = activeCallRef.current?.id;
      if (currentActiveCallId) {
        const prev = prevStatusMap.get(currentActiveCallId);
        const current = String(callMapRef.current.get(currentActiveCallId)?.status || "").trim().toLowerCase();
        if (prev !== current && ["declined", "missed", "cancelled", "ended"].includes(current)) {
          const terminalNotice = (function (s) {
            switch (s) {
              case "declined":
                return "Staff declined the call.";
              case "missed":
                return "No answer from staff.";
              case "cancelled":
                return "The call was cancelled.";
              case "ended":
                return "The call has ended.";
              default:
                return null;
            }
          })(current);
          if (terminalNotice) showNotice(terminalNotice);
          try { cleanupWebRtc(); } catch (err) { console.warn("cleanupWebRtc error on terminal status:", err); }
          closeDialog();
        }
      }
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
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
  }, [loading, user?.uid]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Also listen directly to the active call document so terminal updates tear down immediately
  useEffect(() => {
    if (!activeCall?.id) return undefined;
    const callRef = doc(db, "calls", activeCall.id);
    const unsub = onSnapshot(callRef, (snap) => {
      const data = snap.data() || {};
      const status = String(data.status || "").trim().toLowerCase();
      if (["declined", "missed", "cancelled", "ended"].includes(status)) {
        const terminalNotice = (function (s) {
          switch (s) {
            case "declined":
              return "Staff declined the call.";
            case "missed":
              return "No answer from staff.";
            case "cancelled":
              return "The call was cancelled.";
            case "ended":
              return "The call has ended.";
            default:
              return null;
          }
        })(status);
        if (terminalNotice) showNotice(terminalNotice);
        try { cleanupWebRtc(); } catch (err) { console.warn("cleanupWebRtc error on doc listener:", err); }
        closeDialog();
      }
    }, (err) => console.warn("active call doc listener error:", err));

    return () => unsub();
  }, [activeCall?.id]);

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

    timeoutRef.current = window.setTimeout(() => {
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
    // ensure any active WebRTC peer and media tracks are cleaned up on close
    try {
      cleanupWebRtc();
    } catch (e) {
      console.warn("cleanupWebRtc failed:", e);
    }
    setActiveCall(null);
    setConversationTitle("");
    setCallDurationSeconds(0);
    setIsMuted(false);
    setIsSpeakerOn(true);
    setIsCameraOn(true);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const status = String(activeCall?.status || "").trim().toLowerCase();
    const isActive = Boolean(activeCall && ["accepted", "connecting", "connected", "ongoing"].includes(status));

    if (!isActive) {
      setCallDurationSeconds(0);
      return undefined;
    }

    const initialSeconds = activeCall?.startedAt?.toMillis ? Math.max(0, Math.floor((Date.now() - activeCall.startedAt.toMillis()) / 1000)) : 0;
    setCallDurationSeconds(initialSeconds);

    const intervalId = window.setInterval(() => {
      setCallDurationSeconds((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeCall?.id, activeCall?.status, activeCall?.startedAt]);

  const toggleMute = () => setIsMuted((current) => !current);
  const toggleSpeaker = () => setIsSpeakerOn((current) => !current);
  const toggleCamera = () => setIsCameraOn((current) => !current);
  const switchCamera = () => {
    setIsCameraOn(true);
    setCameraType((current) => (current === "user" ? "environment" : "user"));
  };

  const showNotice = (message) => {
    setNotice(message);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice("");
      noticeTimerRef.current = null;
    }, 4000);
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
      source: "web",
      callId,
      status: normalizedStatus,
      receiverId: user?.uid || null,
    });

    if (!callId) return;

    try {
      let timedOut = false;
      const callRef = doc(db, "calls", callId);

      await runTransaction(db, async (tx) => {
        const callSnap = await tx.get(callRef);
        if (!callSnap.exists) {
          console.info("[call-timeout] skipped because the call document no longer exists", {
            source: "web",
            callId,
          });
          return;
        }

        const latestCall = callSnap.data() || {};
        const latestStatus = String(latestCall.status || "").trim().toLowerCase();
        console.info("[call-timeout] current Firestore status", {
          source: "web",
          callId,
          status: latestStatus,
        });

        if (latestStatus !== "ringing") {
          console.info("[call-timeout] skipping update because the call is no longer ringing", {
            source: "web",
            callId,
            status: latestStatus,
          });
          return;
        }

        tx.update(callRef, {
          status: "missed",
          endedReason: "timeout",
          endedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        timedOut = true;
      });

      if (timedOut) {
        await logCallEvent({ conversationId: activeCall?.conversationId, callId: activeCall?.id, text: `📞 ${formatCallType(activeCall?.type)} Call\nMissed Call` });
        closeDialog();
      }
    } catch (error) {
      console.error("Incoming call timeout failed:", error);
      closeDialog();
    }
  };

  const handleAccept = async () => {
    if (!activeCall?.id || processing) return;

    setProcessing(true);
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
      await logCallEvent({ conversationId: activeCall.conversationId, callId: activeCall.id, text: `📞 ${formatCallType(activeCall?.type)} Call\nOngoing Call` });
    } catch (error) {
      console.error("Failed to accept incoming call:", error);
      if (error?.code === "functions/failed-precondition") {
        console.warn("The call was already moved out of the ringing state.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async (reason = "declined") => {
    if (!activeCall?.id || processing) {
      closeDialog();
      return;
    }

    setProcessing(true);
    try {
      await declineConversationCall({ callId: activeCall.id, status: "declined" });
      await updateDoc(doc(db, "calls", activeCall.id), {
        endedReason: reason,
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logCallEvent({ conversationId: activeCall.conversationId, callId: activeCall.id, text: `📞 ${formatCallType(activeCall?.type)} Call\nMissed Call` });
      closeDialog();
    } catch (error) {
      console.error("Failed to decline incoming call:", error);
      closeDialog();
    } finally {
      setProcessing(false);
    }
  };

  const handleEndCall = async () => {
    if (!activeCall?.id || processing) return;

    setProcessing(true);
    try {
      await updateConversationCallStatus({ callId: activeCall.id, status: "ended" });
      await updateDoc(doc(db, "calls", activeCall.id), {
        endedReason: "completed",
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logCallEvent({ conversationId: activeCall.conversationId, callId: activeCall.id, text: `📞 ${formatCallType(activeCall?.type)} Call\nCall Ended` });
      closeDialog();
    } catch (error) {
      console.error("Failed to end call:", error);
      closeDialog();
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelCall = async () => {
    if (!activeCall?.id || processing) return;

    setProcessing(true);
    try {
      await updateConversationCallStatus({ callId: activeCall.id, status: "cancelled" });
      await updateDoc(doc(db, "calls", activeCall.id), {
        endedReason: "cancelled",
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logCallEvent({ conversationId: activeCall.conversationId, callId: activeCall.id, text: `📞 ${formatCallType(activeCall?.type)} Call\nCall Cancelled` });
      closeDialog();
    } catch (error) {
      console.error("Failed to cancel call:", error);
      closeDialog();
    } finally {
      setProcessing(false);
    }
  };


  const status = String(activeCall?.status || "").trim().toLowerCase();
  const isIncoming = Boolean(activeCall && String(activeCall?.receiverId || "").trim() === user?.uid && status === "ringing");
  const isCallerRinging = Boolean(activeCall && String(activeCall?.callerId || "").trim() === user?.uid && status === "ringing");
  const isActiveCall = Boolean(activeCall && ["accepted", "connecting", "connected", "ongoing"].includes(status));
  const showIncomingControls = isIncoming && status === "ringing";
  const title = isIncoming ? "Incoming Call" : isCallerRinging ? "Calling Atlas Staff..." : status === "connected" ? "Ongoing Call" : isActiveCall ? "Connecting..." : "Call";
  const statusLabel = isIncoming ? "Waiting for answer" : isCallerRinging ? "Ringing..." : status === "connected" ? "Connected" : isActiveCall ? "Connecting media..." : "Connected";

  if (!mounted || (!activeCall && !notice)) return null;

  const renderCallSurface = () => {
    if (!activeCall) return null;

    // Facebook-like layout: Large remote video as main content
    if (activeCall.type === "video") {
      if (showIncomingControls) {
        // Incoming call - show avatar and accept/decline buttons
        return (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black">
            <div className="flex w-full flex-col items-center justify-center gap-8 px-4 py-12">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-700 text-4xl font-bold text-white shadow-lg">
                {getInitials(activeCall?.callerName || "Atlas")}
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">{activeCall?.callerName || "Atlas support"}</h2>
                <p className="mt-1 text-sm text-slate-400">{statusLabel}</p>
              </div>
              <div className="flex gap-8">
                <button
                  type="button"
                  onClick={() => handleDecline("declined")}
                  disabled={processing}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition hover:bg-rose-500 disabled:opacity-60"
                >
                  {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhoneSlash} size="lg" />}
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={processing}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhone} size="lg" />}
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Caller ringing - show avatar with cancel option
      if (isCallerRinging) {
        return (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black">
            <div className="flex w-full flex-col items-center justify-center gap-8 px-4 py-12">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-700 text-4xl font-bold text-white shadow-lg">
                {getInitials(activeCall?.callerName || "Atlas")}
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">{activeCall?.callerName || "Atlas support"}</h2>
                <p className="mt-1 text-sm text-slate-400">{statusLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => handleCancelCall()}
                disabled={processing}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition hover:bg-rose-500 disabled:opacity-60"
              >
                {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhoneSlash} size="lg" />}
              </button>
            </div>
          </div>
        );
      }

      // Active call - Facebook-like layout with large video and floating local preview
      if (isActiveCall) {
        return (
          <div className="fixed inset-0 z-[99999] flex flex-col bg-black">
            {/* Header with participant name and status */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">
                  {getInitials(activeCall?.callerName || "Atlas")}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{activeCall?.callerName || "Atlas support"}</h3>
                  <p className="text-xs text-slate-400">{statusLabel}</p>
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-300">
                {formatDuration(callDurationSeconds)}
              </div>
            </div>

            {/* Main video area */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
              <div id={remoteViewId} className="absolute inset-0 h-full w-full" />
              
              {/* Local video preview - bottom right corner */}
              <div
                id={localViewId}
                className={`absolute bottom-6 right-6 h-40 w-32 overflow-hidden rounded-lg border-2 border-white shadow-xl ${localVideoReady ? "opacity-100" : "opacity-0"}`}
              />

              {/* Placeholder when video not ready */}
              {!remoteVideoReady && (
                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                  <FontAwesomeIcon icon={faVideo} size="3x" />
                  <span className="text-sm">Connecting video...</span>
                </div>
              )}

              {/* Media error notice */}
              {mediaNotice && (
                <div className="absolute top-4 left-4 max-w-xs rounded-lg bg-rose-500/20 px-4 py-2 text-sm text-rose-200">
                  {mediaNotice}
                </div>
              )}
            </div>

            {/* Bottom control bar - compact and centered */}
            <div className="flex items-center justify-center gap-6 border-t border-slate-800 bg-black/80 px-6 py-4 backdrop-blur-sm">
              <button
                type="button"
                onClick={toggleMute}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isMuted ? "bg-white text-black" : "bg-slate-700 text-white hover:bg-slate-600"}`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} />
              </button>
              <button
                type="button"
                onClick={toggleSpeaker}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isSpeakerOn ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-slate-700 text-white hover:bg-slate-600"}`}
                title={isSpeakerOn ? "Speaker on" : "Speaker off"}
              >
                <FontAwesomeIcon icon={isSpeakerOn ? faVolumeUp : faVolumeMute} />
              </button>
              <button
                type="button"
                onClick={toggleCamera}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isCameraOn ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-white text-black hover:bg-gray-200"}`}
                title={isCameraOn ? "Camera on" : "Camera off"}
              >
                <FontAwesomeIcon icon={isCameraOn ? faVideo : faVideoSlash} />
              </button>
              {activeCall?.type === "video" ? (
                <button
                  type="button"
                  onClick={switchCamera}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-white transition hover:bg-slate-600"
                  title="Switch camera"
                >
                  <FontAwesomeIcon icon={faRepeat} size="sm" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => handleEndCall()}
                disabled={processing}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white transition hover:bg-rose-500 disabled:opacity-60"
                title="End call"
              >
                {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhoneSlash} />}
              </button>
            </div>
          </div>
        );
      }
    }

    // Voice calls - simplified layout with avatar and controls
    if (showIncomingControls) {
      return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black">
          <div className="flex w-full flex-col items-center justify-center gap-8 px-4 py-12">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-700 text-4xl font-bold text-white shadow-lg">
              {getInitials(activeCall?.callerName || "Atlas")}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">{activeCall?.callerName || "Atlas support"}</h2>
              <p className="mt-1 text-sm text-slate-400">{statusLabel}</p>
            </div>
            <div className="flex gap-8">
              <button
                type="button"
                onClick={() => handleDecline("declined")}
                disabled={processing}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition hover:bg-rose-500 disabled:opacity-60"
              >
                {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhoneSlash} size="lg" />}
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={processing}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhone} size="lg" />}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isCallerRinging) {
      return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black">
          <div className="flex w-full flex-col items-center justify-center gap-8 px-4 py-12">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-700 text-4xl font-bold text-white shadow-lg">
              {getInitials(activeCall?.callerName || "Atlas")}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">{activeCall?.callerName || "Atlas support"}</h2>
              <p className="mt-1 text-sm text-slate-400">{statusLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => handleCancelCall()}
              disabled={processing}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition hover:bg-rose-500 disabled:opacity-60"
            >
              {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhoneSlash} size="lg" />}
            </button>
          </div>
        </div>
      );
    }

    if (isActiveCall) {
      return (
        <div className="fixed inset-0 z-[99999] flex flex-col bg-black">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">
                {getInitials(activeCall?.callerName || "Atlas")}
              </div>
              <div>
                <h3 className="font-semibold text-white">{activeCall?.callerName || "Atlas support"}</h3>
                <p className="text-xs text-slate-400">{statusLabel}</p>
              </div>
            </div>
            <div className="text-sm font-semibold text-slate-300">
              {formatDuration(callDurationSeconds)}
            </div>
          </div>

          {/* Main content - centered with controls */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-4 py-8">
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-5xl font-bold text-white shadow-lg">
              {getInitials(activeCall?.callerName || "Atlas")}
            </div>

            {mediaNotice && (
              <div className="rounded-lg bg-rose-500/20 px-4 py-2 text-sm text-rose-200">
                {mediaNotice}
              </div>
            )}

            {/* Bottom control bar - Facebook-like compact */}
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={toggleMute}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isMuted ? "bg-white text-black" : "bg-slate-700 text-white hover:bg-slate-600"}`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} />
              </button>
              <button
                type="button"
                onClick={toggleSpeaker}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isSpeakerOn ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-slate-700 text-white hover:bg-slate-600"}`}
                title={isSpeakerOn ? "Speaker on" : "Speaker off"}
              >
                <FontAwesomeIcon icon={isSpeakerOn ? faVolumeUp : faVolumeMute} />
              </button>
              <button
                type="button"
                onClick={() => handleEndCall()}
                disabled={processing}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white transition hover:bg-rose-500 disabled:opacity-60"
                title="End call"
              >
                {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhoneSlash} />}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return createPortal(
    <>
      {notice ? (
        <div className="fixed bottom-6 left-1/2 z-[100000] -translate-x-1/2 rounded-full border border-slate-700 bg-slate-900/95 px-4 py-2 text-sm font-medium text-slate-100 shadow-xl">
          {notice}
        </div>
      ) : null}
      {renderCallSurface()}
    </>,
    document.body,
  );
}
