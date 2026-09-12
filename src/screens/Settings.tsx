import { Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openNearbyAlertSettings, useNearbyAlerts } from '../contexts/NearbyAlertsContext';

export function Settings() {
  const insets = useSafeAreaInsets();
  const { status, ready, busy, enable, disable, refresh } = useNearbyAlerts();
  const enabled = status.preference === 'enabled';
  const supported = Platform.OS === 'ios';

  return (
    <View
      style={{ flex: 1, paddingTop: insets.top }}
      className="bg-white dark:bg-black"
    >
      <View className="w-full px-5 mt-4 mb-2">
        <Text accessibilityRole="header" className="text-gray-900 dark:text-white text-5xl mt-2 font-extrabold">
          Settings
        </Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}
      >
        <View className="mx-5 rounded-2xl bg-white dark:bg-[#0D0D0F] border border-[#E5E5E5] dark:border-[#262626] px-5 pt-5 pb-4">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 mr-3 text-xl font-bold text-gray-900 dark:text-white">Nearby Gym Alerts</Text>
            <Switch
              accessibilityLabel="Nearby gym alerts"
              value={enabled}
              disabled={!supported || !ready || busy}
              trackColor={{ true: '#BF5700' }}
              onValueChange={(value) => void (value ? enable() : disable())}
            />
          </View>
          <Text className="text-gray-600 dark:text-neutral-400 text-base font-medium mt-4 leading-6">
            Get notified when you’re near an open UT gym.
          </Text>
          <Text className="text-gray-600 dark:text-neutral-400 text-base font-medium mt-2 leading-6">
            Requires notifications and location access set to “Always” with “Precise Location” enabled.
          </Text>
          {status.issue && (
            <View className="mt-4">
              <Text className="text-gray-900 dark:text-white text-base font-medium leading-6">{status.issue}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={status.needsSettings ? openNearbyAlertSettings : () => void refresh()}
                className="py-3 mt-1"
              >
                <Text className="text-[#BF5700] font-semibold">
                  {status.needsSettings ? 'Open iPhone Settings' : 'Try again'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
