import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clarity.app',
  appName: 'Clarity',
  webDir: 'dist',
  android: {
    // Background location stops after ~5 minutes on the new bridge; the legacy
    // bridge keeps the foreground service alive for long runs.
    useLegacyBridge: true,
  },
};

export default config;
