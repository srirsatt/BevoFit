Pod::Spec.new do |s|
  s.name = 'BevoLocationAccuracy'
  s.version = '1.0.0'
  s.summary = 'Read the location accuracy authorization for BevoFit.'
  s.description = s.summary
  s.author = 'BevoFit'
  s.license = { :type => 'Proprietary' }
  s.homepage = 'https://srirsatt.github.io/BevoFit/'
  s.source = { :path => '.' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreLocation', 'MapKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
