import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maxbond.app',
  appName: ' Maxbond',
  "webDir": "build",
  "plugins": {
    "Geolocation": {
      "backgroundMessage": "Tracking attendance location",
      "cancelTitle": "Stop Tracking",
      "cancelText": "Are you sure you want to stop attendance tracking?",
      "cancelButton": "Stop",
      "allowCancel": true
    }
  }
};

export default config;
