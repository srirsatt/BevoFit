import CoreLocation
import ExpoModulesCore

public class BevoLocationAccuracyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BevoLocationAccuracy")

    // Read authorization only. Do not request permission or start location updates.
    AsyncFunction("hasPreciseLocationAsync") { () -> Bool in
      let manager = CLLocationManager()
      return manager.accuracyAuthorization == .fullAccuracy
    }.runOnQueue(.main)
  }
}
