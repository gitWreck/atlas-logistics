import { useEffect, useMemo, useRef, useState } from "react";

import {
  generateTencentUserSig,
  updateConversationCallStatus,
} from "../utilities/FirebaseFunctions";

const MEDIA_STATUSES = ["ringing", "accepted", "connecting", "connected", "ongoing"];

function safeDomId(prefix, value) {
  return `${prefix}-${String(value || "call").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export default function useTencentWebCall({
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
  const trtcRef = useRef(null);
  const callIdRef = useRef(null);
  const remoteUserIdRef = useRef(null);
  const startingCallIdRef = useRef(null);

  const localViewId = useMemo(() => safeDomId("atlas-local", activeCall?.id), [activeCall?.id]);
  const remoteViewId = useMemo(() => safeDomId("atlas-remote", activeCall?.id), [activeCall?.id]);

  useEffect(() => {
    const status = String(activeCall?.status || "").toLowerCase();
    const shouldStart =
      MEDIA_STATUSES.includes(status) &&
      (status !== "ringing" || activeCall?.callerId === userId);
    if (!activeCall?.id || !userId || !shouldStart) return undefined;
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
          setMediaNotice("");
          updateConversationCallStatus({ callId: activeCall.id, status: "connected" }).catch(() => {});
        });
        trtc.on(TRTC.EVENT.REMOTE_AUDIO_AVAILABLE, ({ userId: remoteUserId }) => {
          remoteUserIdRef.current = remoteUserId;
          setMediaNotice("");
        });
        trtc.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, async ({ userId: remoteUserId, streamType }) => {
          remoteUserIdRef.current = remoteUserId;
          setRemoteVideoReady(true);
          await new Promise((resolve) => setTimeout(resolve, 0));
          try {
            const remoteEl = typeof document !== "undefined" ? document.getElementById(remoteViewId) : null;
            await trtc.startRemoteVideo({ userId: remoteUserId, streamType, view: remoteEl || remoteViewId });
          } catch (error) {
            console.error("TRTC remote video failed", error);
            setMediaNotice("Remote video could not be played.");
          }
        });
        trtc.on(TRTC.EVENT.REMOTE_VIDEO_UNAVAILABLE, () => setRemoteVideoReady(false));
        trtc.on(TRTC.EVENT.AUTOPLAY_FAILED, () => {
          setMediaNotice("Tap the call screen once to enable remote audio.");
        });
        trtc.on(TRTC.EVENT.ERROR, (error) => {
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
        if (activeCall.type === "video") {
          try {
            await new Promise((resolve) => setTimeout(resolve, 0));
            const localEl = typeof document !== "undefined" ? document.getElementById(localViewId) : null;
            await trtc.startLocalVideo({ view: localEl || localViewId, option: { useFrontCamera: cameraType !== "back" } });
            setLocalVideoReady(true);
          } catch (error) {
            console.error("TRTC local video failed to start", error);
            setMediaNotice(error?.message || "Camera could not be started.");
          }
        }
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
  }, [activeCall?.id, activeCall?.status, activeCall?.type, activeCall?.rtcRoomId, activeCall?.roomId, cameraType, localViewId, remoteViewId, userId]);

  useEffect(() => {
    trtcRef.current?.updateLocalAudio?.({ mute: isMuted }).catch(() => {});
  }, [isMuted]);

  useEffect(() => {
    trtcRef.current?.updateLocalVideo?.({ mute: !isCameraOn }).catch(() => {});
  }, [isCameraOn]);

  useEffect(() => {
    const remoteUserId = remoteUserIdRef.current;
    if (remoteUserId) trtcRef.current?.muteRemoteAudio?.(remoteUserId, !isSpeakerOn).catch(() => {});
  }, [isSpeakerOn]);

  useEffect(() => {
    trtcRef.current?.updateLocalVideo?.({
      option: { useFrontCamera: cameraType !== "back" },
    }).catch(() => {});
  }, [cameraType]);

  useEffect(() => {
    const status = String(activeCall?.status || "").toLowerCase();
    if (activeCall && !["declined", "missed", "cancelled", "ended"].includes(status)) return;
    const trtc = trtcRef.current;
    trtcRef.current = null;
    callIdRef.current = null;
    remoteUserIdRef.current = null;
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

  return { localViewId, remoteViewId, localVideoReady, remoteVideoReady, mediaNotice };
}
