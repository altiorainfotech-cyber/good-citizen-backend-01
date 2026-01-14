/**
 * Build configuration for mobile app optimization
 * Supports both user and partner app builds for Android and iOS
 */

const path = require('path');

const buildConfig = {
  // User App Configuration
  userApp: {
    android: {
      outputPath: path.join(__dirname, 'builds', 'user-app', 'android'),
      optimizations: {
        treeshaking: true,
        codeSplitting: true,
        assetOptimization: true,
        minification: true,
      },
      bundleSettings: {
        splitChunks: true,
        lazyLoading: true,
        preloadCritical: true,
      },
      targetSize: '25MB', // Maximum APK size
    },
    ios: {
      outputPath: path.join(__dirname, 'builds', 'user-app', 'ios'),
      optimizations: {
        treeshaking: true,
        codeSplitting: true,
        assetOptimization: true,
        minification: true,
      },
      bundleSettings: {
        splitChunks: true,
        lazyLoading: true,
        preloadCritical: true,
      },
      targetSize: '30MB', // Maximum IPA size
    },
  },
  
  // Partner App Configuration
  partnerApp: {
    android: {
      outputPath: path.join(__dirname, 'builds', 'partner-app', 'android'),
      optimizations: {
        treeshaking: true,
        codeSplitting: true,
        assetOptimization: true,
        minification: true,
      },
      bundleSettings: {
        splitChunks: true,
        lazyLoading: true,
        preloadCritical: true,
      },
      targetSize: '25MB', // Maximum APK size
    },
    ios: {
      outputPath: path.join(__dirname, 'builds', 'partner-app', 'ios'),
      optimizations: {
        treeshaking: true,
        codeSplitting: true,
        assetOptimization: true,
        minification: true,
      },
      bundleSettings: {
        splitChunks: true,
        lazyLoading: true,
        preloadCritical: true,
      },
      targetSize: '30MB', // Maximum IPA size
    },
  },
  
  // Asset Optimization Settings
  assets: {
    images: {
      compression: {
        quality: 85,
        progressive: true,
        optimizeForSize: true,
      },
      formats: ['webp', 'png', 'jpg'],
      sizes: [1, 2, 3], // 1x, 2x, 3x for different screen densities
    },
    fonts: {
      subset: true,
      formats: ['woff2', 'woff'],
      preload: ['Poppins-Regular', 'Poppins-Medium', 'Poppins-Bold'],
    },
  },
  
  // Performance Targets
  performance: {
    bundleAnalysis: true,
    sizeWarnings: {
      maxAssetSize: 250000, // 250KB
      maxEntrypointSize: 500000, // 500KB
    },
    monitoring: {
      trackBundleSize: true,
      alertOnSizeIncrease: 0.1, // 10% increase threshold
    },
  },
};

module.exports = buildConfig;