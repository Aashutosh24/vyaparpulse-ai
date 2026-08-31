# Android Setup — VyaparPulse (Capacitor)

This document covers packaging the existing React/Vite frontend as an Android
APK using Capacitor.

## Prerequisites

- **Node.js** 18+ (already in use)
- **Android Studio** — latest stable (Hedgehog or newer)
- **Android SDK** — API level 33+ (installed via Android Studio SDK Manager)
- **Java/JDK** — 17+ (bundled with Android Studio or installed separately)

## Steps

### 1. Install Capacitor dependencies

From the `frontend/` directory:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### 2. Initialize Capacitor

```bash
npx cap init "VyaparPulse" "com.vyaparpulse.app" --web-dir dist
```

This creates `capacitor.config.ts` in the project root.

### 3. Add Android platform

```bash
npx cap add android
```

This creates the `android/` directory with a full Android Studio project.

### 4. Build the web app

```bash
npm run build
```

This produces the `dist/` directory that Capacitor will serve.

### 5. Sync web assets to Android

```bash
npx cap sync android
```

### 6. Open in Android Studio

```bash
npx cap open android
```

Or open `frontend/android/` directly in Android Studio.

### 7. Build and run

In Android Studio:
- Select a device or emulator (recommended: Pixel 6 API 33+)
- Click **Run** (green play button)
- The APK will install and launch

## Configuration Notes

### Backend / Voice Agent URLs

For a device or emulator to reach localhost servers, update `capacitor.config.ts`:

```ts
const config: CapacitorConfig = {
  appId: 'com.vyaparpulse.app',
  appName: 'VyaparPulse',
  webDir: 'dist',
  server: {
    // For Android emulator → host machine:
    // url: 'http://10.0.2.2:5173',
    // For real device on LAN:
    // url: 'http://192.168.x.x:5173',
    cleartext: true, // Required for HTTP (non-HTTPS) dev servers
  },
};
```

Also set environment variables before building:

```bash
VITE_BACKEND_URL=http://10.0.2.2:8000    # For emulator
VITE_VOICE_URL=http://10.0.2.2:8000      # For emulator
```

Or for a real device on WiFi:
```bash
VITE_BACKEND_URL=http://192.168.x.x:8000
VITE_VOICE_URL=http://192.168.x.x:8000
```

### Cleartext HTTP (Android 9+)

Android blocks cleartext HTTP by default. Capacitor's `cleartext: true` handles
this for the WebView, but if you need additional network permissions, add to
`android/app/src/main/AndroidManifest.xml`:

```xml
<application android:usesCleartextTraffic="true" ...>
```

### Microphone Permission

For voice recording, ensure `android/app/src/main/AndroidManifest.xml` includes:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```

Capacitor should add INTERNET by default, but RECORD_AUDIO must be verified.

### Status Bar / Navigation Bar

For a clean demo, consider hiding the status bar in the Capacitor config:

```ts
plugins: {
  StatusBar: {
    style: 'DARK',
    backgroundColor: '#1B4332', // vp-brand green
  },
},
```

## Generating a signed APK

For SIH submission:

1. In Android Studio: **Build → Generate Signed Bundle / APK**
2. Select **APK**
3. Create or use a keystore
4. Build type: **release**
5. The APK will be in `android/app/build/outputs/apk/release/`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| White screen on device | Check that `npm run build` ran and `npx cap sync` was done after |
| Cannot reach backend | Use `10.0.2.2` (emulator) or LAN IP (device), not `localhost` |
| Microphone not working | Check RECORD_AUDIO permission in manifest |
| Build fails in Android Studio | Ensure JDK 17+ and Gradle sync succeeded |
