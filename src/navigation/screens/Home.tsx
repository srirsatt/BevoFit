import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import '../../../global.css';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';

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

type FacilityRow = {
  id: string;
  name: string;
  slug: string;
};

type FacilityHoursRow = {
  facility_id: string;
  season_label: string | null;
  mon_thu: string | null;
  fri: string | null;
  sat: string | null;
  sun: string | null;
  scraped_at: string;
};

// essentially a combination of both
type FacilityWithHours = FacilityRow & {
  hours?: FacilityHoursRow | null;
};


export function Home() {
  // Separate animated states so buttons don't sync
  const scaleCard = useSharedValue(1);
  const scaleFabLeft = useSharedValue(1);
  const scaleFabRight = useSharedValue(1);
  const navigation = useNavigation();
  const [result, setResult] = useState<WebBrowser.WebBrowserResult | null>(null);

  const [gyms, setGyms] = useState<FacilityWithHours[]>([]);
  const [gymsLoading, setGymsLoading] = useState(true);
  const [gymsError, setGymsError] = useState<string | null>(null);

  // simple test
  //getFacilities().then(f => console.log(f)).catch(console.error);
  //getLatestHoursForFacility('9a4c77cc-a882-4b53-8022-bb3c914071fa').then(h => console.log(h)).catch(console.error);

  useEffect(() => {
    let isMounted = true;
    
    async function loadGyms() {
      try {
        // base cases for react states
        setGymsLoading(true);
        setGymsError(null);

        // lets fetch each facility hours
        const facilities = await getFacilitiesMinimal();
        const gymsWithHours: FacilityWithHours[] = await Promise.all(
          facilities.map(async (f: FacilityRow) => {
            try {
              const hours = await getLatestHoursForFacility(f.id);
              return { ...f, hours };
            } catch (error) {
              console.error(`Error fetching hours for facility ${f.id}:`, error);
              return { ...f, hours: null };
            }
          })
        );

        // update react states
        if (isMounted) {
          setGyms(gymsWithHours);
        } 
      } catch (e: any) {
        console.error(e);
      } finally {
        if (isMounted) setGymsLoading(false);
      }
    }
    loadGyms();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const Card = ({gym}: {gym: FacilityWithHours}) => {
    const scale = useSharedValue(1);
    const rStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }]
    }));

    const handlePressIn = () => {
      scale.value = withTiming(0.95, { duration: 80, easing: Easing.out(Easing.quad) });
    }

    const handlePressOut = () => {
      scale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) });
    }
    return (
      <AnimatedPressable
        key={gym.id}
        style={rStyle}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className="w-full h-24 bg-[#111111] rounded-2xl border border-[#262626] px-4 mt-1 flex-row items-center justify-between mb-4"
        onPress={() => console.log(gym.name + " gym pressed.")}
      >
        <View>
          <Text className="text-white pb-1 text-xl font-bold">{gym.name}</Text>
            <Text className="text-neutral-400 text-xs">
              {gym.hours ? gym.hours.mon_thu : 'No hours available'}
            </Text>
          </View>
        <Text className="text-[#2ECC71] text-4xl">▶</Text>
      </AnimatedPressable>
    );
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

        {/* Loading state for cards */}
        {gymsLoading && (
          <Text className="text-neutral-400 mt-2">Loading UT RecSports Facilities...</Text>
        )}
        {gymsError && (
          <Text className="text-red-500 mt-2">Error loading facilities: {gymsError}</Text>
        )}

        {!gymsLoading && gyms.length > 0 && (
          <Text className="text-neutral-500 text-xs uppercase tracking-[0.2em] mt-2 mb-2">
            Gyms
          </Text>
        )}

        {/* Card per gym loop */}

        {gyms.map((gym) => (
          <Card gym={gym} key={gym.id}/>
        ))}

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
