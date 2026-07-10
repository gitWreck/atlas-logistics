"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { updateConversationCallStatus } from "@/app/utility/FirebaseFunctions";

const MEDIA_STATUSES = ["accepted", "connecting", "connected", "ongoing"];
const TERMINAL_STATUSES = ["declined", "missed", "cancelled", "ended"];

export default function useWebRtcCall({
  activeCall,
  userId,
  isMuted,
  isSpeakerOn,
  isCameraOn,
  cameraType,
}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [mediaNotice, setMediaNotice] = useState("");
  const peerRef = useRef(null);
  const callIdRef = useRef(null);
  const processedCandidatesRef = useRef(new Set());

  const cleanup = useCallback(() => {
    const peer = peerRef.current;
    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
    }
    peerRef.current = null;
    callIdRef.current = null;
    processedCandidatesRef.current.clear();
    setLocalStream((current) => {
      current?.getTracks?.().forEach((track) => track.stop());
      return null;
    });
    setRemoteStream(null);
    setMediaNotice("");
  }, []);

  const syncRemoteSignals = useCallback(async (call, peer, isCaller) => {
    const remoteDescription = isCaller ? call?.rtcAnswer : call?.rtcOffer;
    if (remoteDescription?.sdp && !peer.currentRemoteDescription) {
      await peer.setRemoteDescription(remoteDescription);
    }
    if (!peer.currentRemoteDescription) return;

    const remoteUserId = isCaller ? call.receiverId : call.callerId;
    for (const candidate of call?.rtcCandidates?.[remoteUserId] || []) {
      const key = JSON.stringify(candidate);
      if (processedCandidatesRef.current.has(key)) continue;
      try {
        await peer.addIceCandidate(candidate);
        processedCandidatesRef.current.add(key);
      } catch (error) {
        console.warn("Unable to add remote ICE candidate", error);
      }
    }
  }, []);

  const publishAnswer = useCallback(async (call, peer) => {
    if (
      !call?.rtcOffer?.sdp ||
      call?.rtcAnswer?.sdp ||
      !peer.currentRemoteDescription ||
      peer.currentLocalDescription
    ) {
      return;
    }
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await updateDoc(doc(db, "calls", call.id), {
      rtcAnswer: { type: answer.type, sdp: answer.sdp },
      rtcAnswerBy: userId,
      updatedAt: serverTimestamp(),
    });
  }, [userId]);

  const ensureConnection = useCallback(async (call) => {
    if (
      !call?.id ||
      !userId ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof RTCPeerConnection === "undefined"
    ) {
      setMediaNotice("This browser does not support audio and video calls.");
      return;
    }

    const isCaller = String(call.callerId || "") === userId;
    const existingPeer = peerRef.current;
    if (existingPeer && callIdRef.current === call.id) {
      await syncRemoteSignals(call, existingPeer, isCaller);
      if (!isCaller) await publishAnswer(call, existingPeer);
      return;
    }
    if (!existingPeer && callIdRef.current === call.id) return;

    cleanup();
    callIdRef.current = call.id;

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
        setMediaNotice("Camera is being used by another app. Voice will continue without video.");
      }
      if (callIdRef.current !== call.id) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setLocalStream(stream);
      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      peerRef.current = peer;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (event) => {
        if (event.streams?.[0]) setRemoteStream(event.streams[0]);
      };
      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        const candidate = event.candidate.toJSON
          ? event.candidate.toJSON()
          : JSON.parse(JSON.stringify(event.candidate));
        updateDoc(doc(db, "calls", call.id), {
          [`rtcCandidates.${userId}`]: arrayUnion(candidate),
          updatedAt: serverTimestamp(),
        }).catch((error) => console.warn("Unable to publish ICE candidate", error));
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          setMediaNotice("");
          updateConversationCallStatus({ callId: call.id, status: "connected" }).catch(
            (error) => console.warn("Unable to mark call connected", error),
          );
        } else if (["failed", "disconnected"].includes(peer.connectionState)) {
          setMediaNotice("Media connection was interrupted.");
        }
      };

      if (isCaller) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await updateDoc(doc(db, "calls", call.id), {
          rtcOffer: { type: offer.type, sdp: offer.sdp },
          rtcOfferBy: userId,
          updatedAt: serverTimestamp(),
        });
      } else if (call.rtcOffer?.sdp) {
        await peer.setRemoteDescription(call.rtcOffer);
        await publishAnswer(call, peer);
      } else {
        setMediaNotice("Waiting for the caller's media connection...");
      }

      await syncRemoteSignals(call, peer, isCaller);
    } catch (error) {
      console.error("Browser call media failed:", error);
      const permissionDenied = ["NotAllowedError", "PermissionDeniedError"].includes(error?.name);
      setMediaNotice(
        permissionDenied
          ? "Allow microphone and camera access in your browser to continue the call."
          : "Microphone or camera could not be started.",
      );
    }
  }, [cameraType, cleanup, publishAnswer, syncRemoteSignals, userId]);

  useEffect(() => {
    const status = String(activeCall?.status || "").trim().toLowerCase();
    const callerRinging = activeCall?.callerId === userId && status === "ringing";
    if (activeCall?.id && (callerRinging || MEDIA_STATUSES.includes(status))) {
      void ensureConnection(activeCall);
    } else if (!activeCall || TERMINAL_STATUSES.includes(status)) {
      cleanup();
    }
  }, [
    activeCall?.id,
    activeCall?.status,
    activeCall?.rtcOffer?.sdp,
    activeCall?.rtcAnswer?.sdp,
    activeCall?.rtcCandidates,
    cleanup,
    ensureConnection,
    userId,
  ]);

  useEffect(() => {
    localStream?.getAudioTracks?.().forEach((track) => {
      track.enabled = !isMuted;
    });
    localStream?.getVideoTracks?.().forEach((track) => {
      track.enabled = isCameraOn;
    });
  }, [isCameraOn, isMuted, localStream]);

  useEffect(() => {
    const videoTrack = localStream?.getVideoTracks?.()[0];
    videoTrack?.applyConstraints?.({ facingMode: cameraType }).catch(() => {});
  }, [cameraType, localStream]);

  useEffect(() => cleanup, [cleanup]);

  return { localStream, remoteStream, mediaNotice, remoteMuted: !isSpeakerOn };
}
