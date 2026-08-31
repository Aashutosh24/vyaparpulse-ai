import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vyaparpulse.app',
  appName: 'VyaparPulse',
  webDir: 'dist',
  server: {
    // For development with Android emulator pointing to host machine:
    // url: 'http://10.0.2.2:5173',
    // For real device on LAN:
    // url: 'http://192.168.x.x:5173',
    cleartext: true, // Required for HTTP (non-HTTPS) backend access
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#FFF8F0', // vp-surface warm off-white
    },
  },
};

export default config;
