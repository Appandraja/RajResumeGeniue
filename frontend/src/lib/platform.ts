import { Capacitor } from '@capacitor/core';

/** True when running inside the installed Android app (Capacitor), false in a browser. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
