# README visuals

`home.png`, `calendar.png`, and `map.png` are screenshots of the updated app
provided by the project owner on September 13, 2026. Each was resized from
1206 by 2622 pixels to 630 pixels wide with its aspect ratio preserved.
The screen contents were not edited or cropped.

`bevofit-banner.png` combines the Home screenshot with the app icon from `assets/icon.png`,
typeset copy, and simple court markings. It is 1600 by 900 pixels. To regenerate
it on macOS, run this from the repository root:

```sh
swift -module-cache-path /tmp/bevofit-swift-cache docs/images/render-banner.swift
```

The architecture diagram is maintained as Mermaid directly in the root README.
