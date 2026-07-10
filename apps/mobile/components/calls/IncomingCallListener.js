import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { arrayUnion, collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";

import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import {
  acceptConversationCall,
  createCallHistoryMessage,
  updateConversationCallStatus,
} from "../utilities/FirebaseFunctions";
import useTencentWebCall from "./useTencentWebCall";

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
  const [activeCall, setActiveCall] = useState(null);
  const [conversationTitle, setConversationTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState("");
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [cameraType, setCameraType] = useState("front");
  const [localMediaStream, setLocalMediaStream] = useState(null);
  const [remoteMediaStream, setRemoteMediaStream] = useState(null);
  const [rtcNotice, setRtcNotice] = useState("");
  const callMapRef = useRef(new Map());
  const prevCallStatusRef = useRef(new Map());
  const activeCallRef = useRef(null);
  const timeoutRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const rtcCallIdRef = useRef(null);
  const processedCandidatesRef = useRef(new Set());
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
  } = useTencentWebCall({
    activeCall,
    userId: user?.uid,
    isMuted,
    isSpeakerOn,
    isCameraOn,
    cameraType,
  });

  const cleanupWebRtc = () => {
    const peer = peerConnectionRef.current;
    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
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
        if (peer.connectionState === "connected") {
          setRtcNotice("");
          updateConversationCallStatus({ callId: call.id, status: "connected" }).catch(
            (error) => console.warn("Unable to mark call connected", error),
          );
        } else if (["failed", "disconnected"].includes(peer.connectionState)) {
          setRtcNotice("Media connection was interrupted.");
        }
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
        })
        .sort((left, right) => callActivityMillis(right) - callActivityMillis(left));

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

  useEffect(() => () => cleanupWebRtc(), []);

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
  const showIncomingControls = isIncoming && status === "ringing";
  const title = isIncoming ? "Incoming Call" : isCallerRinging ? "Calling Atlas Staff..." : status === "connected" ? "Ongoing Call" : isActiveCall ? "Connecting..." : "Call";
  const statusLabel = isIncoming ? "Waiting for answer" : isCallerRinging ? "Ringing..." : status === "connected" ? "Connected" : isActiveCall ? "Connecting media..." : "Connected";

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

          {Platform.OS === "web" && activeCall?.type === "video" ? (
            <View style={styles.videoStage}>
              {React.createElement("div", {
                id: remoteViewId,
                style: styles.remoteVideo,
              })}
              {!remoteVideoReady ? (
                <View style={styles.remoteVideoPlaceholder}>
                  <FontAwesome5 name="video" size={30} color="#94a3b8" />
                  <Text style={styles.remoteVideoText}>
                    {isCallerRinging ? "Waiting for an answer..." : "Connecting video..."}
                  </Text>
                </View>
              ) : null}
              {React.createElement("div", {
                id: localViewId,
                style: {
                  ...styles.localVideo,
                  opacity: localVideoReady ? 1 : 0,
                  overflow: "hidden",
                },
              })}
            </View>
          ) : null}

          {Platform.OS !== "web" && activeCall?.type === "video" ? (
            <View style={styles.videoStage}>
              {remoteUserId && remoteVideoReady && NativeRemoteVideoView ? (
                <NativeRemoteVideoView
                  userId={remoteUserId}
                  streamType={nativeVideoStreamType}
                  style={styles.remoteVideo}
                />
              ) : (
                <View style={styles.remoteVideoPlaceholder}>
                  <FontAwesome5 name="video" size={30} color="#94a3b8" />
                  <Text style={styles.remoteVideoText}>Connecting video...</Text>
                </View>
              )}
              {localVideoReady && NativeLocalVideoView ? (
                <NativeLocalVideoView
                  frontCamera={cameraType !== "back"}
                  style={styles.localVideo}
                />
              ) : null}
            </View>
          ) : null}

          {mediaNotice ? <Text style={styles.rtcNotice}>{mediaNotice}</Text> : null}

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
                    <>
                      <FontAwesome5 name="phone-slash" size={22} color="#fff" />
                      <Text style={styles.declineText}>Decline</Text>
                    </>
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
                    <>
                      <FontAwesome5 name="phone-alt" size={22} color="#fff" />
                      <Text style={styles.acceptText}>Accept</Text>
                    </>
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
                    <>
                      <FontAwesome5 name="phone-slash" size={22} color="#fff" />
                      <Text style={styles.declineText}>Cancel</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : isActiveCall ? (
              <View style={styles.activeStateBox}>
                <Text style={styles.activeStateText}>{status === "connected" ? "The call is now active." : "The audio and video are being connected."}</Text>
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
                <View style={styles.controlRowCentered}>
                  <TouchableOpacity
                    style={[styles.controlButton, styles.endCallButton]}
                    onPress={handleEndCall}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <FontAwesome5 name="phone-slash" size={20} color="#fff" />
                    )}
                    <Text style={styles.controlLabel}>End</Text>
                  </TouchableOpacity>
                </View>
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
});
