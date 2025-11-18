import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import '../../../global.css';
import * as WebBrowser from 'expo-web-browser';

// Removed overlaying status bar shim; we will use safe area padding instead.


export function Home() {
  const scale = useSharedValue(1);
  const [result, setResult] = useState<WebBrowser.WebBrowserResult | null>(null);

  const rStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const _handleButtonPressAsync = async () => {
    let result = await WebBrowser.openBrowserAsync("https://secure.rs.utexas.edu/app/myrecsports/scan.php");
    setResult(result);
  }

  const pressIn = () => {
    scale.value = withTiming(0.95, { duration: 80, easing: Easing.out(Easing.quad) });
  }

  const pressOut = () => {
    scale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) });
  }

  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View className="w-full px-5 mt-4">
        <Text className="text-3xl font-lg ios:text-left leading-tight">
          <Text className="text-white">welcome to</Text>
        </Text>
        <Text className="text-6xl font-extrabold ios:text-left leading-tight">
          <Text className="text-[#BF5700]">BevoFit</Text>
        </Text>
      </View>

      <ScrollView 
        className="flex-1 px-5 pb-8"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/** AnimatedPressable to apply Reanimated scale style */}
        <AnimatedPressable 
          style={rStyle}
          className="w-full h-20 bg-[#111111] rounded-2xl border border-[#262626] px-4 mt-4 flex-row items-center justify-between mb-4"
          onPressIn={pressIn}
          onPressOut={pressOut}
          onPress={_handleButtonPressAsync}
        >
          <View>
            <Text className="text-white pb-1 text-xl font-bold">Check-In QR Code</Text>
            
            <Text className="text-neutral-400 text-xs">
              Use this code to check into all UT RecSports facilities.
            </Text>
            
          </View>
          <Text className="text-[#BF5700] text-2xl">▶</Text>
        </AnimatedPressable>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: 'black',
  },
});

// Create AnimatedPressable once, outside the component
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
