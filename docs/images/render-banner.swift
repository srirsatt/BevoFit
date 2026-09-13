// Run from the repository root on macOS:
// swift -module-cache-path /tmp/bevofit-swift-cache docs/images/render-banner.swift
import AppKit

let width = 1600
let height = 900
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

let cream = color(0xF7F3EC)
let orange = color(0xBF5700)
let charcoal = color(0x24221F)
fill(rect(0, 0, 1600, 900), cream)
fill(rect(940, 0, 660, 900), orange)

// Court markings provide a quiet backdrop to the actual app capture.
color(0xFFFFFF, alpha: 0.18).setStroke()
let boundary = NSBezierPath(roundedRect: rect(995, -50, 550, 1000), xRadius: 90, yRadius: 90)
boundary.lineWidth = 2
boundary.stroke()
let circle = NSBezierPath(ovalIn: rect(1050, 230, 440, 440))
circle.lineWidth = 2
circle.stroke()
let halfway = NSBezierPath()
halfway.move(to: NSPoint(x: 940, y: 450))
halfway.line(to: NSPoint(x: 1600, y: 450))
halfway.lineWidth = 2
halfway.stroke()

NSGraphicsContext.saveGraphicsState()
NSBezierPath(roundedRect: rect(80, 315, 104, 104), xRadius: 24, yRadius: 24).addClip()
NSImage(contentsOfFile: "assets/icon.png")!.draw(in: rect(80, 315, 104, 104))
NSGraphicsContext.restoreGraphicsState()
label("BevoFit", x: 213, y: 301, w: 650, h: 135, size: 104, weight: .bold, ink: charcoal)
label("Gym hours, classes, and campus directions.\nBuilt for UT Austin.",
    x: 80, y: 463, w: 790, h: 112, size: 30, ink: color(0x635C55))
fill(rect(80, 760, 50, 4), orange)
label("CAMPUS RECREATION, IN YOUR POCKET.",
    x: 80, y: 792, w: 820, h: 40, size: 20, weight: .semibold, ink: charcoal)

let capture = NSImage(contentsOfFile: "docs/images/home.png")!
let phoneWidth: CGFloat = 320
let phoneHeight = phoneWidth * capture.size.height / capture.size.width
let phone = rect(1110, (900 - phoneHeight) / 2, phoneWidth, phoneHeight)
fill(phone.insetBy(dx: -11, dy: -11), color(0x8A3F00), radius: 48)
fill(phone.insetBy(dx: -7, dy: -7), color(0x272421), radius: 44)
NSGraphicsContext.saveGraphicsState()
NSBezierPath(roundedRect: phone, xRadius: 38, yRadius: 38).addClip()
capture.draw(in: phone)
NSGraphicsContext.restoreGraphicsState()
NSGraphicsContext.restoreGraphicsState()

try bitmap.representation(using: .png, properties: [:])!.write(
    to: URL(fileURLWithPath: "docs/images/bevofit-banner.png"))
print("Rendered docs/images/bevofit-banner.png (1600 x 900)")
