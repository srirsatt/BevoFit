# BevoFit release checklist

## Build and upload

The production profile in `eas.json` uses Xcode 26.2, the EAS `production`
environment, and automatic build-number increments. Submission targets the
existing BevoFit App Store Connect record, `6758592301`.

```sh
npm run check:release-env
npm test
npm run typecheck
npx expo-doctor
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Select the production build you just created when submitting. Uploading makes it
available in App Store Connect/TestFlight; it does not publish the app. Install
and test it through TestFlight before attaching it to the App Store version and
submitting for review. Choose manual release if you want to control launch time.

The EAS build hook rejects missing/invalid public Supabase configuration before
native compilation. The required variables are `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE`. Both were listed in EAS production during this
review; their remote values were not printed or changed. Never use an administrative
Supabase key in an `EXPO_PUBLIC_` variable.

Use `app.json` for the app version (currently `2.0.0`). Confirm it is newer than the
published version before uploading. Keep the bundle identifier
`com.sriram.bevofit` unchanged.

## Before App Review

- Publish the updated `privacy-policy.html` to the existing GitHub Pages site and
  verify the live policy contains the crowd-report disclosures. Local edits do
  not update the hosted page. Settings links to that hosted page.
- Set the Privacy Policy URL in App Store Connect to
  `https://srirsatt.github.io/BevoFit/privacy-policy.html`.
- Complete App Privacy, screenshots, description, support URL, age-rating
  questionnaire, availability, review contact, and any outstanding agreements.
- Device ID and Other User Content are collected for App Functionality, linked
  through the device identifier, and not used for tracking. The iOS privacy
  manifest records these declarations. Confirm server/provider logging practices
  before treating the declarations as exhaustive.
- Confirm Supabase RLS and grants protect facility data from public writes and
  prevent clients from retrieving other users' device identifiers. Backend policy
  configuration and report retention cannot be verified from this repository.
  The 30-minute crowd display window does not delete stored reports.
- Reviewer demo pages are previews of external UT services, not interactive
  substitutes for an authenticated account. Arrange additional review access if
  Apple needs to exercise those external flows; do not describe previews as a
  fully functional demo.

## Review Notes draft

BevoFit displays UT Austin recreational facility hours, amenities, locations, and
RecSports classes. Browsing this information does not require an account. Gym
crowd reporting is optional and contributes to recent crowd-level estimates.

Scan In, TeXercise, and IMLeagues open external services. UT authentication occurs
on those services rather than in a BevoFit account. To see preview pages without
UT credentials, tap the BevoFit title on Home five times and select Enable. The
same gesture allows you to disable preview mode. The previews illustrate the
external services and do not support actual reservations or facility admission.

Nearby Gym Alerts are optional in Settings. They request notification permission
and Always/Precise location access to notify users near open gyms. No permission
prompt is required to start browsing the app. Tapping a gym notification opens
that gym's details. Location is also used for the map and Apple Maps walking times.

## TestFlight checks

- Fresh install opens without Metro, a connected Mac, or any mandatory permission
  prompts. Test with location and notifications denied as well as granted.
- Facility and calendar data loads; cached facilities remain usable offline.
- Crowd submission works, including network failure/retry behavior; switching gym
  details does not display another gym's report.
- Calendar days with zero, few, and many classes display and scroll correctly.
- Map details, walking times, and external links work on a physical phone.
- Background gym entry, overlapping gym boundaries, and notification taps work
  with alerts enabled; turning the toggle off stops monitoring.
- Light, Dark, and System Default survive a restart. The Settings privacy link
  opens the updated policy and the version is visible at the bottom.
- Exercise the native tab bar on iOS 26 and the classic tabs on a supported older
  iOS version.

## Dependency notes

`location-accuracy` is a local Expo module, so it is excluded only from React
Native Directory metadata lookup. That registry has no entry for local modules.
The discontinued ML scanner, bundled model, and its camera/TensorFlow dependencies
have been removed from the app. Scan In continues to open the UT RecSports website.
A fresh native build is needed to remove those modules from an installed binary.
EAS production builds regenerate iOS and install the current pods automatically.

References: [EAS Submit](https://docs.expo.dev/submit/ios/),
[Apple submission requirements](https://developer.apple.com/news/upcoming-requirements/),
[Apple privacy disclosures](https://developer.apple.com/app-store/app-privacy-details/).
