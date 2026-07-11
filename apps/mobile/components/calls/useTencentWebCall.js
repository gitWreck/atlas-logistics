import { useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import TRTCCloud, {
  TRTCCloudDef,
  TRTCCloudListener,
  TRTCParams,
  TXVideoView,
} from "trtc-react-native";

import {
  generateTencentUserSig,
  updateConversationCallStatus,
} from "../utilities/FirebaseFunctions";

const MEDIA_STATUSES = ["ringing", "accepted", "connecting", "connected", "ongoing"];

async function requestCallPermissions(video) {
  if (Platform.OS !== "android") return true;
  const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (video) permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(
    (permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
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
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [mediaNotice, setMediaNotice] = useState("");
  const cloudRef = useRef(null);
  const listenerRef = useRef(null);
  const callIdRef = useRef(null);
  const startingCallIdRef = useRef(null);

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
        const allowed = await requestCallPermissions(activeCall.type === "video");
        if (!allowed) throw new Error("Microphone and camera permission are required for calls.");

        const signatureResult = await generateTencentUserSig({});
        const signature = signatureResult?.data || signatureResult;
        const roomId = String(activeCall.rtcRoomId || activeCall.roomId || "").trim();
        if (!signature?.sdkAppId || !signature?.userSig || !roomId) {
          throw new Error("Tencent RTC is not configured for this call.");
        }
        if (cancelled) return;

        const cloud = TRTCCloud.sharedInstance();
        cloudRef.current = cloud;
        callIdRef.current = activeCall.id;

        const listener = (type, params = {}) => {
          if (type === TRTCCloudListener.onError) {
            console.error("Native TRTC error", params);
            setMediaNotice(params.errMsg || "The call media connection failed.");
            updateConversationCallStatus({
              callId: activeCall.id,
              status: "ended",
              endReason: "media_connection_failed",
            }).catch(() => {});
          }
          if (type === TRTCCloudListener.onEnterRoom) {
            if (Number(params.result) < 0) {
              setMediaNotice(`Unable to enter the call room (${params.result}).`);
              return;
            }
            setMediaNotice("");
            cloud.startLocalAudio(TRTCCloudDef.TRTC_AUDIO_QUALITY_SPEECH).catch((error) => {
              console.error("Native TRTC audio start failed", error);
              setMediaNotice("Microphone could not be started.");
            });
            if (activeCall.type === "video") setLocalVideoReady(true);
          }
          if (type === TRTCCloudListener.onRemoteUserEnterRoom) {
            setRemoteUserId(params.userId || null);
            setMediaNotice("");
            updateConversationCallStatus({ callId: activeCall.id, status: "connected" }).catch(() => {});
          }
          if (type === TRTCCloudListener.onUserVideoAvailable) {
            if (params.userId) setRemoteUserId(params.userId);
            setRemoteVideoReady(params.visible === true || params.available === true);
          }
          if (type === TRTCCloudListener.onRemoteUserLeaveRoom) {
            setRemoteVideoReady(false);
            setRemoteUserId(null);
            setMediaNotice("Call ended");
            updateConversationCallStatus({
              callId: activeCall.id,
              status: "ended",
              endReason: "peer_left",
            }).catch(() => {});
          }
        };
        listenerRef.current = listener;
        cloud.registerListener(listener);
        await cloud.setAudioRoute(
          isSpeakerOn
            ? TRTCCloudDef.TRTC_AUDIO_ROUTE_SPEAKER
            : TRTCCloudDef.TRTC_AUDIO_ROUTE_EARPIECE,
        );
        await cloud.enterRoom(
          new TRTCParams({
            sdkAppId: Number(signature.sdkAppId),
            userId: signature.userId || userId,
            userSig: signature.userSig,
            roomId: 0,
            strRoomId: roomId,
          }),
          TRTCCloudDef.TRTC_APP_SCENE_VIDEOCALL,
        );
      } catch (error) {
        console.error("Native Tencent call failed", error);
        setMediaNotice(error?.message || "Camera or microphone could not be started.");
      } finally {
        startingCallIdRef.current = null;
      }
    };

    void start();
    return () => {
      cancelled = true;
    };
  }, [activeCall?.id, activeCall?.status, activeCall?.type, activeCall?.rtcRoomId, activeCall?.roomId, isSpeakerOn, userId]);

  useEffect(() => {
    cloudRef.current?.muteLocalAudio(isMuted).catch(() => {});
  }, [isMuted]);

  useEffect(() => {
    cloudRef.current?.muteLocalVideo(!isCameraOn).catch(() => {});
  }, [isCameraOn]);

  useEffect(() => {
    cloudRef.current?.setAudioRoute(
      isSpeakerOn
        ? TRTCCloudDef.TRTC_AUDIO_ROUTE_SPEAKER
        : TRTCCloudDef.TRTC_AUDIO_ROUTE_EARPIECE,
    ).catch(() => {});
  }, [isSpeakerOn]);

  useEffect(() => {
    cloudRef.current?.getDeviceManager()?.switchCamera(cameraType !== "back").catch(() => {});
  }, [cameraType]);

  useEffect(() => {
    const status = String(activeCall?.status || "").toLowerCase();
    if (activeCall && !["declined", "missed", "cancelled", "ended"].includes(status)) return;

    const cloud = cloudRef.current;
    const listener = listenerRef.current;
    cloudRef.current = null;
    listenerRef.current = null;
    callIdRef.current = null;
    setLocalVideoReady(false);
    setRemoteVideoReady(false);
    setRemoteUserId(null);
    if (cloud) {
      if (listener) cloud.unRegisterListener(listener);
      Promise.allSettled([
        cloud.stopLocalAudio(),
        cloud.stopLocalPreview(),
        cloud.exitRoom(),
      ]).finally(() => TRTCCloud.destroySharedInstance());
    }
  }, [activeCall?.id, activeCall?.status]);

  useEffect(() => () => {
    const cloud = cloudRef.current;
    if (cloud) {
      if (listenerRef.current) cloud.unRegisterListener(listenerRef.current);
      cloud.stopLocalAudio().catch(() => {});
      cloud.stopLocalPreview().catch(() => {});
      cloud.exitRoom().catch(() => {}).finally(() => TRTCCloud.destroySharedInstance());
    }
  }, []);

  return {
    localViewId: null,
    remoteViewId: null,
    localVideoReady,
    remoteVideoReady,
    remoteUserId,
    mediaNotice,
    NativeLocalVideoView: TXVideoView.LocalView,
    NativeRemoteVideoView: TXVideoView.RemoteView,
    nativeVideoStreamType: TRTCCloudDef.TRTC_VIDEO_STREAM_TYPE_BIG,
  };
}
