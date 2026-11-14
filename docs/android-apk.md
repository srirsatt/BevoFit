# Share an Android APK

The `preview-android` EAS profile produces a signed release APK with the JavaScript
and assets included. The recipient does not need Expo Go, Metro, or a computer.
This profile uses the existing EAS `production` backend environment.

## Google Maps setup

1. Create/select a Google Cloud project with billing enabled.
2. Enable **Maps SDK for Android**.
3. Create an API key restricted to **Maps SDK for Android** and **Android apps**.
4. Add package `com.sriram.bevofit` and the SHA-1 of the EAS signing certificate.
   Retrieve the current fingerprint with `eas credentials --platform android`
   and select `preview-android`.
5. Add `ANDROID_GOOGLE_MAPS_API_KEY=your-key` to the ignored local `.env` file.
6. Set the same variable in the project's EAS **production** environment with
   **Sensitive** visibility, so both local config resolution and the cloud build
   can read it. The CLI can prompt for the value:

   ```sh
   eas env:create production --name ANDROID_GOOGLE_MAPS_API_KEY --visibility sensitive
   ```

`app.config.js` inserts the value into Android's native map configuration. Do not
put the key directly in tracked source. The release build hook rejects an Android
build without this key or the two public Supabase variables.

Google's [Android Maps setup guide](https://developers.google.com/maps/documentation/android-sdk/get-api-key)
describes the console setup and restrictions. If the signing key changes, update
the allowed certificate fingerprint before sharing another APK.

## Build and share

```sh
npm test
npm run typecheck
EAS_BUILD_PLATFORM=android npm run check:release-env
eas build --platform android --profile preview-android
```

Download the `.apk` from the completed EAS build. Share the APK or its install
link. On the Android phone, open the download, allow installation from that browser
or file manager if prompted, and tap **Install**. An internet connection is needed
for current gym/class data and map tiles.

Before sharing, check Home, gym details, Calendar, map markers, Google Maps walking
directions, crowd reports, and appearance settings on an Android phone. Nearby Gym
Alerts and the in-app walking-time estimate currently use iOS-only modules;
Android directions open Google Maps.

The `android/` directory is ignored by Git. EAS regenerates it from the Expo config;
edits to that local directory are not the source of the cloud build.
