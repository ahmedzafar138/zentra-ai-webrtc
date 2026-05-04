import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Circle, Line } from 'react-native-svg';
import {
  Camera,
  ChevronLeft,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
} from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { getModelGatewayCandidateBaseUrls } from '@/lib/modelGatewayApi';
import NativePoseCamera from './NativePoseCamera';

const IS_WEB = Platform.OS === 'web';
const USE_NATIVE_MEDIAPIPE_INFERENCE = true;
const CAMERA_PREVIEW_ASPECT_RATIO = 3 / 4;
const FRAME_CAPTURE_INTERVAL_MS = IS_WEB ? 120 : 180;
const FRAME_CAPTURE_QUALITY = IS_WEB ? 0.35 : 0.18;
const MIN_INFERENCE_FRAME_AREA = IS_WEB ? 480 * 360 : 320 * 240;
const MAX_REALTIME_BUFFERED_BYTES = IS_WEB ? 2_000_000 : 600_000;
const MIN_LANDMARK_VISIBILITY = 0.5;
const GATEWAY_RECONNECT_BASE_DELAY_MS = 750;
const GATEWAY_RECONNECT_MAX_DELAY_MS = 5000;
const GATEWAY_CONNECT_TIMEOUT_MS = 4000;
const BICEP_CURL_WEBRTC_OFFER_PATH = '/api/v1/bicep-curl/webrtc/offer';

type PoseLandmark = {
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
};

type BicepCurlFrameResponse = {
  type?: string;
  message?: string;
  session_id?: string;
  timestamp_ms?: number;
  status: string;
  angle: number | null;
  correct_reps: number;
  incorrect_reps: number;
  rep_count: number;
  landmarks: PoseLandmark[] | null;
};

type InferenceDiagnostics = {
  captured: number;
  sent: number;
  received: number;
  noPose: number;
  lastFrameBytes: number;
  lastLatencyMs: number | null;
  gateway: string;
};

type RtcDataChannelLike = {
  readyState: string;
  bufferedAmount?: number;
  send: (message: string) => void;
  close: () => void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
};

type RtcPeerConnectionLike = {
  iceGatheringState: string;
  createDataChannel: (label: string) => RtcDataChannelLike;
  createOffer: () => Promise<{ sdp: string; type: string }>;
  setLocalDescription: (description: { sdp: string; type: string }) => Promise<void>;
  setRemoteDescription: (description: { sdp: string; type: string }) => Promise<void>;
  close: () => void;
  localDescription: { sdp: string; type: string } | null;
  onicegatheringstatechange: (() => void) | null;
  onconnectionstatechange: (() => void) | null;
};

function closePeerConnectionSafely(peerConnection: RtcPeerConnectionLike | null) {
  if (!peerConnection) {
    return;
  }

  setTimeout(() => {
    peerConnection.close();
  }, 1000);
}

function getRTCPeerConnectionConstructor() {
  const globalPeerConnection = (globalThis as typeof globalThis & {
    RTCPeerConnection?: new (configuration?: unknown) => RtcPeerConnectionLike;
  }).RTCPeerConnection;

  if (globalPeerConnection) {
    return globalPeerConnection;
  }

  if (!IS_WEB) {
    return require('react-native-webrtc').RTCPeerConnection as new (
      configuration?: unknown
    ) => RtcPeerConnectionLike;
  }

  return null;
}

function waitForIceGatheringComplete(peerConnection: RtcPeerConnectionLike) {
  if (peerConnection.iceGatheringState === 'complete') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 1500);
    peerConnection.onicegatheringstatechange = () => {
      if (peerConnection.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        resolve();
      }
    };
  });
}

async function getGatewayErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

const LANDMARK_CONNECTIONS = [
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['right_shoulder', 'right_hip'],
  ['right_shoulder', 'left_shoulder'],
] as const;

export default function LiveFormViewScreen() {
  const params = useLocalSearchParams();
  const exercise = params.exercise as string;
  const [correctReps, setCorrectReps] = useState(0);
  const [incorrectReps, setIncorrectReps] = useState(0);
  const [time, setTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [inferenceStatus, setInferenceStatus] = useState('Camera ready');
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [angle, setAngle] = useState<number | null>(null);
  const [poseLandmarks, setPoseLandmarks] = useState<PoseLandmark[]>([]);
  const [pictureSize, setPictureSize] = useState<string | undefined>();
  const [diagnostics, setDiagnostics] = useState<InferenceDiagnostics>({
    captured: 0,
    sent: 0,
    received: 0,
    noPose: 0,
    lastFrameBytes: 0,
    lastLatencyMs: null,
    gateway: '',
  });
  const cameraRef = useRef<CameraView>(null);
  const peerConnectionRef = useRef<RtcPeerConnectionLike | null>(null);
  const dataChannelRef = useRef<RtcDataChannelLike | null>(null);
  const captureInFlightRef = useRef(false);
  const inferenceInFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const supportsInference = exercise === 'Bicep Curl';
  const usesNativePose = supportsInference && !IS_WEB && USE_NATIVE_MEDIAPIPE_INFERENCE;

  const isRealtimeTransportOpen = useCallback(() => {
    const channel = dataChannelRef.current;
    if (
      channel?.readyState === 'open' &&
      (channel.bufferedAmount ?? 0) <= MAX_REALTIME_BUFFERED_BYTES
    ) {
      return true;
    }

    return false;
  }, []);

  const sendRealtimeMessage = useCallback((message: string) => {
    const channel = dataChannelRef.current;
    if (
      channel?.readyState === 'open' &&
      (channel.bufferedAmount ?? 0) <= MAX_REALTIME_BUFFERED_BYTES
    ) {
      channel.send(message);
      return true;
    }

    return false;
  }, []);

  const handleRealtimePayload = useCallback((payload: BicepCurlFrameResponse) => {
    if (payload.type === 'session_started') {
      setSessionId(payload.session_id ?? null);
      setRealtimeReady(true);
      setInferenceStatus('Waiting for pose');
      return;
    }

    if (payload.type === 'error') {
      inferenceInFlightRef.current = false;
      setInferenceError(payload.message ?? 'Inference error');
      setInferenceStatus('Inference paused');
      return;
    }

    if (payload.type && payload.type !== 'frame_result') {
      return;
    }

    inferenceInFlightRef.current = false;
    setDiagnostics((current) => ({
      ...current,
      received: current.received + 1,
      noPose: payload.status === 'no_pose_detected' ? current.noPose + 1 : current.noPose,
      lastLatencyMs: payload.timestamp_ms ? Date.now() - payload.timestamp_ms : current.lastLatencyMs,
    }));
    setCorrectReps(payload.correct_reps);
    setIncorrectReps(payload.incorrect_reps);
    setAngle(payload.angle);
    setPoseLandmarks(payload.landmarks ?? []);
    setInferenceStatus(payload.status.replace(/_/g, ' '));
    setInferenceError(null);
  }, []);

  useEffect(() => {
    if (!usesNativePose && cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission, usesNativePose]);

  useEffect(() => {
    if (!isPaused) {
      timerRef.current = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused]);

  useEffect(() => {
    if (!supportsInference || (!usesNativePose && !cameraPermission?.granted)) {
      return;
    }

    let active = true;
    let reconnectAttempt = 0;
    let connectInFlight = false;
    let connectGeneration = 0;
    const gatewayBaseUrls = getModelGatewayCandidateBaseUrls();

    const clearReconnectTimer = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const closeRealtimeTransport = () => {
      const channel = dataChannelRef.current;
      dataChannelRef.current = null;
      if (channel?.readyState === 'open' || channel?.readyState === 'connecting') {
        channel.close();
      }

      const peerConnection = peerConnectionRef.current;
      peerConnectionRef.current = null;
      closePeerConnectionSafely(peerConnection);
    };

    const connectWebRtc = async (gatewayBaseUrl: string, generation: number) => {
      const RTCPeerConnectionConstructor = getRTCPeerConnectionConstructor();
      if (!RTCPeerConnectionConstructor) {
        throw new Error('WebRTC is not available on this platform.');
      }

      const peerConnection = new RTCPeerConnectionConstructor({ iceServers: [] });
      const dataChannel = peerConnection.createDataChannel('bicep-curl');
      let sessionStarted = false;

      if (!active || generation !== connectGeneration) {
        closePeerConnectionSafely(peerConnection);
        return;
      }

      peerConnectionRef.current = peerConnection;
      dataChannelRef.current = dataChannel;
      setDiagnostics((current) => ({ ...current, gateway: `${gatewayBaseUrl} (WebRTC)` }));
      setRealtimeReady(false);
      setInferenceStatus(
        reconnectAttempt === 0 ? 'Connecting to model gateway' : 'Reconnecting to model gateway'
      );
      setInferenceError(null);

      dataChannel.onopen = () => {
        setInferenceStatus('Starting inference session');
      };

      dataChannel.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as BicepCurlFrameResponse;
          if (payload.type === 'session_started') {
            sessionStarted = true;
            reconnectAttempt = 0;
          }
          handleRealtimePayload(payload);
        } catch {
          inferenceInFlightRef.current = false;
          setInferenceError('Invalid gateway message');
          setInferenceStatus('Inference paused');
        }
      };

      dataChannel.onerror = () => {
        captureInFlightRef.current = false;
        inferenceInFlightRef.current = false;
        setRealtimeReady(false);
        setInferenceError('WebRTC connection failed. Retrying...');
        setInferenceStatus('Gateway offline');
      };

      dataChannel.onclose = () => {
        if (dataChannelRef.current === dataChannel) {
          dataChannelRef.current = null;
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const state = (peerConnection as RtcPeerConnectionLike & { connectionState?: string })
          .connectionState;
        if (!active || !['closed', 'disconnected', 'failed'].includes(state ?? '')) {
          return;
        }

        captureInFlightRef.current = false;
        inferenceInFlightRef.current = false;
        setRealtimeReady(false);
        setSessionId(null);
        setInferenceStatus('Gateway offline');
        setInferenceError('Trying to reconnect to the model gateway...');
        clearReconnectTimer();
        reconnectTimeoutRef.current = setTimeout(connect, GATEWAY_RECONNECT_BASE_DELAY_MS);
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await waitForIceGatheringComplete(peerConnection);

      if (!active || generation !== connectGeneration) {
        closePeerConnectionSafely(peerConnection);
        return;
      }

      const controller = new AbortController();
      const offerTimeout = setTimeout(() => controller.abort(), GATEWAY_CONNECT_TIMEOUT_MS);
      const offerUrl = `${gatewayBaseUrl}${BICEP_CURL_WEBRTC_OFFER_PATH}`;
      let response: Response;

      try {
        response = await fetch(offerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(peerConnection.localDescription),
          signal: controller.signal,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'request failed';
        throw new Error(`WebRTC offer request failed for ${gatewayBaseUrl}: ${reason}`);
      } finally {
        clearTimeout(offerTimeout);
      }

      if (!response.ok) {
        const detail = await getGatewayErrorMessage(response);
        throw new Error(`WebRTC offer failed for ${gatewayBaseUrl}: ${response.status} ${detail}`);
      }

      const answer = (await response.json()) as { sdp: string; type: string };
      if (!active || generation !== connectGeneration) {
        closePeerConnectionSafely(peerConnection);
        return;
      }

      await peerConnection.setRemoteDescription(answer);

      if (sessionStarted) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`WebRTC data channel did not start for ${gatewayBaseUrl}.`));
        }, GATEWAY_CONNECT_TIMEOUT_MS);

        const originalOnMessage = dataChannel.onmessage;
        dataChannel.onmessage = (event) => {
          originalOnMessage?.(event);
          try {
            const payload = JSON.parse(event.data) as BicepCurlFrameResponse;
            if (payload.type === 'session_started') {
              clearTimeout(timeout);
              resolve();
            }
          } catch {
            clearTimeout(timeout);
            reject(new Error(`Invalid gateway message from ${gatewayBaseUrl}`));
          }
        };
      });
    };

    const connect = () => {
      if (!active || connectInFlight || !gatewayBaseUrls.length) {
        return;
      }

      const gatewayBaseUrl = gatewayBaseUrls[reconnectAttempt % gatewayBaseUrls.length];
      const generation = ++connectGeneration;
      connectInFlight = true;

      connectWebRtc(gatewayBaseUrl, generation)
        .then(() => {
          connectInFlight = false;
        })
        .catch((error) => {
          connectInFlight = false;
          if (!active) {
            return;
          }

          dataChannelRef.current?.close();
          dataChannelRef.current = null;
          closePeerConnectionSafely(peerConnectionRef.current);
          peerConnectionRef.current = null;
          captureInFlightRef.current = false;
          inferenceInFlightRef.current = false;
          setRealtimeReady(false);
          setSessionId(null);

          reconnectAttempt += 1;
          const delay = Math.min(
            GATEWAY_RECONNECT_BASE_DELAY_MS * 2 ** Math.min(reconnectAttempt - 1, 3),
            GATEWAY_RECONNECT_MAX_DELAY_MS
          );

          setInferenceStatus('Gateway offline');
          setInferenceError(
            error instanceof Error ? error.message : 'Trying to reconnect to the model gateway...'
          );
          console.warn('[model-gateway] WebRTC connect failed', gatewayBaseUrl, error);
          clearReconnectTimer();
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        });
    };

    connect();

    return () => {
      active = false;
      clearReconnectTimer();
      setRealtimeReady(false);
      setSessionId(null);
      captureInFlightRef.current = false;
      inferenceInFlightRef.current = false;
      closeRealtimeTransport();
    };
  }, [cameraPermission?.granted, handleRealtimePayload, supportsInference, usesNativePose]);

  useEffect(() => {
    if (usesNativePose || !supportsInference || !cameraReady || isPaused || !realtimeReady) {
      return;
    }

    let active = true;

    const captureAndSendFrame = async () => {
      if (
        captureInFlightRef.current ||
        inferenceInFlightRef.current ||
        !cameraRef.current ||
        !isRealtimeTransportOpen()
      ) {
        return;
      }

      captureInFlightRef.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          exif: !IS_WEB,
          quality: FRAME_CAPTURE_QUALITY,
          skipProcessing: !IS_WEB,
          shutterSound: false,
        });

        if (!active || !photo.base64) {
          captureInFlightRef.current = false;
          return;
        }

        setDiagnostics((current) => ({
          ...current,
          captured: current.captured + 1,
          lastFrameBytes: Math.round((photo.base64?.length ?? 0) * 0.75),
        }));
        captureInFlightRef.current = false;
        inferenceInFlightRef.current = true;
        setDiagnostics((current) => ({ ...current, sent: current.sent + 1 }));
        const sent = sendRealtimeMessage(
          JSON.stringify({
            type: 'image_frame',
            image_base64: photo.base64,
            timestamp_ms: Date.now(),
          })
        );
        if (!sent) {
          inferenceInFlightRef.current = false;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Inference request failed';
        if (active) {
          setInferenceError(message);
          setPoseLandmarks([]);
          setInferenceStatus('Inference paused');
        }
        captureInFlightRef.current = false;
        inferenceInFlightRef.current = false;
      }
    };

    captureAndSendFrame();
    const interval = setInterval(captureAndSendFrame, FRAME_CAPTURE_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    cameraReady,
    isPaused,
    isRealtimeTransportOpen,
    sendRealtimeMessage,
    supportsInference,
    usesNativePose,
    realtimeReady,
  ]);

  const handleNativeLandmarks = useCallback(
    (landmarks: PoseLandmark[]) => {
      if (
        isPaused ||
        inferenceInFlightRef.current ||
        !realtimeReady ||
        !isRealtimeTransportOpen()
      ) {
        return;
      }

      const message = JSON.stringify({
        type: 'landmarks_frame',
        landmarks: landmarks.map((landmark) => [
          landmark.x,
          landmark.y,
          landmark.z,
          landmark.visibility,
        ]),
        timestamp_ms: Date.now(),
      });

      inferenceInFlightRef.current = true;
      setDiagnostics((current) => ({
        ...current,
        captured: current.captured + 1,
        sent: current.sent + 1,
        lastFrameBytes: message.length,
      }));
      if (!sendRealtimeMessage(message)) {
        inferenceInFlightRef.current = false;
      }
    },
    [isPaused, isRealtimeTransportOpen, sendRealtimeMessage, realtimeReady]
  );

  const handleFlipCamera = () => {
    setCameraReady(false);
    setPictureSize(undefined);
    setCameraFacing((current) => (current === 'front' ? 'back' : 'front'));
  };

  const handlePausePlay = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    router.back();
  };

  const handleChange = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    router.back();
    router.back();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const chooseFastPictureSize = (sizes: string[]) => {
    const parsedSizes = sizes
      .map((size) => {
        const [width, height] = size.split('x').map(Number);
        return { size, width, height, area: width * height };
      })
      .filter(({ width, height, area }) => width > 0 && height > 0 && area > 0);

    const landscapeFourThreeSizes = parsedSizes.filter(
      ({ width, height }) => Math.abs(width / height - 4 / 3) < 0.04
    );
    const candidates = landscapeFourThreeSizes.length ? landscapeFourThreeSizes : parsedSizes;
    candidates.sort((a, b) => a.area - b.area);
    return (
      candidates.find(({ area }) => area >= MIN_INFERENCE_FRAME_AREA)?.size ?? candidates[0]?.size
    );
  };

  const handleCameraReady = async () => {
    setCameraReady(true);
    setCameraError(null);

    if (pictureSize || !cameraRef.current) {
      return;
    }

    try {
      const sizes = await cameraRef.current.getAvailablePictureSizesAsync();
      setPictureSize(chooseFastPictureSize(sizes));
    } catch {
      setPictureSize(undefined);
    }
  };

  const renderPoseOverlay = () => {
    if (!poseLandmarks.length) {
      return null;
    }

    const visibleLandmarks = poseLandmarks.filter(
      (landmark) => landmark.visibility >= MIN_LANDMARK_VISIBILITY
    );
    const shouldMirrorOverlay = cameraFacing === 'front' && !usesNativePose;
    const toPreviewPoint = (landmark: PoseLandmark) => ({
      ...landmark,
      x: shouldMirrorOverlay ? 1 - landmark.x : landmark.x,
    });
    const previewLandmarks = visibleLandmarks.map(toPreviewPoint);
    const landmarkByName = new Map(previewLandmarks.map((landmark) => [landmark.name, landmark]));

    return (
      <Svg style={styles.poseOverlay} viewBox="0 0 1 1" preserveAspectRatio="none">
        {LANDMARK_CONNECTIONS.map(([fromName, toName]) => {
          const from = landmarkByName.get(fromName);
          const to = landmarkByName.get(toName);
          if (!from || !to) {
            return null;
          }

          return (
            <Line
              key={`${fromName}-${toName}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={theme.colors.primary}
              strokeWidth={0.01}
              strokeLinecap="round"
            />
          );
        })}
        {previewLandmarks.map((landmark) => (
          <Circle
            key={landmark.name}
            cx={landmark.x}
            cy={landmark.y}
            r={0.018}
            fill={theme.colors.white}
            stroke={theme.colors.primary}
            strokeWidth={0.006}
          />
        ))}
      </Svg>
    );
  };

  const renderCameraContent = () => {
    if (usesNativePose) {
      return (
        <View style={styles.cameraFrame}>
          <NativePoseCamera
            facing={cameraFacing}
            isActive={!isPaused}
            onReady={() => {
              setCameraReady(true);
              setCameraError(null);
            }}
            onError={(message) => {
              setCameraReady(false);
              setCameraError(message);
            }}
            onLandmarks={handleNativeLandmarks}
          />
          {renderPoseOverlay()}

          {!cameraReady && !cameraError && (
            <View style={styles.cameraOverlay}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.cameraSubtext}>Starting MediaPipe pose camera</Text>
            </View>
          )}

          {cameraError && (
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraText}>MediaPipe camera could not start</Text>
              <Text style={styles.cameraSubtext}>{cameraError}</Text>
            </View>
          )}

          <View style={styles.cameraTopBar}>
            <Text style={styles.cameraBadgeText}>{inferenceStatus}</Text>
            <TouchableOpacity style={styles.flipButton} onPress={handleFlipCamera}>
              <RotateCcw size={18} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (!cameraPermission) {
      return (
        <View style={styles.cameraState}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.cameraSubtext}>Checking camera permission</Text>
        </View>
      );
    }

    if (!cameraPermission.granted) {
      return (
        <View style={styles.cameraState}>
          <Camera size={34} color={theme.colors.primary} />
          <Text style={styles.cameraText}>Camera permission needed</Text>
          <Text style={styles.cameraSubtext}>Enable camera access to start form tracking.</Text>
          {cameraPermission.canAskAgain && (
            <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
              <Text style={styles.permissionButtonText}>Allow Camera</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.cameraFrame}>
        <CameraView
          ref={cameraRef}
          style={styles.cameraPreview}
          facing={cameraFacing}
          mode="picture"
          pictureSize={pictureSize}
          animateShutter={false}
          onCameraReady={handleCameraReady}
          onMountError={(event) => {
            setCameraReady(false);
            setCameraError(event.message);
          }}
        />
        {renderPoseOverlay()}

        {!cameraReady && !cameraError && (
          <View style={styles.cameraOverlay}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.cameraSubtext}>Starting camera</Text>
          </View>
        )}

        {cameraError && (
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraText}>Camera could not start</Text>
            <Text style={styles.cameraSubtext}>{cameraError}</Text>
          </View>
        )}

        <View style={styles.cameraTopBar}>
          <Text style={styles.cameraBadgeText}>
            {supportsInference ? inferenceStatus : 'Camera Preview'}
          </Text>
          <TouchableOpacity style={styles.flipButton} onPress={handleFlipCamera}>
            <RotateCcw size={18} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderInferenceDiagnostics = () => {
    if (!supportsInference) {
      return null;
    }

    const transportLabel = diagnostics.gateway.includes('WebRTC') ? 'WebRTC' : 'gateway --';

    return (
      <Text style={styles.diagnosticText}>
        {`Frames ${diagnostics.captured}/${diagnostics.sent}/${diagnostics.received} | no pose ${diagnostics.noPose} | ${
          diagnostics.lastLatencyMs === null ? 'latency --' : `latency ${diagnostics.lastLatencyMs}ms`
        } | ${Math.round(diagnostics.lastFrameBytes / 1024)}KB | ${transportLabel}`}
      </Text>
    );
  };

  return (
    <LinearGradient colors={[theme.colors.background, '#0A0A0A']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{exercise}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.cameraModule}>{renderCameraContent()}</View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.coachPanel}>
            <View style={{ paddingLeft: 10 }}>
              <Text style={styles.coachTitle}>Suggestions for max hypertrophy</Text>
              {renderInferenceDiagnostics()}
              <View style={styles.suggestionItem}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.suggestionText}>
                  {supportsInference && angle !== null
                    ? `Current elbow angle: ${angle.toFixed(0)} degrees`
                    : 'Control tempo: 2 seconds down, 1 second up'}
                </Text>
              </View>
              <View style={styles.suggestionItem}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.suggestionText}>
                  {inferenceError ?? 'Maintain full range of motion'}
                </Text>
              </View>
              <View style={styles.suggestionItem}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.suggestionText}>Keep core engaged throughout</Text>
              </View>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Correct Reps</Text>
              <Text style={styles.kpiValue}>{correctReps}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Incorrect Reps</Text>
              <Text style={[styles.kpiValue, styles.incorrectValue]}>{incorrectReps}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Time</Text>
              <Text style={styles.kpiValue}>{formatTime(time)}</Text>
            </View>
          </View>

          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.controlButton} onPress={handlePausePlay}>
              {isPaused ? (
                <Play size={24} color={theme.colors.white} />
              ) : (
                <Pause size={24} color={theme.colors.white} />
              )}
              <Text style={styles.controlButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, styles.primaryControl]} onPress={handleStop}>
              <Square size={24} color={theme.colors.white} />
              <Text style={styles.controlButtonText}>Finish</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={handleChange}>
              <RefreshCw size={24} color={theme.colors.white} />
              <Text style={styles.controlButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  cameraModule: {
    marginBottom: 15,
  },
  cameraFrame: {
    aspectRatio: CAMERA_PREVIEW_ASPECT_RATIO,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  cameraPreview: {
    flex: 1,
  },
  poseOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraState: {
    aspectRatio: CAMERA_PREVIEW_ASPECT_RATIO,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 18, 18, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  cameraTopBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraBadgeText: {
    color: theme.colors.white,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  flipButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  cameraSubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 6,
  },
  permissionButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  coachPanel: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 8,
    marginBottom: 12,
  },
  coachTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 6,
    marginTop: 3,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bullet: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    marginRight: 6,
    lineHeight: theme.fontSize.sm + 4,
  },
  suggestionText: {
    flex: 1,
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    lineHeight: theme.fontSize.sm + 4,
  },
  diagnosticText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    lineHeight: theme.fontSize.sm + 4,
    marginBottom: 6,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    lineHeight: theme.fontSize.xl + 4,
    textAlign: 'center',
  },
  incorrectValue: {
    color: '#FF4444',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  primaryControl: {
    backgroundColor: theme.colors.primary,
  },
  controlButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.white,
    fontWeight: '500',
  },
});
