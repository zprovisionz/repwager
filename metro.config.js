const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const optionalModules = [
    '@tensorflow/tfjs-backend-webgpu',
    '@mediapipe/pose',
    '@mediapipe/selfie_segmentation',
    '@mediapipe/hands',
    'onnxruntime-node',
  ];
  if (optionalModules.includes(moduleName)) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
