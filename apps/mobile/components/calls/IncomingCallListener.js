import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";

import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import {
  acceptConversationCall,
  createCallHistoryMessage,
  updateConversationCallStatus,
} from "../utilities/FirebaseFunctions";

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

export default function IncomingCallListener() {
  const { user, loading, isReady } = useAuth();
  const [activeCall, setActiveCall] = useState(null);
  const [conversationTitle, setConversationTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState("");
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [cameraType, setCameraType] = useState("front");
  const callMapRef = useRef(new Map());
  const prevCallStatusRef = useRef(new Map());
  const activeCallRef = useRef(null);
  const timeoutRef = useRef(null);
  const noticeTimerRef = useRef(null);

  useEffect(() => {
    if (!user?.uid || loading || !isReady) {
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

      const preferred = entries.find((call) => ["connected", "ongoing", "accepted", "connecting"].includes(String(call?.status || "").trim().toLowerCase()));
      const ringingCall = entries.find((call) => String(call?.callerId || "").trim() === uid && String(call?.status || "").trim().toLowerCase() === "ringing") || entries.find((call) => String(call?.receiverId || "").trim() === uid && String(call?.status || "").trim().toLowerCase() === "ringing");
      const nextCall = preferred || ringingCall || null;
      setActiveCall(nextCall);
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
    };
  }, [user?.uid, loading, isReady]);

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
    setActiveCall(null);
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
    const isActive = Boolean(activeCall && ["accepted", "connecting", "connected", "ongoing"].includes(status));

    if (!isActive) {
      setCallDurationSeconds(0);
      return undefined;
    }

    const initialSeconds = activeCall?.startedAt?.toMillis ? Math.max(0, Math.floor((Date.now() - activeCall.startedAt.toMillis()) / 1000)) : 0;
    setCallDurationSeconds(initialSeconds);

    const intervalId = setInterval(() => {
      setCallDurationSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeCall?.id, activeCall?.status, activeCall?.startedAt]);

  const toggleMute = () => setIsMuted((current) => !current);
  const toggleSpeaker = () => setIsSpeakerOn((current) => !current);
  const toggleCamera = () => setIsCameraOn((current) => !current);
  const switchCamera = () => setCameraType((current) => (current === "front" ? "back" : "front"));

  const showNotice = (message) => {
    setNotice(message);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => {
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
      source: "mobile",
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
            source: "mobile",
            callId,
          });
          return;
        }

        const latestCall = callSnap.data() || {};
        const latestStatus = String(latestCall.status || "").trim().toLowerCase();
        console.info("[call-timeout] current Firestore status", {
          source: "mobile",
          callId,
          status: latestStatus,
        });

        if (latestStatus !== "ringing") {
          console.info("[call-timeout] skipping update because the call is no longer ringing", {
            source: "mobile",
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
        status: "ongoing",
        startedAt: serverTimestamp(),
        answeredAt: serverTimestamp(),
        acceptedBy: user?.uid || null,
        updatedAt: serverTimestamp(),
      });
      await logCallEvent({ conversationId: activeCall.conversationId, callId: activeCall.id, text: `📞 ${activeCall?.type === "video" ? "Video" : "Voice"} Call\nOngoing Call` });
    } catch (error) {
      console.error("Incoming call accept failed:", error);
      showNotice("This call can no longer be accepted.");
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
      await updateConversationCallStatus({ callId: activeCall.id, status: "ended" });
      await updateDoc(doc(db, "calls", activeCall.id), {
        endedReason: "completed",
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logCallEvent({ conversationId: activeCall.conversationId, callId: activeCall.id, text: `📞 ${activeCall?.type === "video" ? "Video" : "Voice"} Call\nCall Ended` });
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
  const isConnectingState = Boolean(activeCall && ["accepted", "connecting", "connected"].includes(status));
  const showIncomingControls = isIncoming && status === "ringing";
  const title = isIncoming ? "Incoming Call" : isCallerRinging ? "Calling Atlas Staff..." : isConnectingState ? "Connecting..." : isActiveCall ? "Ongoing Call" : "Call";
  const statusLabel = isIncoming ? "Waiting for answer" : isCallerRinging ? "Ringing..." : isConnectingState ? "Connecting..." : isActiveCall ? "Ongoing Call" : "Connected";

  if (!activeCall && !notice) {
    return null;
  }

  return (
    <>
      {notice ? (
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
      {activeCall ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => handleDecline("declined")}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <FontAwesome5
              name={activeCall?.type === "video" ? "video" : "phone-alt"}
              size={24}
              color="#fff"
            />
          </View>

          <View style={styles.avatarBadge}>
            <Text style={styles.avatarText}>{getInitials(activeCall?.callerName || "Atlas")}</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.caller}>{activeCall?.callerName || "Atlas support"}</Text>
          <Text style={styles.role}>{activeCall?.callerRole || "Support"}</Text>
          <Text style={styles.meta}>
            {conversationTitle || (activeCall?.conversationId ? `Conversation ${activeCall.conversationId}` : "Conversation call")}
          </Text>

          <Text style={styles.statusText}>{statusLabel}</Text>

          <View style={styles.actions}>
            {showIncomingControls ? (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.declineButton]}
                  onPress={() => handleDecline("declined")}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.declineText}>Decline</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.acceptButton]}
                  onPress={handleAccept}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.acceptText}>Accept</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : isCallerRinging ? (
              <View style={styles.callerStateBox}>
                <Text style={styles.callerStateText}>Calling Atlas Staff...</Text>
                <Text style={styles.callerStateSubtext}>Ringing...</Text>
                <TouchableOpacity
                  style={[styles.button, styles.declineButton]}
                  onPress={() => handleDecline("cancelled")}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.declineText}>Cancel call</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : isActiveCall ? (
              <View style={styles.activeStateBox}>
                <Text style={styles.activeStateText}>{status === "ongoing" ? "The call is now active." : "The call is being connected."}</Text>
                <Text style={styles.timerText}>Duration: {formatDuration(callDurationSeconds)}</Text>
                <View style={styles.controlRow}>
                  <TouchableOpacity
                    style={[styles.controlButton, isMuted ? styles.controlButtonActive : null]}
                    onPress={toggleMute}
                  >
                    <FontAwesome5
                      name={isMuted ? "microphone-slash" : "microphone"}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.controlLabel}>{isMuted ? "Muted" : "Mute"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.controlButton, isSpeakerOn ? styles.controlButtonActive : null]}
                    onPress={toggleSpeaker}
                  >
                    <FontAwesome5
                      name={isSpeakerOn ? "volume-up" : "volume-mute"}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.controlLabel}>{isSpeakerOn ? "Speaker" : "Earpiece"}</Text>
                  </TouchableOpacity>
                  {activeCall?.type === "video" ? (
                    <TouchableOpacity
                      style={[styles.controlButton, isCameraOn ? styles.controlButtonActive : null]}
                      onPress={toggleCamera}
                    >
                      <FontAwesome5
                        name={isCameraOn ? "video" : "video-slash"}
                        size={18}
                        color="#fff"
                      />
                      <Text style={styles.controlLabel}>{isCameraOn ? "Camera" : "Video Off"}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {activeCall?.type === "video" ? (
                  <View style={styles.controlRow}>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={switchCamera}
                    >
                      <FontAwesome5
                        name="sync-alt"
                        size={18}
                        color="#fff"
                      />
                      <Text style={styles.controlLabel}>Switch {cameraType}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(2, 8, 23, 0.72)",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    backgroundColor: "#ffffff",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f8cff",
    marginBottom: 14,
  },
  avatarBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    marginBottom: 10,
  },
  avatarText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#07111e",
    marginBottom: 6,
    textAlign: "center",
  },
  caller: {
    fontSize: 16,
    color: "#334155",
    textAlign: "center",
    marginBottom: 2,
  },
  role: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 6,
    textAlign: "center",
  },
  meta: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 18,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  statusText: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 8,
    marginBottom: 12,
    textAlign: "center",
  },
  activeStateBox: {
    width: "100%",
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  activeStateText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  button: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
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
  },
  acceptText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  timerText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },
  controlRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 12,
  },
  controlButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  controlButtonActive: {
    backgroundColor: "#0f8cff",
  },
  controlLabel: {
    color: "#ffffff",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "700",
    textAlign: "center",
  },
});
