"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  generateTencentUserSig,
  updateConversationCallStatus,
} from "@/app/utility/FirebaseFunctions";

const MEDIA_STATUSES = ["ringing", "accepted", "connecting", "connected", "ongoing"];

function safeDomId(prefix, value) {
  return `${prefix}-${String(value || "call").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

async function waitForDomView(viewId, shouldCancel, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (!shouldCancel() && Date.now() - startedAt < timeoutMs) {
    const element = typeof document !== "undefined" ? document.getElementById(viewId) : null;
    if (element?.isConnected) return element;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

export default function useWebRtcCall({
  activeCall,
  userId,
  isMuted,
  isSpeakerOn,
  isCameraOn,
  cameraType,
}) {
  const [localVideoReady, setLocalVideoReady] = useState(false);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);
  const [mediaNotice, setMediaNotice] = useState("");
  const [rtcReadyVersion, setRtcReadyVersion] = useState(0);
  const [remoteVideoRequestVersion, setRemoteVideoRequestVersion] = useState(0);
  const trtcRef = useRef(null);
  const callIdRef = useRef(null);
  const startingCallIdRef = useRef(null);
  const remoteUserIdRef = useRef(null);
  const localVideoStartedRef = useRef(false);
  const pendingRemoteVideoRef = useRef(null);
  const isMutedRef = useRef(isMuted);
  const isCameraOnRef = useRef(isCameraOn);

  const localViewId = useMemo(() => safeDomId("atlas-local", activeCall?.id), [activeCall?.id]);
  const remoteViewId = useMemo(() => safeDomId("atlas-remote", activeCall?.id), [activeCall?.id]);
  const mediaStatus = String(activeCall?.status || "").toLowerCase();
  const shouldInitializeMedia =
    MEDIA_STATUSES.includes(mediaStatus) &&
    (mediaStatus !== "ringing" || activeCall?.callerId === userId);

  useEffect(() => {
    if (!activeCall?.id || !userId || !shouldInitializeMedia) return undefined;
    if (callIdRef.current === activeCall.id || startingCallIdRef.current === activeCall.id) return undefined;

    let cancelled = false;
    startingCallIdRef.current = activeCall.id;

    const start = async () => {
      try {
        const [{ default: TRTC }, signatureResult] = await Promise.all([
          import("trtc-sdk-v5"),
          generateTencentUserSig({}),
        ]);
        if (cancelled) return;

        const signature = signatureResult?.data || signatureResult;
        const roomId = String(activeCall.rtcRoomId || activeCall.roomId || "").trim();
        if (!signature?.sdkAppId || !signature?.userSig || !roomId) {
          throw new Error("Tencent RTC is not configured for this call.");
        }

        const trtc = TRTC.create();
        trtcRef.current = trtc;
        callIdRef.current = activeCall.id;

        trtc.on(TRTC.EVENT.REMOTE_USER_ENTER, ({ userId: remoteUserId }) => {
          remoteUserIdRef.current = remoteUserId;
          console.log("[WebRTC] connection:", "TRTC room connected");
          console.log("[WebRTC] ICE:", "managed by Tencent TRTC");
          setMediaNotice("");
          updateConversationCallStatus({ callId: activeCall.id, status: "connected" }).catch(() => {});
        });
        trtc.on(TRTC.EVENT.REMOTE_AUDIO_AVAILABLE, ({ userId: remoteUserId }) => {
          remoteUserIdRef.current = remoteUserId;
          setMediaNotice("");
        });
        trtc.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, ({ userId: remoteUserId, streamType }) => {
          remoteUserIdRef.current = remoteUserId;
          pendingRemoteVideoRef.current = { userId: remoteUserId, streamType };
          setRemoteVideoRequestVersion((version) => version + 1);
        });
        trtc.on(TRTC.EVENT.REMOTE_VIDEO_UNAVAILABLE, () => {
          pendingRemoteVideoRef.current = null;
          setRemoteVideoReady(false);
        });
        trtc.on(TRTC.EVENT.AUTOPLAY_FAILED, () => {
          setMediaNotice("Tap the call screen once to enable remote audio.");
        });
        trtc.on(TRTC.EVENT.ERROR, (error) => {
          console.log("[WebRTC] connection:", "TRTC error");
          console.log("[WebRTC] ICE:", "managed by Tencent TRTC");
          console.error("TRTC call error", error);
          setMediaNotice(error?.message || "The call media connection failed.");
        });

        await trtc.enterRoom({
          sdkAppId: Number(signature.sdkAppId),
          userId: signature.userId || userId,
          userSig: signature.userSig,
          strRoomId: roomId,
          scene: TRTC.TYPE.SCENE_RTC,
          enableAutoPlayDialog: true,
        });
        await trtc.startLocalAudio();
        await trtc.updateLocalAudio?.({ mute: isMutedRef.current });
        setRtcReadyVersion((version) => version + 1);
      } catch (error) {
        console.error("Tencent browser call failed", error);
        setMediaNotice(error?.message || "Camera or microphone could not be started.");
      } finally {
        startingCallIdRef.current = null;
      }
    };

    void start();
    return () => {
      cancelled = true;
    };
  }, [activeCall?.id, activeCall?.type, activeCall?.rtcRoomId, activeCall?.roomId, shouldInitializeMedia, userId]);

  useEffect(() => {
    const trtc = trtcRef.current;
    if (!trtc || activeCall?.type !== "video" || localVideoStartedRef.current) return undefined;

    let cancelled = false;
    const startLocalVideo = async () => {
      console.log("[Video] Starting local video");
      console.log("[Video] Call status:", mediaStatus);
      const localView = await waitForDomView(
        localViewId,
        () => cancelled || trtcRef.current !== trtc,
      );
      console.log("[Video] Local element:", localView);
      if (!localView || cancelled || trtcRef.current !== trtc) return;

      try {
        const stream = await trtc.startLocalVideo({
          view: localView,
          option: { useFrontCamera: cameraType !== "environment" },
        });
        console.log("[Video] Local stream:", stream);
        await trtc.updateLocalVideo?.({ mute: !isCameraOnRef.current });
        localVideoStartedRef.current = true;
        setLocalVideoReady(true);
        setMediaNotice("");
      } catch (error) {
        console.error("TRTC local video failed to start", error);
        setMediaNotice(error?.message || "Camera could not be started.");
      }
    };

    void startLocalVideo();
    return () => { cancelled = true; };
  }, [activeCall?.id, activeCall?.status, activeCall?.type, cameraType, localViewId, rtcReadyVersion]);

  useEffect(() => {
    const trtc = trtcRef.current;
    const request = pendingRemoteVideoRef.current;
    if (!trtc || !request || activeCall?.type !== "video") return undefined;

    let cancelled = false;
    const startRemoteVideo = async () => {
      console.log("[Video] Starting remote video");
      console.log("[Video] Call status:", mediaStatus);
      const remoteView = await waitForDomView(
        remoteViewId,
        () => cancelled || trtcRef.current !== trtc,
      );
      console.log("[Video] Remote element:", remoteView);
      if (!remoteView || cancelled || trtcRef.current !== trtc) return;

      try {
        await trtc.startRemoteVideo({
          userId: request.userId,
          streamType: request.streamType,
          view: remoteView,
        });
        setRemoteVideoReady(true);
        setMediaNotice("");
      } catch (error) {
        console.error("TRTC remote video failed", error);
        setMediaNotice("Remote video could not be played.");
      }
    };

    void startRemoteVideo();
    return () => { cancelled = true; };
  }, [activeCall?.id, activeCall?.status, activeCall?.type, remoteVideoRequestVersion, remoteViewId, rtcReadyVersion]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    trtcRef.current?.updateLocalAudio?.({ mute: isMuted }).catch(() => {});
  }, [isMuted]);

  useEffect(() => {
    isCameraOnRef.current = isCameraOn;
    trtcRef.current?.updateLocalVideo?.({ mute: !isCameraOn }).catch(() => {});
  }, [isCameraOn]);

  useEffect(() => {
    const remoteUserId = remoteUserIdRef.current;
    if (remoteUserId) trtcRef.current?.muteRemoteAudio?.(remoteUserId, !isSpeakerOn).catch(() => {});
  }, [isSpeakerOn]);

  useEffect(() => {
    trtcRef.current?.updateLocalVideo?.({
      option: { useFrontCamera: cameraType !== "environment" },
    }).catch(() => {});
  }, [cameraType]);

  useEffect(() => {
    const status = String(activeCall?.status || "").toLowerCase();
    if (activeCall && !["declined", "missed", "cancelled", "ended"].includes(status)) return;
    const trtc = trtcRef.current;
    trtcRef.current = null;
    callIdRef.current = null;
    remoteUserIdRef.current = null;
    localVideoStartedRef.current = false;
    pendingRemoteVideoRef.current = null;
    setLocalVideoReady(false);
    setRemoteVideoReady(false);
    if (trtc) {
      Promise.allSettled([trtc.stopLocalVideo(), trtc.stopLocalAudio(), trtc.exitRoom()])
        .finally(() => trtc.destroy());
    }
  }, [activeCall?.id, activeCall?.status]);

  useEffect(() => () => {
    const trtc = trtcRef.current;
    if (trtc) {
      trtc.stopLocalVideo().catch(() => {});
      trtc.stopLocalAudio().catch(() => {});
      trtc.exitRoom().catch(() => {}).finally(() => trtc.destroy());
    }
  }, []);

  return {
    localViewId,
    remoteViewId,
    localVideoReady,
    remoteVideoReady,
    mediaNotice,
  };
}
