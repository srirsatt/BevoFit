<h1 align="center">BevoFit</h1>

<p align="center">
  Gym hours, classes, and campus maps for UT Austin.
</p>

<p align="center">
  <a href="https://expo.dev"><img src="https://img.shields.io/badge/Expo-SDK%2054-000020?style=flat&amp;logo=expo&amp;logoColor=white" alt="Expo SDK 54"></a>
  <a href="https://reactnative.dev"><img src="https://img.shields.io/badge/React_Native-0.81.5-149ECA?style=flat&amp;logo=react&amp;logoColor=white" alt="React Native 0.81.5"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&amp;logo=typescript&amp;logoColor=white" alt="TypeScript 5.9"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-3B3B3B?style=flat" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://apps.apple.com/us/app/bevofit/id6758592301"><img src="screenshots/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg" height="48" alt="Download BevoFit on the App Store"></a>
</p>

<p align="center">
  <a href="#the-app">The app</a> · <a href="#how-it-works">Architecture</a> · <a href="#run-locally">Run locally</a> · <a href="docs/app-store-release.md">iOS release</a> · <a href="docs/android-apk.md">Android APK</a>
</p>

BevoFit helps you find open UT Austin RecSports facilities, browse class schedules, and get walking directions across campus. It's available on the App Store and as a standalone Android APK.

Browsing doesn't require a BevoFit account. Scan In, TeXercise, and IMLeagues open the relevant UT services, where you sign in with your UT credentials when required.

## The app

| Find a place | Make a plan | Get there |
| :--- | :--- | :--- |
| <img src="docs/images/home.png" width="260" alt="Home screen with Scan In and open gym hours"> | <img src="docs/images/calendar.png" width="260" alt="Calendar with class details, TeXercise, IMLeagues, and the weekly schedule"> | <img src="docs/images/map.png" width="260" alt="Campus map with UT RecSports facility markers"> |
| Check open status, closing times, photos, amenities, and weekly hours. | Browse classes, instructors, and studios. Open TeXercise or IMLeagues from the calendar. | Find facilities on the campus map and open walking directions in Apple Maps or Google Maps. |

There are a few useful extras, too:

- **Crowd reports.** Share how busy a gym feels and see an estimate based on reports from the last 30 minutes.
- **Nearby Gym Alerts (iOS).** Opt in to notifications when you're near an open gym. Tapping an alert opens that gym's details.
- **Saved gym info.** Previously loaded facility data can appear immediately while the app refreshes, including when a connection drops.
- **Your preferred appearance.** Choose Light, Dark, or System Default. iOS 26 uses native (liquid glass) tabs; older iOS versions and Android use a classic tab bar.

## How it works

The Expo app talks directly to Supabase for facility data, class schedules, crowd reports, and images. Maps, walking estimates, and nearby alerts use native device services.

```mermaid
flowchart TB
    subgraph app[BevoFit · React Native + Expo]
        screens[Home · Calendar · Map · Settings]
        cache[Shared facility cache]
        native[Native device services]
        screens <--> cache
        screens <--> native
    end

    db[(Supabase Postgres)]
    images[Supabase Storage]
    local[(AsyncStorage)]
    maps[Apple Maps / Google Maps]
    alerts[iOS location + local notifications]
    ut[UT Scan In · TeXercise · IMLeagues]

    cache <-->|Facilities + hours + amenities| db
    cache <-->|Saved facilities| local
    screens <-->|Classes + crowd reports| db
    images -->|Facility photos| screens
    native <-->|Walking directions + iOS walking estimates| maps
    native <-->|Gym entry + notification taps| alerts
    screens -->|In-app browser| ut

    classDef brand fill:#BF5700,color:#FFFFFF,stroke:#BF5700
    classDef service fill:#FFF4EA,color:#442B1C,stroke:#C89D79
    class screens,cache,native brand
    class db,images,local,maps,alerts,ut service
```

**Hours follow Austin time.** Open status is calculated from stored schedules in `America/Chicago`, including special-date overrides. The class calendar uses the same time zone.

**Facility requests are shared.** Home, Map, and Calendar use the same cache. It reuses fresh results for five minutes, restores saved catalogs up to 24 hours old, and preserves loaded data when a refresh fails.

**Nearby alerts run on the phone.** With notifications and Always/Precise location access enabled, iOS monitors gym boundaries. The app checks opening hours, overlapping facilities, and notification cooldowns before sending an alert.

**Crowd levels come from people.** The app averages recent submissions, with one report per device and facility. These are community estimates, not occupancy sensor readings.

<details>
<summary><strong>Data model</strong></summary>

The client expects these Supabase tables and storage bucket:

| Resource | Used for |
| :--- | :--- |
| `facilities` | Names, coordinates, addresses, image paths, descriptions, and nearby-alert configuration |
| `facility_hours` | Weekday schedules and special-date hours, related by `facility_id` |
| `facility_activities` | Activities available at each facility |
| `facility_features` | Facility amenities |
| `classes` | Class name, day, time, studio, instructor, and activity type |
| `busyness_reports` | Crowd level, timestamp, facility, and device identifier; upserts use `(facility_id, device_id)` |
| `facility-imgs` | Facility photos in Supabase Storage |

Database migrations and seed data are not included in this repository. A fresh Supabase project needs the corresponding tables, relationships, data, and access policies before the app can load content.

</details>

## Run locally

### Requirements

- Node.js **20.19.4 or newer** and npm.
- A Supabase project with the app's tables, data, and access policies.
- **iOS:** macOS, Xcode, and an installed simulator runtime or connected iPhone.
- **Android:** the Android SDK and an emulator or connected Android phone. Configure the Maps key using the [Android setup guide](docs/android-apk.md#google-maps-setup).

### 1. Install dependencies

```sh
npm ci
```

### 2. Configure the environment

Create `.env` in the project root:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE=your-publishable-key

# Required for Android maps
ANDROID_GOOGLE_MAPS_API_KEY=your-android-maps-key
```

Use a public publishable or legacy anon key. `EXPO_PUBLIC_` values are bundled into the app, so an administrative or service-role key does not belong here.

### 3. Start a development build

| Platform | Build and launch |
| :--- | :--- |
| iOS | `npm run ios` |
| Android | `npm run android` |

For later sessions with the development client already installed:

```sh
npm start
```

A native development build is required for the app's native features and local Swift modules. Expo Go does not contain those modules. Nearby Gym Alerts and in-app walking-time estimates are available on iOS; Android walking directions open Google Maps.

### 4. Run checks

```sh
npm test
npm run typecheck
```

The tests cover calendar time handling, facility caching, gym details, Android directions and device identification, geofencing, overlapping gym boundaries, notification routing, and release environment validation.

### Release guides

| Platform | Guide |
| :--- | :--- |
| iOS | [Build and submit to the App Store](docs/app-store-release.md) |
| Android | [Build and share a signed APK](docs/android-apk.md) |

<details>
<summary><strong>Find your way around the code</strong></summary>

| Path | What's there |
| :--- | :--- |
| [`src/app/`](src/app/) | Expo Router routes, native tabs, and app providers |
| [`src/screens/`](src/screens/) | Home, Calendar, Map, and Settings screens |
| [`src/hooks/useFacilities.ts`](src/hooks/useFacilities.ts) | Shared facility subscription for the screens |
| [`src/lib/`](src/lib/) | Supabase client, cache, hours, calendar time, walking estimates, and nearby alerts |
| [`src/contexts/`](src/contexts/) | Appearance, nearby-alert preferences, notification routing, and preview mode |
| [`modules/location-accuracy/`](modules/location-accuracy/) | Local Expo module with Swift implementations for location accuracy and MapKit walking times |
| [`tests/`](tests/) | Node test suite |
| [`backend/`](backend/) | Earlier Python and ML scanner experiments, outside the current app's runtime |

The UI uses TypeScript, React Native, Expo Router, NativeWind, Reanimated, and Gorhom Bottom Sheet. Maps use `react-native-maps`; data and images come from Supabase.

</details>

## Contact

Built by [Sriram Sattiraju](mailto:sriramsattiraju07@gmail.com). Suggestions and bug reports are welcome through [GitHub issues](https://github.com/srirsatt/gymScanner/issues) or email.

[MIT license](LICENSE) · [Privacy policy](https://srirsatt.github.io/BevoFit/privacy-policy.html)
