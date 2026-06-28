import type { CapacitorConfig } from '@capacitor/cli'

const productionOrigin = 'https://popuphub.ca'
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() || `${productionOrigin}/discover`

const config: CapacitorConfig = {
  appId: 'ca.popuphub.app',
  appName: 'Popup Hub',
  webDir: 'mobile/www',
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      'popuphub.ca',
      '*.popuphub.ca',
      '*.vercel.app',
      '*.supabase.co',
      '*.supabase.in',
      'accounts.google.com',
      'appleid.apple.com',
      'login.microsoftonline.com',
      'www.facebook.com',
      'm.facebook.com',
      'facebook.com',
      'checkout.stripe.com',
      'connect.squareup.com',
      'squareup.com',
    ],
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      // Skip the native splash overlay — the web initial-loader animation
      // is the only branded first-paint experience.
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 0,
      backgroundColor: '#faf8f5',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#faf8f5',
    },
  },
}

export default config
