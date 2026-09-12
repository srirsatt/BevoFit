import ExpoModulesCore
import MapKit

public class BevoWalkingDirectionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BevoWalkingDirections")

    AsyncFunction("walkingTimeAsync") { (latitude: Double, longitude: Double, destinationLatitude: Double, destinationLongitude: Double) async throws -> Double in
      let source = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
      let destination = CLLocationCoordinate2D(latitude: destinationLatitude, longitude: destinationLongitude)
      guard CLLocationCoordinate2DIsValid(source), CLLocationCoordinate2DIsValid(destination) else {
        throw NSError(domain: "BevoWalkingDirections", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid route coordinates."])
      }

      let request = MKDirections.Request()
      request.source = MKMapItem(placemark: MKPlacemark(coordinate: source))
      request.destination = MKMapItem(placemark: MKPlacemark(coordinate: destination))
      request.transportType = .walking
      let directions = MKDirections(request: request)
      let response = try await directions.calculateETA()
      return response.expectedTravelTime
    }
  }
}
