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
} from "@fortawesome/free-solid-svg-icons";

import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import {
  acceptConversationCall,
  declineConversationCall,
  sendChatMessage,
  updateConversationCallStatus,
} from "@/app/utility/FirebaseFunctions";

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
  const callMapRef = useRef(new Map());
  const prevCallStatusRef = useRef(new Map());
  const activeCallRef = useRef(null);
  const timeoutRef = useRef(null);
  const noticeTimerRef = useRef(null);

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
        });

      const preferred = entries.find((call) => {
        const status = String(call?.status || "").trim().toLowerCase();
        return ["connected", "ongoing", "accepted", "connecting"].includes(status);
      });
      const ringingCall = entries.find((call) => String(call?.callerId || "").trim() === uid && String(call?.status || "").trim().toLowerCase() === "ringing") || entries.find((call) => String(call?.receiverId || "").trim() === uid && String(call?.status || "").trim().toLowerCase() === "ringing");
      const nextCall = preferred || ringingCall || null;

      setActiveCall((current) => {
        if (!nextCall) {
          if (current?.id) {
            setConversationTitle("");
          }
          return null;
        }

        if (current?.id === nextCall.id) {
          return nextCall;
        }

        return nextCall;
      });
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
      const currentActiveCallId = activeCallRef.current?.id;

      docs.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const callId = docSnap.id;
        nextIds.add(callId);

        const nextStatus = String(data.status || "").trim().toLowerCase();
        const prevStatus = prevCallStatusRef.current.get(callId);
        const terminalNotice = getTerminalNotice(nextStatus);

        if (prevStatus !== undefined && prevStatus !== nextStatus && terminalNotice && currentActiveCallId === callId) {
          showNotice(terminalNotice);
          closeDialog();
        }

        prevCallStatusRef.current.set(callId, nextStatus);
        callMapRef.current.set(callId, { id: callId, ...data });
      });

      Array.from(prevCallStatusRef.current.keys()).forEach((callId) => {
        if (!nextIds.has(callId)) {
          prevCallStatusRef.current.delete(callId);
        }
      });

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

  const logCallEvent = async ({ conversationId, text }) => {
    if (!conversationId) return;
    try {
      await sendChatMessage({ conversationId, text });
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
        await logCallEvent({ conversationId: activeCall?.conversationId, text: `📞 ${formatCallType(activeCall?.type)} Call\nMissed Call` });
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
        status: "ongoing",
        startedAt: serverTimestamp(),
        answeredAt: serverTimestamp(),
        acceptedBy: user?.uid || null,
        updatedAt: serverTimestamp(),
      });
      await logCallEvent({ conversationId: activeCall.conversationId, text: `📞 ${formatCallType(activeCall?.type)} Call\nOngoing Call` });
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
      await logCallEvent({ conversationId: activeCall.conversationId, text: `📞 ${formatCallType(activeCall?.type)} Call\nMissed Call` });
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
      await logCallEvent({ conversationId: activeCall.conversationId, text: `📞 ${formatCallType(activeCall?.type)} Call\nCall Ended` });
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
      await logCallEvent({ conversationId: activeCall.conversationId, text: `📞 ${formatCallType(activeCall?.type)} Call\nCall Cancelled` });
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
  const isConnectingState = Boolean(activeCall && ["accepted", "connecting", "connected"].includes(status));
  const showIncomingControls = isIncoming && status === "ringing";
  const title = isIncoming ? "Incoming Call" : isCallerRinging ? "Calling Atlas Staff..." : isConnectingState ? "Connecting..." : isActiveCall ? "Ongoing Call" : "Call";
  const statusLabel = isIncoming ? "Waiting for answer" : isCallerRinging ? "Ringing..." : isConnectingState ? "Connecting..." : isActiveCall ? "Ongoing Call" : "Connected";

  if (!mounted || (!activeCall && !notice)) return null;

  const renderCallSurface = () => {
    if (!activeCall) return null;

    if (showIncomingControls) {
      return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">{title}</p>
                <h3 className="mt-1 text-xl font-bold text-white">{activeCall?.callerName || "Atlas support"}</h3>
              </div>
              <button
                type="button"
                onClick={() => handleDecline("declined")}
                className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close call"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="px-6 py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
                {activeCall?.type === "video" ? (
                  <FontAwesomeIcon icon={faVideo} size="2x" />
                ) : (
                  <FontAwesomeIcon icon={faPhone} size="2x" />
                )}
              </div>

              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-lg font-semibold text-white">
                {getInitials(activeCall?.callerName || "Atlas")}
              </div>

              <p className="text-lg font-semibold text-white">{activeCall?.callerName || "Atlas support"}</p>
              <p className="mt-1 text-sm text-slate-400">{activeCall?.callerRole || "Support"}</p>
              <p className="mt-3 text-sm text-slate-400">{formatConversationInfo(activeCall, conversationTitle)}</p>

              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-400">
                <FontAwesomeIcon icon={faCircle} className={isCallerRinging ? "text-amber-400" : "text-emerald-500"} />
                <span>{statusLabel}</span>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => handleDecline("declined")}
                  disabled={processing}
                  className="flex-1 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : "Decline"}
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={processing}
                  className="flex-1 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : "Accept"}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isCallerRinging) {
      return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="border-b border-slate-800 px-6 py-4 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">{title}</p>
              <h3 className="mt-1 text-xl font-bold text-white">{activeCall?.callerName || "Atlas support"}</h3>
            </div>
            <div className="px-6 py-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-lg font-semibold text-white">
                {getInitials(activeCall?.callerName || "Atlas")}
              </div>
              <p className="text-sm text-slate-400">{formatConversationInfo(activeCall, conversationTitle)}</p>
              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-400">
                <FontAwesomeIcon icon={faCircle} className="text-amber-400" />
                <span>{statusLabel}</span>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => handleCancelCall()}
                  disabled={processing}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : "Cancel call"}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isActiveCall) {
      return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="border-b border-slate-800 px-6 py-4 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">{title}</p>
              <h3 className="mt-1 text-xl font-bold text-white">{activeCall?.callerName || "Atlas support"}</h3>
            </div>
            <div className="px-6 py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
                {activeCall?.type === "video" ? (
                  <FontAwesomeIcon icon={faVideo} size="2x" />
                ) : (
                  <FontAwesomeIcon icon={faPhone} size="2x" />
                )}
              </div>
              <p className="text-sm text-slate-400">{formatConversationInfo(activeCall, conversationTitle)}</p>
              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-400">
                <FontAwesomeIcon icon={faCircle} className={status === "ongoing" ? "text-emerald-500" : "text-amber-400"} />
                <span>{statusLabel}</span>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${isMuted ? "border-rose-400 bg-rose-500/10 text-rose-200" : "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"}`}
                  >
                    <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} className="mr-2" />
                    {isMuted ? "Muted" : "Mute"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleSpeaker}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${isSpeakerOn ? "border-emerald-400 bg-emerald-500/10 text-emerald-200" : "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"}`}
                  >
                    <FontAwesomeIcon icon={isSpeakerOn ? faVolumeUp : faVolumeMute} className="mr-2" />
                    {isSpeakerOn ? "Speaker" : "Earpiece"}
                  </button>
                  {activeCall?.type === "video" ? (
                    <button
                      type="button"
                      onClick={toggleCamera}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${isCameraOn ? "border-sky-400 bg-sky-500/10 text-sky-200" : "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"}`}
                    >
                      <FontAwesomeIcon icon={isCameraOn ? faVideo : faVideoSlash} className="mr-2" />
                      {isCameraOn ? "Camera" : "Camera Off"}
                    </button>
                  ) : null}
                </div>
                {activeCall?.type === "video" ? (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={switchCamera}
                      className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
                    >
                      <FontAwesomeIcon icon={faRepeat} className="mr-2" />
                      Switch camera
                    </button>
                  </div>
                ) : null}
                <div className="rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">
                  Call duration: {formatDuration(callDurationSeconds)}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => handleEndCall()}
                    disabled={processing}
                    className="w-full rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {processing ? <FontAwesomeIcon icon={faSpinner} spin /> : "End Call"}
                  </button>
                </div>
              </div>
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
