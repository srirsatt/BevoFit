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
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON;

// Removed overlaying status bar shim; we will use safe area padding instead.
// file wide supabase declaration
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


export async function getFacilities() {
  const { data, error } = await supabase
    .from('facilities')
    .select('name')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getFacilitiesMinimal() {
  const { data, error } = await supabase
    .from('facilities')
    .select('id, name, slug')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getLatestHoursForFacility(facilityId: string) {
  const { data, error } = await supabase
    .from('facility_hours')
    .select('*')
    .eq('facility_id', facilityId)
    .order('scraped_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getLatestHoursForAllFacilities() {
  const { data, error } = await supabase
    .from('facility_hours')
    .select('*')
    .order('scraped_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};


export function Home() {
  // Separate animated states so buttons don't sync
  const scaleCard = useSharedValue(1);
  const scaleFabLeft = useSharedValue(1);
  const scaleFabRight = useSharedValue(1);
  const navigation = useNavigation();
  const [result, setResult] = useState<WebBrowser.WebBrowserResult | null>(null);


  getFacilities().then(f => console.log(f)).catch(console.error);
  getLatestHoursForFacility('9a4c77cc-a882-4b53-8022-bb3c914071fa').then(h => console.log(h)).catch(console.error);

  const rCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleCard.value }],
  }));
  const rFabLeftStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleFabLeft.value }],
  }));
  const rFabRightStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleFabRight.value }],
  }));

  const _handleButtonPressAsync = async () => {
    let result = await WebBrowser.openBrowserAsync("https://secure.rs.utexas.edu/app/myrecsports/scan.php");
    setResult(result);
  }

  const pressInCard = () => {
    scaleCard.value = withTiming(0.95, { duration: 80, easing: Easing.out(Easing.quad) });
  }

  const pressOutCard = () => {
    scaleCard.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) });
  }

  const pressInFabLeft = () => {
    scaleFabLeft.value = withTiming(0.95, { duration: 80, easing: Easing.out(Easing.quad) });
  }

  const pressOutFabLeft = () => {
    scaleFabLeft.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) });
  }

  const pressInFabRight = () => {
    scaleFabRight.value = withTiming(0.95, { duration: 80, easing: Easing.out(Easing.quad) });
  }

  const pressOutFabRight = () => {
    scaleFabRight.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) });
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
          style={rCardStyle}
          className="w-full h-20 bg-[#111111] rounded-2xl border border-[#262626] px-4 mt-4 flex-row items-center justify-between mb-4"
          onPressIn={pressInCard}
          onPressOut={pressOutCard}
          onPress={_handleButtonPressAsync}
        >
          <Text className="text-[#BF5700] text-4xl">▶</Text>
          <View>
            <Text className="text-white pb-1 text-xl font-bold">Check-In QR Code</Text>
            <Text className="text-neutral-400 text-xs">
              Use this code to check into all UT RecSports facilities.
            </Text>
          </View>
        </AnimatedPressable>

      </ScrollView>

      <View className="absolute bottom-8 left-0 right-0 px-6 flex-row items-center justify-between">
        <AnimatedPressable
          className="w-20 h-20 rounded-full bg-[#BF5700] flex items-center justify-center relative"
          style={rFabLeftStyle}
          onPressIn={pressInFabLeft}
          onPressOut={pressOutFabLeft}
          onPress={_handleButtonPressAsync}
        >
          <Ionicons name="qr-code-outline" size={32} color="white" />
        </AnimatedPressable>
        <AnimatedPressable
          className="w-20 h-20 rounded-full bg-[#BF5700] flex items-center justify-center"
          style={rFabRightStyle}
          onPressIn={pressInFabRight}
          onPressOut={pressOutFabRight}
          onPress={() => navigation.navigate("Scanner")}
        >
          <Ionicons name="barbell" size={36} color="white" />
        </AnimatedPressable>
      </View>
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
