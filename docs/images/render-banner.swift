// Run from the repository root on macOS:
// swift -module-cache-path /tmp/bevofit-swift-cache docs/images/render-banner.swift
import AppKit

let width = 1040
let height = 640
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width,
    pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
    isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSGraphicsContext.current?.imageInterpolation = .high

func color(_ hex: UInt32, alpha: CGFloat = 1) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 255) / 255,
        green: CGFloat((hex >> 8) & 255) / 255,
        blue: CGFloat(hex & 255) / 255, alpha: alpha)
}
func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect {
    NSRect(x: x, y: CGFloat(height) - y - h, width: w, height: h)
}
func fill(_ frame: NSRect, _ ink: NSColor, radius: CGFloat = 0) {
    ink.setFill()
    NSBezierPath(roundedRect: frame, xRadius: radius, yRadius: radius).fill()
}
func label(_ text: String, x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat,
    size: CGFloat, weight: NSFont.Weight = .regular, ink: NSColor) {
    let style = NSMutableParagraphStyle()
    style.lineBreakMode = .byWordWrapping
    (text as NSString).draw(in: rect(x, y, w, h), withAttributes: [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: ink, .paragraphStyle: style
    ])
}

let charcoal = color(0x1F2328)
fill(rect(0, 0, CGFloat(width), CGFloat(height)), .white)

NSGraphicsContext.saveGraphicsState()
NSBezierPath(roundedRect: rect(48, 190, 72, 72), xRadius: 16, yRadius: 16).addClip()
NSImage(contentsOfFile: "assets/icon.png")!.draw(in: rect(48, 190, 72, 72))
NSGraphicsContext.restoreGraphicsState()
label("BevoFit", x: 140, y: 187, w: 500, h: 82, size: 64, weight: .bold, ink: charcoal)
label("Gym hours and class schedules\nfor UT Austin.",
    x: 48, y: 302, w: 620, h: 100, size: 32, ink: charcoal)
label("Facility details · Campus maps · Walking directions",
    x: 48, y: 444, w: 620, h: 40, size: 23, ink: color(0x59636E))

// A slim, rounded device frame surrounds the original app capture.
let capture = NSImage(contentsOfFile: "docs/images/home.png")!
let captureHeight: CGFloat = 560
let captureWidth = captureHeight * capture.size.width / capture.size.height
let screen = rect(720, 40, captureWidth, captureHeight)
fill(screen.insetBy(dx: -10, dy: -10), color(0x555555), radius: 44)
fill(screen.insetBy(dx: -7, dy: -7), color(0x171717), radius: 41)
NSGraphicsContext.saveGraphicsState()
NSBezierPath(roundedRect: screen, xRadius: 35, yRadius: 35).addClip()
capture.draw(in: screen)
NSGraphicsContext.restoreGraphicsState()
NSGraphicsContext.restoreGraphicsState()

try bitmap.representation(using: .png, properties: [:])!.write(
    to: URL(fileURLWithPath: "docs/images/bevofit-banner.png"))
print("Rendered docs/images/bevofit-banner.png (\(width) x \(height))")
