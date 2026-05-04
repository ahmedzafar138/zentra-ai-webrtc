declare module '@treksis/react-native-vision-camera-v3-pose-detection/src/detectPose' {
  import type { Frame } from 'react-native-vision-camera';

  export type PoseDetectionOptions = {
    mode?: 'stream' | 'single';
    performanceMode?: 'min' | 'max';
  };

  export function detectPose(frame: Frame, options?: PoseDetectionOptions): any;
}

declare module 'react-native-webrtc' {
  export const RTCPeerConnection: any;
}

declare const require: (moduleName: string) => any;
