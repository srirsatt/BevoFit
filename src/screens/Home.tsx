import { StyleSheet, View, Text, ScrollView, Pressable, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import '../../global.css'
import * as WebBrowser from 'expo-web-browser';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Icon } from 'expo-router/unstable-native-tabs';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModal, BottomSheetView, BottomSheetModalProvider, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { FullWindowOverlay } from 'react-native-screens';

// Removed overlaying status bar shim; we will use safe area padding instead.


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
    .select('id, name, slug, lat, lng, addr, facility_url, hero_image_path')
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
  lat: number;
  lng: number;
  addr: string;
  facility_url: string;
  hero_image_path: string;
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
  hero_image_url?: string | null;
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
  const [selectedGym, setSelectedGym] = useState<FacilityWithHours | null>(null); // for use with selecting my gym card
  const sheetRef = useRef<BottomSheetModal>(null);

  // essentially, each modal has access to a facilitywithhours state var
  // this var should allow for every required supabase read, due to access to ID and SLUG as defined in the type
  const snapPoints = useMemo(() => ['80%'], []);

  // callbacks for sheets
  const handleModalPress = useCallback((gym: FacilityWithHours) => {
    setSelectedGym(gym);
    sheetRef.current?.present();
  }, []);
  const handleSheetChanges = useCallback((index: number) => {
    console.log('handle sheet changes', index);
  }, []);

  // simple test
  //getFacilities().then(f => console.log(f)).catch(console.error);
  //getLatestHoursForFacility('9a4c77cc-a882-4b53-8022-bb3c914071fa').then(h => console.log(h)).catch(console.error);

  useEffect(() => {
    let isMounted = true;

    async function loadGyms() {
      try {
        setGymsLoading(true);
        setGymsError(null);

        // 1. Fetch facility list (FAST)
        const facilities = await getFacilitiesMinimal();
        console.log('Fetched facilities count:', facilities?.length);
        if (facilities && facilities.length > 0) {
          console.log('First facility sample:', JSON.stringify(facilities[0], null, 2));
        }

        const gymsWithHours: FacilityWithHours[] = await Promise.all(
          facilities.map(async (f: FacilityRow) => {
            let hours = null;
            try {
              hours = await getLatestHoursForFacility(f.id);
            } catch (error) {
              console.error(`Error fetching hours for facility ${f.id}:`, error);
            }

            // Always try to get image URL if path exists, regardless of hours status
            const hero_image_url =
              f.hero_image_path
                ? supabase.storage
                  .from('facility-imgs')
                  .getPublicUrl(f.hero_image_path).data.publicUrl
                : null;

            if (f.hero_image_path) {
              console.log(`Generated URL for ${f.name}:`, hero_image_url);
            }

            return { ...f, hours, hero_image_url };
          })
        );

        if (isMounted) {
          setGyms(gymsWithHours);
        }
      } catch (e: any) {
        console.error('Error in loadGyms:', e);
        if (isMounted) setGymsError(e.message);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

  const Card = ({ gym }: { gym: FacilityWithHours }) => {
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
        className="w-full min-h-[80px] bg-[#111111] rounded-2xl border border-[#262626] px-4 mt-1 flex-row items-center justify-between mb-4"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          console.log(gym.name + " gym pressed.");
          handleModalPress(gym);
        }}
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

  const ScanCard = () => {
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
        style={rStyle}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className="w-full h-24 bg-[#BF5700] rounded-2xl border border-[#262626] px-5 mt-1 flex-row items-center justify-between mb-4"
        onPress={_handleButtonPressAsync}
      >
        <View>
          <Text className="text-white pb-1 text-2xl font-bold">Scan In</Text>
        </View>
        <Ionicons name="qr-code-outline" color="white" size={40} />
      </AnimatedPressable>
    );



  }

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
    />
  );

  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View className="w-full px-5 mt-4">
        <Text className="text-3xl font-lg ios:text-left leading-tight">
          <Text className="text-white">welcome to</Text>
        </Text>
        <Text className="sm:text-5xl text-6xl font-extrabold ios:text-left leading-tight">
          <Text className="text-[#BF5700]">BevoFit</Text>
        </Text>
      </View>

      { /* scan outside of scroll -> never mind */}
      <ScrollView
        className="flex-1 px-5 pb-8"
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

        <ScanCard />
        {/* Card per gym loop */}

        {gyms.map((gym) => (
          <Card gym={gym} key={gym.id} />
        ))}



      </ScrollView>
      <FullWindowOverlay>
        <BottomSheetModal
          ref={sheetRef}
          snapPoints={snapPoints}
          onChange={handleSheetChanges}
          enableDismissOnClose={true}
          enableDynamicSizing={false}
          backdropComponent={renderBackdrop}
          backgroundStyle={{
            backgroundColor: '#111111',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
          handleIndicatorStyle={{
            backgroundColor: 'white',
            width: '10%',
            height: 5,
          }}
        >
          <BottomSheetScrollView>
            <View className="px-7 pt-3">
              <Text className="text-white text-4xl font-bold">{selectedGym?.name}</Text>
              <Image source={{ uri: selectedGym?.hero_image_url ?? undefined }} style={{ width: '100%', height: 220 }} />

            </View>
          </BottomSheetScrollView>

        </BottomSheetModal>
      </FullWindowOverlay>
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
