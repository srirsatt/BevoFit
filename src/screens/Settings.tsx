import { Alert, Linking, Platform, Pressable, ScrollView, Switch, Text, View, useColorScheme } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openNearbyAlertSettings, useNearbyAlerts } from '../contexts/NearbyAlertsContext';
import { useAppearanceSettings, type AppearancePreference } from '../contexts/AppearanceContext';

const APPEARANCE_OPTIONS: { value: AppearancePreference; label: string; icon: 'sunny-outline' | 'moon-outline' | 'phone-portrait-outline' }[] = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  { value: 'system', label: 'System Default', icon: 'phone-portrait-outline' },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Show config changes during development; installed releases use their native version.
const APP_VERSION = (__DEV__ ? Constants.expoConfig?.version : Application.nativeApplicationVersion)
  ?? Constants.expoConfig?.version ?? 'Unknown';
const PRIVACY_POLICY_URL = 'https://srirsatt.github.io/BevoFit/privacy-policy.html';
const SUPPORT_EMAIL_URL = `mailto:info@utrecsports.org?subject=${encodeURIComponent('Check out BevoFit!')}&body=${encodeURIComponent(
  "Hi UT RecSports,\n\nBevoFit has been super helpful for me for finding gym hours and RecSports classes at UT. I'd love for your team to check it out!\n\nhttps://apps.apple.com/us/app/bevofit/id6758592301\n\nThanks!"
)}`;

async function openSupportEmail() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  try {
    await Linking.openURL(SUPPORT_EMAIL_URL);
  } catch {
    Alert.alert('Couldn’t open email', 'Set up an email app on your phone, then try again. You can also email info@utrecsports.org directly.');
  }
}

async function openPrivacyPolicy() {
  try {
    await Linking.openURL(PRIVACY_POLICY_URL);
  } catch {
    Alert.alert('Couldn’t open privacy policy', `Visit ${PRIVACY_POLICY_URL} in your browser, or contact sriramsattiraju07@gmail.com.`);
  }
}

export function Settings() {
  const insets = useSafeAreaInsets();
  const { status, ready, busy, enable, disable, refresh } = useNearbyAlerts();
  const enabled = status.preference === 'enabled';
  const supported = Platform.OS === 'ios';
  const appearance = useAppearanceSettings();
  const isDarkMode = useColorScheme() === 'dark';
  const supportScale = useSharedValue(1);
  const supportStyle = useAnimatedStyle(() => ({ transform: [{ scale: supportScale.value }] }));

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
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 55 }}
      >
        <View className="mx-5 mb-6">
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Support BevoFit!"
            accessibilityHint="Opens an email draft to UT RecSports for you to review and send."
            style={supportStyle}
            onPressIn={() => { supportScale.value = withTiming(0.95, { duration: 80 }); }}
            onPressOut={() => { supportScale.value = withTiming(1, { duration: 100 }); }}
            onPress={() => void openSupportEmail()}
            className="w-full h-24 bg-[#BF5700] rounded-2xl border border-[#E5E5E5] dark:border-[#262626] px-5 flex-row items-center justify-between"
          >
            <Text className="flex-1 mr-3 text-white pb-1 text-xl font-bold">Support BevoFit!</Text>
            <MaterialCommunityIcons name="party-popper" color="white" size={40} accessible={false} />
          </AnimatedPressable>
        </View>
        <View className="mx-5 mb-6 rounded-2xl bg-white dark:bg-[#0D0D0F] border border-[#E5E5E5] dark:border-[#262626] p-5">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">Appearance</Text>
          <View className="mt-5 gap-3">
            {APPEARANCE_OPTIONS.map((option) => {
              const selected = appearance.preference === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected, disabled: !appearance.ready }}
                  disabled={!appearance.ready}
                  onPress={() => appearance.select(option.value)}
                  className={`w-full flex-row items-center justify-between rounded-xl px-5 py-4 ${selected ? 'bg-[#BF5700]' : 'bg-[#F5F5F5] dark:bg-[#1C1C1E]'}`}
                  style={({ pressed }) => ({ minHeight: 64, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text
                    className={`flex-1 mr-4 text-lg font-semibold ${selected ? 'text-white' : 'text-gray-900 dark:text-neutral-200'}`}
                  >
                    {option.label}
                  </Text>
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={selected ? '#FFFFFF' : isDarkMode ? '#D4D4D4' : '#525252'}
                    accessible={false}
                  />
                </Pressable>
              );
            })}
          </View>
          {appearance.saveError && (
            <Text className="text-gray-600 dark:text-neutral-400 text-sm mt-3">{appearance.saveError}</Text>
          )}
        </View>
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
        <View className="mx-5 mt-6 rounded-2xl bg-white dark:bg-[#0D0D0F] border border-[#E5E5E5] dark:border-[#262626] p-5">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">About BevoFit</Text>
          <Text className="text-gray-600 dark:text-neutral-400 text-base font-medium mt-3 leading-6">
            BevoFit helps you make the most of UT RecSports. Check gym hours, find facilities, browse classes, and get walking directions, all in one place.
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
            onPress={() => void openPrivacyPolicy()}
            style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? 0.6 : 1 })}
            className="flex-row items-center justify-between mt-3"
          >
            <Text className="text-[#BF5700] text-base font-semibold">Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color="#BF5700" accessible={false} />
          </Pressable>
        </View>
        <Text className="text-gray-500 dark:text-neutral-500 text-xs text-center mt-6 mb-2">
          Version {APP_VERSION}
        </Text>
      </ScrollView>
    </View>
  );
}
