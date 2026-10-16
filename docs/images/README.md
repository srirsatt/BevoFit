# README visuals

`home.png`, `calendar.png`, and `map.png` are screenshots of the updated app
provided by the project owner on September 13, 2026. Each was resized from
1206 by 2622 pixels to 630 pixels wide with its aspect ratio preserved.
The screen contents were not edited or cropped.

`bevofit-banner.png` pairs the unaltered Home screenshot with the app icon from
`assets/icon.png` and a short description on a white background. It is 1040 by
640 pixels, with a slim rounded phone frame around the screenshot. To regenerate
it on macOS, run this from the repository root:

```sh
swift -module-cache-path /tmp/bevofit-swift-cache docs/images/render-banner.swift
```

The architecture diagram is maintained as Mermaid directly in the root README.
