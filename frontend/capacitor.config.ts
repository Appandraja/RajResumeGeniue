import type { CapacitorConfig } from '@capacitor/cli';

// Node provides `process` when the Capacitor CLI loads this file.
declare const process: { env: Record<string, string | undefined> };

/**
 * Set CAP_DEV=true when syncing a debug build that talks to a plain-HTTP dev backend
 * (e.g. http://10.0.2.2:8000 from the Android emulator). Release builds must use HTTPS.
 */
const isDevBuild = process.env.CAP_DEV === 'true';

const config: CapacitorConfig = {
  appId: 'com.rajresumegenie.app',
  appName: 'RajResumeGenie',
  webDir: 'dist',
  server: {
    // Serve the bundled app from https://localhost so secure-context APIs work.
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: isDevBuild,
  },
};

export default config;
