import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { detectPose } from '@treksis/react-native-vision-camera-v3-pose-detection/src/detectPose';
import { theme } from '@/constants/theme';

type NativeCameraFacing = 'front' | 'back';

type PoseLandmark = {
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
};

type NativePosePoint = {
  x?: number;
  y?: number;
  z?: number;
  inFrameLikelihood?: number;
};

type NativePosePayload = Record<string, NativePosePoint | undefined>;

type NativePoseCameraProps = {
  facing: NativeCameraFacing;
  isActive: boolean;
  onError: (message: string | null) => void;
  onLandmarks: (landmarks: PoseLandmark[]) => void;
  onReady: () => void;
};

const TARGET_POSE_FPS = 12;
const MIN_NATIVE_LANDMARK_VISIBILITY = 0.5;
const MIN_VISIBLE_REQUIRED_LANDMARKS = 7;
const LANDMARK_SMOOTHING_ALPHA = 0.22;
const BICEP_TRACKING_LANDMARKS = new Set(['right_shoulder', 'right_elbow', 'right_wrist']);
const REQUIRED_LANDMARKS = [
  ['right_hip', 'rightHipPosition'],
  ['left_hip', 'leftHipPosition'],
  ['right_shoulder', 'rightShoulderPosition'],
  ['left_shoulder', 'leftShoulderPosition'],
  ['right_elbow', 'rightElbowPosition'],
  ['left_elbow', 'leftElbowPosition'],
  ['right_wrist', 'rightWristPosition'],
  ['left_wrist', 'leftWristPosition'],
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const toLandmarks = (pose: NativePosePayload | null | undefined): PoseLandmark[] => {
  if (!pose) {
    return [];
  }

  const points = REQUIRED_LANDMARKS.map(([, key]) => pose[key]).filter(Boolean);
  const maxX = Math.max(...points.map((point) => point?.x ?? 0));
  const maxY = Math.max(...points.map((point) => point?.y ?? 0));
  if (!Number.isFinite(maxX) || !Number.isFinite(maxY) || maxX <= 0 || maxY <= 0) {
    return [];
  }
  const coordinatesAreNormalized = maxX <= 1.5 && maxY <= 1.5;

  const landmarks = REQUIRED_LANDMARKS.map(([name, key]) => {
    const point = pose[key];
    const hasPoint =
      typeof point?.x === 'number' &&
      typeof point?.y === 'number' &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      (point.x !== 0 || point.y !== 0);

    const x = point?.x ?? 0;
    const y = point?.y ?? 0;
    const z = point?.z ?? 0;
    const normalizedX = coordinatesAreNormalized ? x : x / maxX;
    const normalizedY = coordinatesAreNormalized ? y : y / maxY;

    return {
      name,
      x: hasPoint ? clamp01(normalizedX) : 0,
      y: hasPoint ? clamp01(normalizedY) : 0,
      z: hasPoint ? (coordinatesAreNormalized ? z : z / Math.max(maxX, 1)) : 0,
      visibility: hasPoint ? clamp01(point?.inFrameLikelihood ?? 1) : 0,
    };
  });

  const visibleCount = landmarks.filter(
    (landmark) => landmark.visibility >= MIN_NATIVE_LANDMARK_VISIBILITY
  ).length;
  const bicepTrackingReady = landmarks
    .filter((landmark) => BICEP_TRACKING_LANDMARKS.has(landmark.name))
    .every((landmark) => landmark.visibility >= MIN_NATIVE_LANDMARK_VISIBILITY);
  return visibleCount >= MIN_VISIBLE_REQUIRED_LANDMARKS && bicepTrackingReady ? landmarks : [];
};

const smoothLandmarks = (
  previousLandmarks: PoseLandmark[] | null,
  nextLandmarks: PoseLandmark[]
): PoseLandmark[] => {
  if (!previousLandmarks || previousLandmarks.length !== nextLandmarks.length) {
    return nextLandmarks;
  }

  const previousByName = new Map(previousLandmarks.map((landmark) => [landmark.name, landmark]));
  return nextLandmarks.map((landmark) => {
    const previous = previousByName.get(landmark.name);
    if (!previous || landmark.visibility < MIN_NATIVE_LANDMARK_VISIBILITY) {
      return landmark;
    }

    return {
      ...landmark,
      x: previous.x + (landmark.x - previous.x) * LANDMARK_SMOOTHING_ALPHA,
      y: previous.y + (landmark.y - previous.y) * LANDMARK_SMOOTHING_ALPHA,
      z: previous.z + (landmark.z - previous.z) * LANDMARK_SMOOTHING_ALPHA,
    };
  });
};

export default function NativePoseCamera({
  facing,
  isActive,
  onError,
  onLandmarks,
  onReady,
}: NativePoseCameraProps) {
  const device = useCameraDevice(facing);
  const format = useCameraFormat(device, [
    { videoResolution: { width: 640, height: 480 } },
    { fps: 30 },
  ]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const lastLandmarksRef = useRef<PoseLandmark[] | null>(null);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const handlePose = useCallback(
    (pose: NativePosePayload | null | undefined) => {
      const landmarks = toLandmarks(pose);
      if (landmarks.length) {
        const smoothedLandmarks = smoothLandmarks(lastLandmarksRef.current, landmarks);
        lastLandmarksRef.current = smoothedLandmarks;
        onLandmarks(smoothedLandmarks);
      } else {
        lastLandmarksRef.current = null;
      }
    },
    [onLandmarks]
  );

  const runPoseOnJS = useRunOnJS(handlePose, [handlePose]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      runAtTargetFps(TARGET_POSE_FPS, () => {
        'worklet';
        const pose = detectPose(frame, { mode: 'stream', performanceMode: 'min' });
        runPoseOnJS(pose);
      });
    },
    [runPoseOnJS]
  );

  if (!hasPermission) {
    return (
      <View style={styles.cameraState}>
        <Text style={styles.cameraText}>Camera permission needed</Text>
        <Text style={styles.cameraSubtext}>Enable camera access to start native form tracking.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.cameraState}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.cameraSubtext}>Starting native camera</Text>
      </View>
    );
  }

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      format={format}
      fps={30}
      isActive={isActive}
      frameProcessor={frameProcessor}
      pixelFormat="rgb"
      onInitialized={() => {
        onError(null);
        onReady();
      }}
      onError={(error) => {
        onError(error.message);
      }}
    />
  );
}

const styles = StyleSheet.create({
  cameraState: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
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
});
