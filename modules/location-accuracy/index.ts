import { requireOptionalNativeModule } from 'expo';

type LocationAccuracyModule = {
  hasPreciseLocationAsync(): Promise<boolean>;
};

export async function hasPreciseLocationPermission(): Promise<boolean> {
  const nativeModule = requireOptionalNativeModule<LocationAccuracyModule>(
    'BevoLocationAccuracy'
  );

  if (!nativeModule) {
    throw new Error('Location accuracy module is missing from this app build.');
  }

  return nativeModule.hasPreciseLocationAsync();
}
