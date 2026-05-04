const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const packageRoot = path.join(
  projectRoot,
  'node_modules',
  '@treksis',
  'react-native-vision-camera-v3-pose-detection'
);
const androidRoot = path.join(packageRoot, 'android');
const kotlinRoot = path.join(
  androidRoot,
  'src',
  'main',
  'java',
  'com',
  'visioncamerav3posedetection'
);

if (!fs.existsSync(packageRoot)) {
  console.warn('[mediapipe-pose] pose detection package not installed; skipping patch.');
  process.exit(0);
}

const moduleSource = String.raw`package com.visioncamerav3posedetection

import android.os.SystemClock
import com.facebook.react.bridge.WritableNativeMap
import com.google.mediapipe.framework.image.MediaImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

class VisionCameraV3PoseDetectionModule(
  private val proxy: VisionCameraProxy,
  options: Map<String, Any>?
) : FrameProcessorPlugin() {
  private var poseLandmarker: PoseLandmarker? = null
  private var lastTimestampMs: Long = 0

  private fun getPoseLandmarker(): PoseLandmarker {
    val existingLandmarker = poseLandmarker
    if (existingLandmarker != null) return existingLandmarker

    val baseOptions = BaseOptions.builder()
      .setModelAssetPath("pose_landmarker_lite.task")
      .build()
    val landmarkerOptions = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setRunningMode(RunningMode.VIDEO)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence(0.5f)
      .setMinPosePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .build()

    return PoseLandmarker.createFromOptions(proxy.context, landmarkerOptions).also {
      poseLandmarker = it
    }
  }

  private fun nextTimestampMs(): Long {
    val now = SystemClock.uptimeMillis()
    val timestamp = if (now <= lastTimestampMs) lastTimestampMs + 1 else now
    lastTimestampMs = timestamp
    return timestamp
  }

  private fun addLandmarkToMap(
    result: PoseLandmarkerResult,
    landmarkIndex: Int,
    landmarkName: String,
    map: WritableNativeMap
  ) {
    val poseLandmarks = result.landmarks().firstOrNull()
    val landmark = poseLandmarks?.getOrNull(landmarkIndex)
    val landmarkMap = WritableNativeMap()

    landmarkMap.putDouble("x", landmark?.x()?.toDouble() ?: 0.0)
    landmarkMap.putDouble("y", landmark?.y()?.toDouble() ?: 0.0)
    landmarkMap.putDouble("z", landmark?.z()?.toDouble() ?: 0.0)
    landmarkMap.putDouble("inFrameLikelihood", landmark?.visibility()?.orElse(0.0f)?.toDouble() ?: 0.0)

    map.putMap(landmarkName, landmarkMap)
  }

  override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
    try {
      val mpImage = MediaImageBuilder(frame.image).build()
      val imageProcessingOptions = ImageProcessingOptions.builder()
        .setRotationDegrees(frame.imageProxy.imageInfo.rotationDegrees)
        .build()
      val result = getPoseLandmarker().detectForVideo(
        mpImage,
        imageProcessingOptions,
        nextTimestampMs()
      )
      val map = WritableNativeMap()

      if (result.landmarks().isNotEmpty()) {
        addLandmarkToMap(result, 11, "leftShoulderPosition", map)
        addLandmarkToMap(result, 12, "rightShoulderPosition", map)
        addLandmarkToMap(result, 13, "leftElbowPosition", map)
        addLandmarkToMap(result, 14, "rightElbowPosition", map)
        addLandmarkToMap(result, 15, "leftWristPosition", map)
        addLandmarkToMap(result, 16, "rightWristPosition", map)
        addLandmarkToMap(result, 23, "leftHipPosition", map)
        addLandmarkToMap(result, 24, "rightHipPosition", map)
        addLandmarkToMap(result, 25, "leftKneePosition", map)
        addLandmarkToMap(result, 26, "rightKneePosition", map)
        addLandmarkToMap(result, 27, "leftAnklePosition", map)
        addLandmarkToMap(result, 28, "rightAnklePosition", map)
        addLandmarkToMap(result, 17, "leftPinkyPosition", map)
        addLandmarkToMap(result, 18, "rightPinkyPosition", map)
        addLandmarkToMap(result, 19, "leftIndexPosition", map)
        addLandmarkToMap(result, 20, "rightIndexPosition", map)
        addLandmarkToMap(result, 21, "leftThumbPosition", map)
        addLandmarkToMap(result, 22, "rightThumbPosition", map)
        addLandmarkToMap(result, 29, "leftHeelPosition", map)
        addLandmarkToMap(result, 30, "rightHeelPosition", map)
        addLandmarkToMap(result, 31, "leftFootIndexPosition", map)
        addLandmarkToMap(result, 32, "rightFootIndexPosition", map)
        addLandmarkToMap(result, 0, "nosePosition", map)
        addLandmarkToMap(result, 1, "leftEyeInnerPosition", map)
        addLandmarkToMap(result, 2, "leftEyePosition", map)
        addLandmarkToMap(result, 3, "leftEyeOuterPosition", map)
        addLandmarkToMap(result, 4, "rightEyeInnerPosition", map)
        addLandmarkToMap(result, 5, "rightEyePosition", map)
        addLandmarkToMap(result, 6, "rightEyeOuterPosition", map)
        addLandmarkToMap(result, 7, "leftEarPosition", map)
        addLandmarkToMap(result, 8, "rightEarPosition", map)
        addLandmarkToMap(result, 9, "leftMouthPosition", map)
        addLandmarkToMap(result, 10, "rightMouthPosition", map)
      }

      return map.toHashMap()
    } catch (error: Exception) {
      throw Exception("Error processing MediaPipe pose detection: $error")
    }
  }
}
`;

const packageSource = String.raw`package com.visioncamerav3posedetection

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry

class VisionCameraV3PoseDetectionPackage : ReactPackage {
  companion object {
    init {
      FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectPose") { proxy, options ->
        VisionCameraV3PoseDetectionModule(proxy, options)
      }
    }
  }

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return emptyList()
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

const moduleFile = path.join(kotlinRoot, 'VisionCameraV3PoseDetectionModule.kt');
const packageFile = path.join(kotlinRoot, 'VisionCameraV3PoseDetectionPackage.kt');
fs.writeFileSync(moduleFile, moduleSource);
fs.writeFileSync(packageFile, packageSource);

const buildGradlePath = path.join(androidRoot, 'build.gradle');
let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
buildGradle = buildGradle.replace(
  /implementation ['"]com\.google\.mlkit:pose-detection:[^'"]+['"]/,
  "implementation 'com.google.mediapipe:tasks-vision:0.10.14'"
);
if (!buildGradle.includes('androidx.camera:camera-core')) {
  buildGradle = buildGradle.replace(
    "implementation \"org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version\"",
    "implementation \"org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version\"\n  implementation \"androidx.camera:camera-core:1.5.0-alpha03\""
  );
}
if (!buildGradle.includes("com.google.mediapipe:tasks-vision")) {
  buildGradle = buildGradle.replace(
    "implementation \"org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version\"",
    "implementation \"org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version\"\n  implementation 'com.google.mediapipe:tasks-vision:0.10.14'"
  );
}
fs.writeFileSync(buildGradlePath, buildGradle);

const sourceModel = path.join(projectRoot, 'assets', 'mediapipe', 'pose_landmarker_lite.task');
const targetAssetsDir = path.join(androidRoot, 'src', 'main', 'assets');
const targetModel = path.join(targetAssetsDir, 'pose_landmarker_lite.task');
fs.mkdirSync(targetAssetsDir, { recursive: true });
fs.copyFileSync(sourceModel, targetModel);

console.log('[mediapipe-pose] patched native pose detector to use MediaPipe Tasks.');
