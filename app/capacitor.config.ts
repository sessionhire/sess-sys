import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Session Hire app for iPhone and Android (ADR 0112): a native shell
 * round the web app at its own address, so sign-in, the device's copy and
 * the offline queue are the web app's own, and a deploy reaches the app
 * the moment it reaches the web. The shell adds what a browser can't do:
 * the phone's own barcode reader, and signing in through the phone's
 * browser and back.
 *
 * SH_APP_URL points a build at another copy of the app (a test server),
 * as `SH_APP_URL=https://… npx cap sync`.
 */
const url = process.env.SH_APP_URL ?? 'https://shserver-production.up.railway.app'

const config: CapacitorConfig = {
  appId: 'com.sessionhire.app',
  appName: 'Session Hire',
  // Shown only if the app's address can't be reached the first time it opens; after that the web app keeps its own copy.
  webDir: 'www',
  server: { url, cleartext: false },
  ios: {
    // The web app's service worker, which keeps it working with no signal, only runs in an iPhone app for its own
    // listed addresses (WKAppBoundDomains in Info.plist).
    limitsNavigationsToAppBoundDomains: true,
    contentInset: 'never',
  },
  android: { allowMixedContent: false },
}

export default config
