"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faSpinner,
  faVideo,
  faVideoSlash,
  faMicrophone,
  faMicrophoneSlash,
  faVolumeUp,
  faVolumeMute,
  faPhoneSlash,
  faLock,
  faRepeat,
  faMinus,
  faExpand,
  faCompress,
  faXmark,
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
  const callDurationRef = useRef(0);
  const videoStageRef = useRef(null);
  const previewDragRef = useRef(null);
  const callWindowDragRef = useRef(null);
  const [localPreviewPosition, setLocalPreviewPosition] = useState(null);
  const [callWindowPosition, setCallWindowPosition] = useState({ left: null, top: 72 });
  const [callWindowMode, setCallWindowMode] = useState("normal");
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

      // Inspect the previous active call before syncActiveCall removes terminal calls.
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
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
  }, [loading, user?.uid]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    setLocalPreviewPosition(null);
    previewDragRef.current = null;
    setCallWindowMode("normal");
  }, [activeCall?.id]);

  const handlePreviewPointerDown = (event) => {
    const stage = videoStageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const previewRect = event.currentTarget.getBoundingClientRect();
    previewDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: previewRect.left - stageRect.left,
      top: previewRect.top - stageRect.top,
      width: previewRect.width,
      height: previewRect.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const handlePreviewPointerMove = (event) => {
    const drag = previewDragRef.current;
    const stage = videoStageRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stage) return;
    const stageRect = stage.getBoundingClientRect();
    const nextLeft = Math.min(
      Math.max(0, drag.left + event.clientX - drag.startX),
      Math.max(0, stageRect.width - drag.width),
    );
    const nextTop = Math.min(
      Math.max(0, drag.top + event.clientY - drag.startY),
      Math.max(0, stageRect.height - drag.height),
    );
    setLocalPreviewPosition({ left: nextLeft, top: nextTop });
  };

  const handlePreviewPointerUp = (event) => {
    if (previewDragRef.current?.pointerId !== event.pointerId) return;
    previewDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleCallWindowPointerDown = (event) => {
    if (callWindowMode !== "normal") return;
    const windowElement = event.currentTarget.parentElement;
    if (!windowElement) return;
    const rect = windowElement.getBoundingClientRect();
    callWindowDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const handleCallWindowPointerMove = (event) => {
    const drag = callWindowDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setCallWindowPosition({
      left: Math.min(Math.max(8, event.clientX - drag.offsetX), Math.max(8, window.innerWidth - drag.width - 8)),
      top: Math.min(Math.max(8, event.clientY - drag.offsetY), Math.max(8, window.innerHeight - drag.height - 8)),
    });
  };

  const handleCallWindowPointerUp = (event) => {
    if (callWindowDragRef.current?.pointerId !== event.pointerId) return;
    callWindowDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  useEffect(() => {
    callDurationRef.current = callDurationSeconds;
  }, [callDurationSeconds]);

  useEffect(() => {
    const endCurrentCall = (reason) => {
      const call = activeCallRef.current;
      const currentStatus = String(call?.status || "").toLowerCase();
      if (!call?.id || !["ringing", "accepted", "connecting", "connected", "ongoing"].includes(currentStatus)) return;
      updateConversationCallStatus({
        callId: call.id,
        status: currentStatus === "ringing" ? "cancelled" : "ended",
        duration: callDurationRef.current,
        endReason: reason,
      }).catch(() => {});
    };
    const handlePageHide = () => endCurrentCall("browser_closed");
    const handleOffline = () => endCurrentCall("network_lost");
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
      await updateConversationCallStatus({ callId: activeCall.id, status: "ended", duration: callDurationSeconds, endReason: "hangup" });
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
  const displayCallName = String(activeCall?.callerId || "") === String(user?.uid || "")
    ? conversationTitle || "Atlas staff"
    : activeCall?.callerName || conversationTitle || "Atlas support";
  const title = isIncoming ? "Incoming Call" : isCallerRinging ? "Calling Atlas Staff..." : status === "connected" ? "Ongoing Call" : isActiveCall ? "Connecting..." : "Call";
  const statusLabel = isIncoming ? "Waiting for answer" : isCallerRinging ? "Ringing..." : status === "connected" ? "Connected" : isActiveCall ? "Connecting media..." : "Connected";

  if (!mounted || (!activeCall && !notice)) return null;

  const handleFloatingWindowClose = () => {
    if (showIncomingControls) void handleDecline("declined");
    else if (isCallerRinging) void handleCancelCall();
    else if (isActiveCall) void handleEndCall();
    else closeDialog();
  };

  const renderCallSurface = () => {
    if (!activeCall) return null;

    // Facebook-like layout: Large remote video as main content
    if (activeCall.type === "video") {
      if (showIncomingControls) {
        // Incoming call - show avatar and accept/decline buttons
        return (
          <div className="flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 text-slate-950 dark:from-[#07111f] dark:via-[#0b1b31] dark:to-[#07111f] dark:text-white">
            <div className="flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-8 px-6 py-12">
              <div className="flex h-36 w-36 items-center justify-center rounded-full border-[3px] border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-700 text-5xl font-bold text-white shadow-[0_0_0_14px_rgba(37,99,235,0.10),0_22px_60px_rgba(37,99,235,0.30)]">
                {getInitials(activeCall?.callerName || "Atlas")}
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-extrabold">{activeCall?.callerName || "Atlas support"}</h2>
                <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">Incoming Video Call</p>
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
          <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 text-slate-950 dark:from-[#07111f] dark:via-[#0b1b31] dark:to-[#07111f] dark:text-white">
            <div className="absolute left-5 top-5 z-10 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-sm font-bold shadow-lg">
                {getInitials(displayCallName)}
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{displayCallName}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-white/75">
                  <FontAwesomeIcon icon={faLock} className="text-[9px]" />
                  End-to-end encrypted
                </p>
              </div>
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center pb-20">
              <div className="flex h-36 w-36 items-center justify-center rounded-full border-[3px] border-blue-600 bg-gradient-to-br from-blue-500 to-violet-600 text-4xl font-bold text-white shadow-[0_0_0_14px_rgba(37,99,235,0.10),0_22px_60px_rgba(37,99,235,0.30)]">
                {getInitials(displayCallName)}
              </div>
              <h2 className="mt-4 text-2xl font-bold">{displayCallName}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-white/70">Connecting video...</p>
            </div>

            <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-5">
              <button type="button" onClick={toggleSpeaker} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30" title="Speaker">
                <FontAwesomeIcon icon={isSpeakerOn ? faVolumeUp : faVolumeMute} />
              </button>
              <button type="button" onClick={toggleCamera} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30" title="Camera">
                <FontAwesomeIcon icon={isCameraOn ? faVideo : faVideoSlash} />
              </button>
              <button type="button" onClick={toggleMute} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30" title="Microphone">
                <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} />
              </button>
              <button type="button" onClick={() => handleCancelCall()} disabled={processing} className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500 disabled:opacity-60" title="Cancel call">
                {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhone} className="rotate-[135deg]" />}
              </button>
            </div>
          </div>
        );
      }

      // Active call - Facebook-like layout with large video and floating local preview
      if (isActiveCall) {
        return (
          <div className="relative h-full w-full overflow-hidden bg-black text-white">
            {/* Header with participant name and status */}
            <div className="absolute inset-x-0 top-0 z-30 flex flex-col items-center bg-gradient-to-b from-black/70 to-transparent px-6 pb-12 pt-5 text-center">
              <p className="rounded-full bg-black/45 px-3 py-1 text-xs font-bold backdrop-blur-md">{formatDuration(callDurationSeconds)}</p>
              <h3 className="mt-2 text-lg font-extrabold leading-tight text-white">{displayCallName}</h3>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-white/90">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {status === "connected" ? "In Call" : statusLabel}
              </div>
            </div>

            {/* Main video area */}
            <div ref={videoStageRef} className="absolute inset-0 overflow-hidden bg-black">
              <div
                id={remoteViewId}
                data-call-orientation="portrait"
                className="absolute inset-0 h-full w-full overflow-hidden bg-black [&_*]:!h-full [&_*]:!w-full [&_video]:!object-cover"
              />
              
              {/* Local video preview - bottom right corner */}
              <div
                id={localViewId}
                data-call-orientation="portrait"
                onPointerDown={handlePreviewPointerDown}
                onPointerMove={handlePreviewPointerMove}
                onPointerUp={handlePreviewPointerUp}
                onPointerCancel={handlePreviewPointerUp}
                className={`absolute h-40 touch-none select-none overflow-hidden rounded-xl border-2 border-white shadow-2xl transition-opacity [&_*]:!pointer-events-none [&_*]:!h-full [&_*]:!w-full [&_video]:!object-cover ${localPreviewPosition ? "cursor-grabbing" : "cursor-grab"} ${localVideoReady ? "opacity-100" : "pointer-events-none opacity-0"}`}
                style={{
                  aspectRatio: "9 / 16",
                  ...(localPreviewPosition
                    ? { left: localPreviewPosition.left, top: localPreviewPosition.top }
                    : { right: 20, bottom: 116 }),
                }}
              />

              {/* Placeholder when video not ready */}
              {!remoteVideoReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#07111f] via-[#0b1b31] to-[#07111f] text-white">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full border-[3px] border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-700 text-4xl font-bold shadow-[0_0_0_14px_rgba(37,99,235,0.10),0_22px_60px_rgba(37,99,235,0.30)]">{getInitials(displayCallName)}</div>
                  <p className="text-xl font-extrabold">{displayCallName}</p>
                  <span className="flex items-center gap-2 text-sm text-slate-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Connecting video...</span>
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
            <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-start justify-center gap-4 rounded-[28px] border border-white/10 bg-slate-950/70 px-5 py-3 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-col items-center gap-1.5"><span className="text-[10px] font-medium text-white/80">Mute</span>
              <button
                type="button"
                onClick={toggleMute}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isMuted ? "bg-white text-black" : "bg-white/20 text-white hover:bg-white/30"}`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} />
              </button>
              </div>
              <div className="flex flex-col items-center gap-1.5"><span className="text-[10px] font-medium text-white/80">Speaker</span>
              <button
                type="button"
                onClick={toggleSpeaker}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                title={isSpeakerOn ? "Speaker on" : "Speaker off"}
              >
                <FontAwesomeIcon icon={isSpeakerOn ? faVolumeUp : faVolumeMute} />
              </button>
              </div>
              <div className="flex flex-col items-center gap-1.5"><span className="text-[10px] font-medium text-white/80">Camera</span>
              <button
                type="button"
                onClick={toggleCamera}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isCameraOn ? "bg-white/20 text-white hover:bg-white/30" : "bg-white text-black hover:bg-gray-200"}`}
                title={isCameraOn ? "Camera on" : "Camera off"}
              >
                <FontAwesomeIcon icon={isCameraOn ? faVideo : faVideoSlash} />
              </button>
              </div>
              <div className="flex flex-col items-center gap-1.5"><span className="text-[10px] font-medium text-white/80">Switch</span><button type="button" onClick={switchCamera} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30" title="Switch camera"><FontAwesomeIcon icon={faRepeat} /></button></div>
              <div className="flex flex-col items-center gap-1.5"><span className="text-[10px] font-medium text-white/80">End Call</span>
              <button
                type="button"
                onClick={() => handleEndCall()}
                disabled={processing}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-500 disabled:opacity-60"
                title="End call"
              >
                {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhone} className="rotate-[135deg]" />}
              </button>
              </div>
            </div>
          </div>
        );
      }
    }

    // Voice calls - simplified layout with avatar and controls
    if (showIncomingControls) {
      return (
        <div className="flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 text-slate-950 dark:from-[#07111f] dark:via-[#0b1b31] dark:to-[#07111f] dark:text-white">
          <div className="flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-8 px-6 py-12">
            <div className="flex h-36 w-36 items-center justify-center rounded-full border-[3px] border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-700 text-5xl font-bold text-white shadow-[0_0_0_14px_rgba(37,99,235,0.10),0_22px_60px_rgba(37,99,235,0.30)]">
              {getInitials(activeCall?.callerName || "Atlas")}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-extrabold">{activeCall?.callerName || "Atlas support"}</h2>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">Incoming Voice Call</p>
            </div>
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => handleDecline("declined")}
                disabled={processing}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition hover:bg-rose-500 disabled:opacity-60"
              >
                {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhoneSlash} size="lg" />}
              </button>
              <span className="text-xs font-semibold">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleAccept}
                disabled={processing}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhone} size="lg" />}
              </button>
              <span className="text-xs font-semibold">Accept</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isCallerRinging) {
      return (
        <div className="flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 text-slate-950 dark:from-[#07111f] dark:via-[#0b1b31] dark:to-[#07111f] dark:text-white">
          <div className="flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-8 px-6 py-12">
            <div className="flex h-36 w-36 items-center justify-center rounded-full border-[3px] border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-700 text-5xl font-bold text-white shadow-[0_0_0_14px_rgba(37,99,235,0.10),0_22px_60px_rgba(37,99,235,0.30)]">
              {getInitials(activeCall?.callerName || "Atlas")}
            </div>
            <div className="text-center">
              <p className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-300">Calling...</p>
              <h2 className="text-2xl font-extrabold">{displayCallName}</h2>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">Voice Call · Ringing</p>
            </div>
            <div className="flex w-full flex-col items-center gap-6">
              <div className="flex gap-14">
                <div className="flex flex-col items-center gap-2"><button type="button" onClick={toggleMute} className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg dark:bg-slate-800 dark:text-white"><FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} /></button><span className="text-xs font-semibold">Mute</span></div>
                <div className="flex flex-col items-center gap-2"><button type="button" onClick={toggleSpeaker} className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg dark:bg-slate-800 dark:text-white"><FontAwesomeIcon icon={isSpeakerOn ? faVolumeUp : faVolumeMute} /></button><span className="text-xs font-semibold">Speaker</span></div>
              </div>
              <button type="button" onClick={() => handleCancelCall()} disabled={processing} className="flex h-14 w-full max-w-xs items-center justify-center gap-3 rounded-full bg-rose-600 font-bold text-white shadow-lg transition hover:bg-rose-500 disabled:opacity-60">{processing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPhoneSlash} />}Cancel Call</button>
            </div>
          </div>
        </div>
      );
    }

    if (isActiveCall) {
      return (
        <div className="flex h-full w-full flex-col bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 text-slate-950 dark:from-[#07111f] dark:via-[#0b1b31] dark:to-[#07111f] dark:text-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-3 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 text-sm font-semibold text-white">
                {getInitials(activeCall?.callerName || "Atlas")}
              </div>
              <div>
                <h3 className="font-semibold">{displayCallName}</h3>
                <p className="flex items-center gap-1.5 text-xs text-emerald-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />In Call</p>
              </div>
            </div>
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-200">
              {formatDuration(callDurationSeconds)}
            </div>
          </div>

          {/* Main content - centered with controls */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-4 py-8">
            <div className="flex h-40 w-40 items-center justify-center rounded-full border-[3px] border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-700 text-5xl font-bold text-white shadow-[0_0_0_14px_rgba(37,99,235,0.10),0_22px_60px_rgba(37,99,235,0.30)]">
              {getInitials(displayCallName)}
            </div>

            {mediaNotice && (
              <div className="rounded-lg bg-rose-500/20 px-4 py-2 text-sm text-rose-200">
                {mediaNotice}
              </div>
            )}

            {/* Bottom control bar - Facebook-like compact */}
            <div className="flex items-center justify-center gap-6 rounded-[28px] border border-slate-200 bg-white/75 px-6 py-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60">
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
      {activeCall ? (
        <section
          aria-label={`${formatCallType(activeCall.type)} call with ${displayCallName}`}
          className={`fixed z-[99999] overflow-hidden border border-slate-300/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.38)] transition-[width,height,top,left] duration-200 dark:border-white/10 dark:bg-[#07111f] ${callWindowMode === "maximized" ? "inset-3 rounded-2xl" : "rounded-2xl"} ${callWindowMode === "normal" ? "resize" : ""}`}
          style={
            callWindowMode === "maximized"
              ? undefined
              : callWindowMode === "minimized"
                ? { right: 20, bottom: 20, width: 320, height: 48 }
                : {
                    left: callWindowPosition.left ?? undefined,
                    right: callWindowPosition.left == null ? 24 : undefined,
                    top: callWindowPosition.top,
                    width: activeCall.type === "video" ? 460 : 400,
                    height: activeCall.type === "video" ? 700 : 600,
                    minWidth: 340,
                    minHeight: 420,
                    maxWidth: "calc(100vw - 16px)",
                    maxHeight: "calc(100vh - 16px)",
                  }
          }
        >
          <header
            onPointerDown={handleCallWindowPointerDown}
            onPointerMove={handleCallWindowPointerMove}
            onPointerUp={handleCallWindowPointerUp}
            onPointerCancel={handleCallWindowPointerUp}
            className="flex h-12 touch-none select-none items-center justify-between border-b border-slate-200 bg-white/95 px-3 text-slate-900 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 dark:text-white"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isActiveCall ? "bg-emerald-500" : "animate-pulse bg-blue-500"}`} />
              <span className="truncate text-sm font-bold">{displayCallName}</span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{formatCallType(activeCall.type)} call</span>
            </div>
            <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => setCallWindowMode((current) => current === "minimized" ? "normal" : "minimized")} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10" aria-label={callWindowMode === "minimized" ? "Restore call window" : "Minimize call"}><FontAwesomeIcon icon={callWindowMode === "minimized" ? faExpand : faMinus} /></button>
              <button type="button" onClick={() => setCallWindowMode((current) => current === "maximized" ? "normal" : "maximized")} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10" aria-label={callWindowMode === "maximized" ? "Restore call window" : "Maximize call window"}><FontAwesomeIcon icon={callWindowMode === "maximized" ? faCompress : faExpand} /></button>
              <button type="button" onClick={handleFloatingWindowClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15" aria-label="Close and end call"><FontAwesomeIcon icon={faXmark} /></button>
            </div>
          </header>
          {callWindowMode !== "minimized" ? <div className="min-h-0" style={{ height: "calc(100% - 3rem)" }}>{renderCallSurface()}</div> : null}
        </section>
      ) : null}
    </>,
    document.body,
  );
}
