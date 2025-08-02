// In your webpack.config.js (or similar build config for web)

const path = require('path');
const webpack = require('webpack');

module.exports = {
  // ... other webpack configurations (entry, output, rules, etc.) ...

  resolve: {
    // 1. Prioritize '.web.js' and '.js' extensions for module resolution
    // This makes `MyComponent.js` resolve to `MyComponent.web.js` first if it exists.
    extensions: ['.web.js', '.js', '.jsx', '.json', '.ts', '.tsx'], // Add .ts, .tsx if using TypeScript

    // 2. Define aliases to mock or redirect React Native specific modules
    alias: {
      // Alias 'react-native' to 'react-native-web'
      // This is fundamental for rendering RN components on the web.
      'react-native$': 'react-native-web',

      // Alias specific internal React Native modules that @react-native-firebase imports
      // Point them to `false` (which tells Webpack to ignore them) or an empty mock file.
      // Using `false` is simpler if you know they won't be used at all.
      'react-native/Libraries/Utilities/binaryToBase64': false, // Error 4, 13
      'react-native/Libraries/vendor/emitter/EventEmitter': false, // Error 6

      // Alias @react-native-firebase modules to your mocks.
      // These mocks are essential because the actual @react-native-firebase
      // packages contain native-only code that Webpack can't process.
      // Pointing them to files in `src/shared/web-mocks` makes the web build succeed.
      '@react-native-firebase/app': path.resolve(__dirname, 'src/shared/web-mocks/rnfb-app.js'),
      '@react-native-firebase/auth': path.resolve(__dirname, 'src/shared/web-mocks/rnfb-auth.js'),
      '@react-native-firebase/firestore': path.resolve(__dirname, 'src/shared/web-mocks/rnfb-firestore.js'),
      '@react-native-firebase/messaging': path.resolve(__dirname, 'src/shared/web-mocks/rnfb-messaging.js'),
      // Add other @react-native-firebase modules you use:
      '@react-native-firebase/functions': path.resolve(__dirname, 'src/shared/web-mocks/rnfb-functions.js'),
      '@react-native-firebase/storage': path.resolve(__dirname, 'src/shared/web-mocks/rnfb-storage.js'),

      // Also mock react-native-permissions and react-native-device-info
      'react-native-permissions': path.resolve(__dirname, 'src/shared/web-mocks/rn-permissions.js'),
      'react-native-device-info': path.resolve(__dirname, 'src/shared/web-mocks/rn-device-info.js'),

      // Mock react-native-url-polyfill if it's causing issues
      'react-native-url-polyfill': path.resolve(__dirname, 'src/shared/web-mocks/rn-url-polyfill.js'),

       },
 mainFields: ['browser', 'module', 'main'],
  },

  plugins: [
     new webpack.DefinePlugin({
      '__DEV__': process.env.NODE_ENV !== 'production', // Consistent with React Native's __DEV__
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      }),
     ],

  
};