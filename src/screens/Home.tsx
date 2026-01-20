import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import '../../global.css'
import * as WebBrowser from 'expo-web-browser';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { FullWindowOverlay } from 'react-native-screens';
import { formatInTimeZone } from 'date-fns-tz';

export async function getFacilitiesMinimal() {
  const { data, error } = await supabase
    .from('facilities')
    .select('id, name, slug, lat, lng, addr, facility_url, hero_image_path, general_info, facility_activities ( activity ), facility_features ( feature ), facility_hours ( * )')

  if (error) throw error;
  return data;
}

export async function getFacilityActivities() {
  const { data, error } = await supabase
    .from('facility_activities')
    .select('facility_id, activity')

  if (error) throw error;
  return data;
}

export async function getFacilityFeatures() {
  const { data, error } = await supabase
    .from('facility_features')
    .select('facility_id, feature')

  if (error) throw error;
  return data;
}

export async function getLatestHoursForFacility(facilityId: string) {
  const { data, error } = await supabase
    .from('facility_hours')
    .select('*')
    .eq('facility_id', facilityId)

  if (error) throw error;
  return data;
}


type FacilityRow = {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  addr: string;
  facility_url: string;
  hero_image_path: string;
  general_info: string;
  facility_features: string[];
  facility_activities: string[];
};

type FacilityHours = {
  mon?: string | null;
  tue?: string | null;
  wed?: string | null;
  thu?: string | null;
  fri?: string | null;
  sat?: string | null;
  sun?: string | null;
  special_date?: string | null;   // "YYYY-MM-DD"
  special_hours?: string | null;
};

type FacilityWithHours = FacilityRow & {
  hours?: FacilityHours | null;
  hero_image_url?: string | null;
};

// Helper function to convert 12-hour time to 24-hour format
function convertTo24Hour(hour: number, minute: number, period: string): string {
  let hour24 = hour;

  if (period.toUpperCase() === 'PM' && hour !== 12) {
    hour24 = hour + 12;
  } else if (period.toUpperCase() === 'AM' && hour === 12) {
    hour24 = 0;
  }

  return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// Helper function to check if current time is within a time range
function isTimeInRange(currentTime: string, hoursString: string): boolean {
  // Parse "10:00 AM - 11:00 PM" format
  const match = hoursString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);

  if (!match) return false;

  const [_, openHour, openMin, openPeriod, closeHour, closeMin, closePeriod] = match;

  // Convert to 24-hour format
  const openTime = convertTo24Hour(parseInt(openHour), parseInt(openMin), openPeriod);
  const closeTime = convertTo24Hour(parseInt(closeHour), parseInt(closeMin), closePeriod);

  // Current time is already in "HH:mm" 24-hour format
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMin;
  const openMinutes = parseInt(openTime.split(':')[0]) * 60 + parseInt(openTime.split(':')[1]);
  const closeMinutes = parseInt(closeTime.split(':')[0]) * 60 + parseInt(closeTime.split(':')[1]);

  // Handle overnight hours (e.g., 10 PM - 2 AM)
  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}

// Main function to check if facility is currently open
export function isFacilityOpen(hours: FacilityHours | null | undefined): boolean {
  if (!hours) return false;

  // 1. Get current time in Austin (Central Time)
  const now = new Date();
  const austinTimeZone = 'America/Chicago';

  // 2. Get current day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = parseInt(formatInTimeZone(now, austinTimeZone, 'i')); // 1-7 (Mon-Sun)
  const currentTime = formatInTimeZone(now, austinTimeZone, 'HH:mm'); // "14:30"

  // 3. Check for special hours first (overrides regular hours)
  if (hours.special_date && hours.special_hours) {
    const todayDate = formatInTimeZone(now, austinTimeZone, 'yyyy-MM-dd');
    if (todayDate === hours.special_date) {
      if (hours.special_hours.toLowerCase() === 'closed') return false;
      return isTimeInRange(currentTime, hours.special_hours);
    }
  }

  // 4. Get today's hours string based on day of week
  let todayHours: string | null | undefined;

  if (dayOfWeek === 7) {
    // Sunday
    todayHours = hours.sun;
  } else if (dayOfWeek === 6) {
    // Saturday
    todayHours = hours.sat;
  } else if (dayOfWeek === 5) {
    // Friday
    todayHours = hours.fri;
  } else {
    // Monday-Thursday
    todayHours = hours.mon || hours.tue || hours.wed || hours.thu;
  }

  // 5. Check if closed or no hours
  if (!todayHours || todayHours.toLowerCase().includes('closed')) {
    return false;
  }

  // 6. Parse hours and check if current time is in range
  return isTimeInRange(currentTime, todayHours);
}

function parseIntervals(hoursStr?: string | null): string[] {
  if (!hoursStr) return [];
  const s = hoursStr.trim();
  if (!s || s.toLowerCase().includes('closed')) return [];
  // split on pipe and normalize spacing
  return s
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);
}


export function Home() {
  const [gyms, setGyms] = useState<FacilityWithHours[]>([]);
  const [gymsLoading, setGymsLoading] = useState(true);
  const [gymsError, setGymsError] = useState<string | null>(null);

  // Reactive selected gym state
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const selectedGym = useMemo(() => gyms.find(g => g.id === selectedGymId), [gyms, selectedGymId]);

  const sheetRef = useRef<BottomSheetModal>(null);
  const isPresentingRef = useRef(false);
  const snapPoints = useMemo(() => ['90%'], []);


  const handleModalPress = useCallback((gym: FacilityWithHours) => {
    if (isPresentingRef.current) return;

    isPresentingRef.current = true;
    setSelectedGymId(gym.id);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sheetRef.current?.present();
  }, []);

  const onDismiss = useCallback(() => {
    isPresentingRef.current = false;
  }, []);

  const handleSheetChanges = useCallback((index: number) => {
    console.log('handle sheet changes', index);
    if (index === -1) {
      isPresentingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadGyms() {
      try {
        setGymsLoading(true);
        setGymsError(null);

        // 1. Fetch facilities basic info (FAST)
        const facilities = await getFacilitiesMinimal();
        //console.log("first facility hours field:", facilities?.[0]?.facility_hours);

        // 2. Generate URLs and start prefetching immediately
        const initialGyms = facilities.map((f) => {

          const hero_image_url = f.hero_image_path
            ? supabase.storage.from('facility-imgs').getPublicUrl(f.hero_image_path).data.publicUrl
            : null;

          if (hero_image_url) {
            Image.prefetch(hero_image_url).catch(() => { });
          }
          return { ...f, hero_image_url, hours: f.facility_hours || null, facility_activities: f.facility_activities?.map((a: any) => a.activity) || [], facility_features: f.facility_features?.map((fea: any) => fea.feature) || [] } as unknown as FacilityWithHours;
        });

        if (isMounted) {
          setGyms(initialGyms);
          setGymsLoading(false);
        }

        // 3. Update with hours in background
      } catch (e: any) {
        console.error('Error in loadGyms:', e);
        if (isMounted) {
          setGymsError(e.message);
          setGymsLoading(false);
        }
      }
    }

    loadGyms();
    return () => { isMounted = false; };
  }, []);


  const _handleButtonPressAsync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await WebBrowser.warmUpAsync();

    await WebBrowser.openBrowserAsync("https://secure.rs.utexas.edu/app/myrecsports/scan.php", {
      dismissButtonStyle: 'close',
      enableDefaultShareMenuItem: false,
    });
  }

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
  );

  const insets = useSafeAreaInsets();

  // for activities and features 
  const ActivityChip = ({ label }: { label: string }) => {
    // Optional: slightly smaller font for long labels (helps avoid ugly truncation)
    const isLong = label.length > 18;

    return (
      <View
        className="
        w-[48%]
        h-14
        rounded-2xl
        px-3
        mb-3
        items-center
        justify-center
        border
      "
        style={{
          backgroundColor: '#15161A',               // softer than #1A1A1A
          borderColor: 'rgba(255,255,255,0.08)',   // subtle border
        }}
      >
        <Text
          className="text-white text-center font-semibold uppercase"
          style={{
            fontSize: isLong ? 10 : 11,
            letterSpacing: 0.4,
            opacity: 0.92,
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View className="w-full px-5 mt-4">
        <Text className="text-white text-3xl">welcome to</Text>
        <Text className="text-[#BF5700] text-6xl mt-2 font-extrabold">BevoFit</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{
          paddingBottom: insets.bottom + 55
        }}

      >
        {gymsLoading && <Text className="text-neutral-500 text-xs uppercase mt-2 mb-2">Loading Facilities...</Text>}

        {!gymsLoading && gyms.length > 0 && (
          <Text className="text-neutral-500 text-xs uppercase mt-2 mb-2">Gyms</Text>
        )}

        <ScanCard onPress={_handleButtonPressAsync} />
        {gyms.map((gym) => (
          <Card
            gym={gym}
            key={gym.id}
            onPress={handleModalPress}
          />
        ))}
        <View className="w-full items-center">
          <Text
            className="text-center text-neutral-500 text-xs"
          >
            Photos © UT Recreational Sports
          </Text>
        </View>
      </ScrollView>

      <FullWindowOverlay>
        <BottomSheetModal
          ref={sheetRef}
          snapPoints={snapPoints}
          onChange={handleSheetChanges}
          onDismiss={onDismiss}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: '#111111', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
          handleIndicatorStyle={{ backgroundColor: 'white', width: '10%', height: 5 }}
          enableDynamicSizing={false}
        >
          <BottomSheetScrollView>
            <View className="px-7 pt-3">
              <View className="w-full h-[220px] rounded-2xl overflow-hidden bg-neutral-900 border border-[#262626] items-center justify-center">
                <Image
                  source={selectedGym?.hero_image_url}
                  style={{ width: '100%', height: '100%' }}
                  transition={120}
                />
              </View>
              <ScrollView>
                <Text className="text-white text-4xl mt-4 font-bold">{selectedGym?.name}</Text>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="time-outline" size={15} color="#BF5700" />
                  <Text className="text-[#BF5700] text-lg font-bold"> {isFacilityOpen(selectedGym?.hours) ? "Open" : "Closed"}</Text>
                </View>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="location-sharp" size={14} color="#9CAEAF" />
                  <Text className="text-gray-400 text-sm"> {selectedGym?.addr}</Text>
                </View>
                <View className="h-[1px] w-full bg-[#262626] mt-4"></View>
                <Text className="text-white text-xl mt-3">{selectedGym?.general_info}</Text>
                <View className="bg-[#262626] w-full rounded-2xl overflow-hidden mt-5">
                  <Text className="text-white text-2xl font-bold pt-3 px-4">
                    Regular Facility Hours
                  </Text>

                  <HoursRow label="M–Th" value={selectedGym?.hours?.mon} />
                  <View className="h-[1px] bg-white/10 mx-5" />

                  <HoursRow label="Fri" value={selectedGym?.hours?.fri} />
                  <View className="h-[1px] bg-white/10 mx-5" />

                  <HoursRow label="Sat" value={selectedGym?.hours?.sat} />
                  <View className="h-[1px] bg-white/10 mx-5" />

                  <HoursRow label="Sun" value={selectedGym?.hours?.sun} />
                </View>

                <Text className="text-white text-2xl mt-4 font-bold">Facility Activities</Text>
                <View className="flex-row flex-wrap justify-between mt-2">
                  {selectedGym?.facility_activities?.map((item, index) => (
                    <ActivityChip key={`${item}-${index}`} label={item} />
                  ))}
                </View>

                <Text className="text-white text-2xl font-bold mt-1">Features</Text>
                <View className="flex-row flex-wrap justify-between mt-2">
                  {selectedGym?.facility_features?.map((item, index) => (
                    <ActivityChip key={`${item}-${index}`} label={item} />
                  ))}
                </View>
              </ScrollView>
            </View>
          </BottomSheetScrollView>
        </BottomSheetModal>
      </FullWindowOverlay>
    </View>
  );
}


// --- Sub-components moved outside for performance ---

const Card = ({ gym, onPress }: { gym: FacilityWithHours; onPress: (gym: FacilityWithHours) => void }) => {
  const scale = useSharedValue(1);
  const rStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isOpen = isFacilityOpen(gym.hours);
  const openStyle = isOpen ? "text-[#2FBF71] text-4xl" : "text-[#E5533D] text-4xl"
  return (
    <AnimatedPressable
      style={rStyle}
      onPressIn={() => { scale.value = withTiming(0.95, { duration: 80 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 100 }); }}
      className="w-full min-h-[80px] bg-[#111111] rounded-2xl border border-[#262626] px-4 mt-1 flex-row items-center justify-between mb-4"
      onPress={() => onPress(gym)}
    >
      <View>
        <Text className="text-white pb-1 text-xl font-bold">{gym.name}</Text>
        <View className="flex-row items-center" >
          <View className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: isOpen ? '#2FBF71' : '#E5533D' }} />
          <Text className="text-neutral-400 text-sm font-semibold">
            {isOpen ? 'Open ' : 'Closed '}
          </Text>
          <Text className="text-neutral-400 text-sm">
            {isOpen ? 'for 5 minutes' : ''}
          </Text>
        </View>

      </View>
      <Text className={openStyle}>▶</Text>
    </AnimatedPressable>
  );
}

const ScanCard = ({ onPress }: { onPress: () => void }) => {
  const scale = useSharedValue(1);
  const rStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      style={rStyle}
      onPressIn={() => { scale.value = withTiming(0.95, { duration: 80 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 100 }); }}
      className="w-full h-24 bg-[#BF5700] rounded-2xl border border-[#262626] px-5 mt-1 flex-row items-center justify-between mb-4"
      onPress={onPress}
    >
      <Text className="text-white pb-1 text-2xl font-bold">Scan In</Text>
      <Ionicons name="qr-code-outline" color="white" size={40} />
    </AnimatedPressable>
  );
}

const HoursRow = ({ label, value }: { label: string; value?: string | null }) => {
  const intervals = parseIntervals(value);
  const isClosed = intervals.length === 0;

  return (
    <View className="flex-row justify-between px-5 py-3">
      {/* Left: day label */}
      <Text className="text-white font-bold w-16">{label}</Text>

      {/* Right: stacked intervals */}
      <View className="flex-1 items-end">
        {isClosed ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
            }}
          >
            <Text className="text-white text-xs" style={{ opacity: 0.85 }}>
              Closed
            </Text>
          </View>
        ) : (
          intervals.map((t, i) => (
            <Text
              key={`${label}-${i}`}
              className="text-white"
              style={{
                opacity: 0.95,
                marginTop: i === 0 ? 0 : 6, // spacing between stacked lines
              }}
            >
              {t}
            </Text>
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
