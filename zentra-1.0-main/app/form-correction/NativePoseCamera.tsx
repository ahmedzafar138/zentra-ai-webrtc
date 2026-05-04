import React from 'react';

type NativePoseCameraProps = {
  facing: 'front' | 'back';
  isActive: boolean;
  onError: (message: string | null) => void;
  onLandmarks: (
    landmarks: {
      name: string;
      x: number;
      y: number;
      z: number;
      visibility: number;
    }[]
  ) => void;
  onReady: () => void;
};

export default function NativePoseCamera(_props: NativePoseCameraProps) {
  return null;
}
