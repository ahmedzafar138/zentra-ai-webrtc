const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withMediaPipePoseModel(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const sourceModel = path.join(
        projectRoot,
        'assets',
        'mediapipe',
        'pose_landmarker_lite.task'
      );
      const targetAssetsDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets'
      );
      const targetModel = path.join(targetAssetsDir, 'pose_landmarker_lite.task');

      fs.mkdirSync(targetAssetsDir, { recursive: true });
      fs.copyFileSync(sourceModel, targetModel);

      return config;
    },
  ]);
};
