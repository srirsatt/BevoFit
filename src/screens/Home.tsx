import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, Appearance, useColorScheme } from 'react-native';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatInTimeZone } from 'date-fns-tz';
import { useDemoMode } from '../contexts/DemoModeContext';
import * as Application from 'expo-application';

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
function isTimeInRange(currentTime: string, hoursString: string): { isOpen: boolean, minutesLeft: number | null } {
  // Parse "10:00 AM - 11:00 PM" format
  const match = hoursString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);

  if (!match) return { isOpen: false, minutesLeft: null };

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
    const minCheck = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    if (minCheck) {
      let minutesLeft: number;
      if (currentMinutes >= openMinutes) {
        minutesLeft = (24 * 60 - currentMinutes) + closeMinutes;
      } else {
        minutesLeft = closeMinutes - currentMinutes;
      }
      return { isOpen: true, minutesLeft }
    } else {
      return { isOpen: false, minutesLeft: null }
    }
  }

  const minCheck = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  if (minCheck) {
    return { isOpen: true, minutesLeft: closeMinutes - currentMinutes }
  } else {
    return { isOpen: false, minutesLeft: null }
  }
}

// helper function for today's reports from AsyncStor

function getTodayKey(): string {
  const today = new Date().toISOString().split('T')[0];
  return `busyness_${today}`;
}

// check today's on device reports
async function getTodayReports(): Promise<Record<string, number>> {
  const key = getTodayKey();
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return {};
  return JSON.parse(raw);
}

async function saveBusynessReport(facilityId: string, level: number): Promise<boolean> {
  const reports = await getTodayReports();

  // Save (one report per gym, overwrites if already exists)
  reports[facilityId] = level;

  await AsyncStorage.setItem(getTodayKey(), JSON.stringify(reports));
  return true;
}

// check if a gym has a saved report
async function getSavedReport(facilityId: string): Promise<number | null> {
  const reports = await getTodayReports();
  return reports[facilityId] ?? null;
}

// Main function to check if facility is currently open
export function isFacilityOpen(hours: FacilityHours | null | undefined): { isOpen: boolean, minutesLeft: number | null } {
  if (!hours) return { isOpen: false, minutesLeft: null };

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
      if (hours.special_hours.toLowerCase() === 'closed') return { isOpen: false, minutesLeft: null };
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
    return { isOpen: false, minutesLeft: null };
  }

  // 6. Parse hours and check if current time is in range
  const intervals = parseIntervals(todayHours);
  for (const interval of intervals) {
    const result = isTimeInRange(currentTime, interval);

    if (result.isOpen) return result;
  }

  return { isOpen: false, minutesLeft: null };
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

async function upsertBusynessreport(facilityId: string, deviceId: string, level: number) {
  const { error } = await supabase
    .from('busyness_reports')
    .upsert({
      facility_id: facilityId,
      device_id: deviceId,
      busyness: level,
      timestamp: new Date().toISOString(),
    },
      { onConflict: 'facility_id, device_id' }
    );

  if (error) {
    console.error('Error upserting busyness:', error);
  }
}

// fetch busyness from supabase for current ratings (mean)
async function getFacilityBusyness(facilityId: string): Promise<number | null> {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('busyness_reports')
    .select('busyness')
    .eq('facility_id', facilityId)
    .gte('timestamp', thirtyMinAgo);

  if (error) {
    console.error('Error fetching busyness:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const avg = data.reduce((sum, report) => sum + report.busyness, 0) / data.length;
  return Math.round(avg);
}


export function Home() {
  const [gyms, setGyms] = useState<FacilityWithHours[]>([]);
  const [gymsLoading, setGymsLoading] = useState(true);
  const [gymsError, setGymsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tapCount, setTapCount] = useState(0); // for demo mode
  const { isDemoMode, setIsDemoMode } = useDemoMode();

  // Reactive selected gym state
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const selectedGym = useMemo(() => gyms.find(g => g.id === selectedGymId), [gyms, selectedGymId]);

  // Busyness reporting
  const [selectedBusyness, setSelectedBusyness] = useState<number | null>(null);

  const sheetRef = useRef<BottomSheetModal>(null);
  const isPresentingRef = useRef(false);
  const snapPoints = useMemo(() => ['90%'], []);

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [communityBusyness, setCommunityBusyness] = useState<number | null>(null);

  // setup a state variable for on device light/dark

  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';


  const handleModalPress = useCallback(async (gym: FacilityWithHours) => {
    if (isPresentingRef.current) return;

    isPresentingRef.current = true;
    setSelectedGymId(gym.id);
    setSelectedBusyness(null);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sheetRef.current?.present();

    // Load saved report AFTER modal is shown
    const saved = await getSavedReport(gym.id);
    if (saved !== null) setSelectedBusyness(saved);

    // Fetch community busyness from Supabase
    const community = await getFacilityBusyness(gym.id);
    setCommunityBusyness(community);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    let isMounted = true;
    loadGyms(isMounted);
    setTimeout(() => {
      setRefreshing(false);
    }, 250);
    return () => { isMounted = false; };
  }, []);

  async function loadGyms(isMounted: boolean) {
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

  useEffect(() => {
    let isMounted = true;
    async function init() {
      const deviceId = await Application.getIosIdForVendorAsync();
      if (isMounted) {
        setDeviceId(deviceId);
        loadGyms(isMounted);
      }
    }
    init();
    return () => { isMounted = false; };
  }, []);

  /*
  useEffect(() => {
    const loadDemoMode = async () => {
      try {
        const value = await AsyncStorage.getItem('demoMode');
        if (value === 'true') {
          setIsDemoMode(true);
        }
      } catch (error) {
        console.log("error loading demo", error);
      }
    };

    loadDemoMode();
  }, []);
  */

  const _handleButtonPressAsync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await WebBrowser.warmUpAsync();
    let link = "https://secure.rs.utexas.edu/app/myrecsports/scan.php";
    if (isDemoMode) {
      link = "https://srirsatt.github.io/BevoFit/demoQR.html";
    }
    await WebBrowser.openBrowserAsync(link, {
      dismissButtonStyle: 'close',
      enableDefaultShareMenuItem: false,
    });
  }

  const enableDemoMode = async () => {
    setIsDemoMode(true);
    setTapCount(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const disableDemoMode = async () => {
    setIsDemoMode(false);
    setTapCount(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

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
          backgroundColor: isDarkMode ? '#15161A' : '#F3F4F6',
          borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <Text
          className="text-gray-900 dark:text-white text-center font-semibold uppercase"
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
    <View style={[styles.container, { paddingTop: insets.top }]} className="bg-gray-50 dark:bg-black">
      <View className="w-full px-5 mt-4">
        <Text className="text-black dark:text-white text-3xl">welcome to</Text>
        <Pressable
          onPress={() => {
            console.log("Clicked");

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTapCount(prev => prev + 1);
            if (tapCount >= 4) {
              if (isDemoMode) {
                Alert.alert(
                  "Demo Mode",
                  "Demo mode is currently enabled. Disable it?",
                  [
                    {
                      text: "Cancel",
                      onPress: () => setTapCount(0),
                      style: "cancel"
                    },
                    {
                      text: "Disable",
                      onPress: disableDemoMode,
                      style: "destructive"
                    }
                  ]
                );
              } else {
                Alert.alert(
                  "Demo Mode",
                  "Enable demo mode? This shows sample data for App Store reviewers.",
                  [
                    {
                      text: "Cancel",
                      onPress: () => setTapCount(0),
                      style: "cancel"
                    },
                    {
                      text: "Enable",
                      onPress: enableDemoMode
                    }
                  ]
                );
              }
            }
          }}
        >
          <Text className="text-[#BF5700] text-6xl mt-2 font-extrabold">BevoFit</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{
          paddingBottom: insets.bottom + 55
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {gymsLoading && <Text className="text-gray-500 dark:text-neutral-500 text-xs uppercase mt-2 mb-2">Gyms Loading...</Text>}

        {!gymsLoading && gyms.length > 0 && (
          <Text className="text-gray-500 dark:text-neutral-500 text-xs uppercase mt-2 mb-2">Gyms</Text>
        )}

        <ScanCard onPress={_handleButtonPressAsync} />
        { }
        {gyms.sort((a, b) => Number(isFacilityOpen(b.hours).isOpen) - Number(isFacilityOpen(a.hours).isOpen)).map((gym) => (
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
          backgroundStyle={{ backgroundColor: isDarkMode ? '#111111' : '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
          handleIndicatorStyle={{ backgroundColor: isDarkMode ? 'white' : '#D4D4D4', width: '10%', height: 5 }}
          enableDynamicSizing={false}
        >
          <BottomSheetScrollView>
            <View className="px-7 pt-3">
              <View className="w-full h-[220px] rounded-2xl overflow-hidden bg-gray-100 dark:bg-neutral-900 border border-[#E5E5E5] dark:border-[#262626] items-center justify-center">
                <Image
                  source={selectedGym?.hero_image_url}
                  style={{ width: '100%', height: '100%' }}
                  transition={120}
                />
              </View>
              <ScrollView>
                <Text className="text-gray-900 dark:text-white text-4xl mt-4 font-bold">{selectedGym?.name}</Text>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="time-outline" size={15} color="#BF5700" />
                  <Text className="text-[#BF5700] text-lg font-bold">
                    {' '}{isFacilityOpen(selectedGym?.hours).isOpen ? "Open" : "Closed"}
                    {communityBusyness !== null && (
                      <Text
                        style={{
                          color: communityBusyness <= 1 ? '#2FBF71'
                            : communityBusyness <= 2 ? '#F5A623'
                              : communityBusyness <= 3 ? '#E87040'
                                : '#E5533D',
                        }}
                      >
                        {' · ' + (communityBusyness <= 1 ? 'Not Busy'
                          : communityBusyness <= 2 ? 'Moderately Busy'
                            : communityBusyness <= 3 ? 'Busy'
                              : 'Extremely Busy')}
                      </Text>
                    )}
                  </Text>
                </View>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="location-sharp" size={14} color="#9CAEAF" />
                  <Text className="text-gray-500 dark:text-gray-400 text-sm"> {selectedGym?.addr}</Text>
                </View>
                <View className="h-[1px] w-full bg-[#E5E5E5] dark:bg-[#262626] mt-4"></View>
                {/* Busyness Reporting UI */}
                <Text className="text-gray-900 dark:text-white text-lg font-bold mt-4">Crowd?</Text>
                <View className="flex-row justify-between mt-2">
                  {[
                    { level: 1, emoji: '😁', label: 'Empty', color: '#2FBF71' },
                    { level: 2, emoji: '🙂', label: 'Moderate', color: '#F5A623' },
                    { level: 3, emoji: '😐', label: 'Busy', color: '#E87040' },
                    { level: 4, emoji: '😔', label: 'Packed', color: '#E5533D' },
                  ].map((option) => (
                    <Pressable
                      key={option.level}
                      disabled={selectedBusyness !== null}
                      onPress={async () => {
                        if (!selectedGym) return;
                        const success = await saveBusynessReport(selectedGym.id, option.level);
                        if (success) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedBusyness(option.level);

                          // upsert to Supabase
                          if (deviceId) {
                            upsertBusynessreport(selectedGym.id, deviceId, option.level);
                          }
                        } else {
                          Alert.alert("limit reached bud");
                        }

                      }}
                      className="items-center rounded-xl py-2 px-1"
                      style={{
                        width: '23%',
                        opacity: selectedBusyness !== null && selectedBusyness !== option.level ? 0.35 : 1,
                        backgroundColor: selectedBusyness === option.level
                          ? option.color + '20'
                          : isDarkMode ? '#1A1A1A' : '#F3F4F6',
                        borderWidth: selectedBusyness === option.level ? 1.5 : 1,
                        borderColor: selectedBusyness === option.level
                          ? option.color
                          : isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{option.emoji}</Text>
                      <Text
                        className="text-center font-semibold mt-1"
                        style={{
                          fontSize: 10,
                          color: selectedBusyness === option.level
                            ? option.color
                            : isDarkMode ? '#AAAAAA' : '#666666',
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {selectedBusyness && (
                  <Text className="text-gray-500 dark:text-neutral-500 text-xs mt-2">Thanks for reporting!</Text>
                )}
                <View className="h-[1px] w-full bg-[#E5E5E5] dark:bg-[#262626] mt-4"></View>

                <Text className="text-gray-900 dark:text-white text-xl mt-3">{selectedGym?.general_info}</Text>
                <View className="bg-gray-100 dark:bg-[#262626] w-full rounded-2xl overflow-hidden mt-5">
                  <Text className="text-gray-900 dark:text-white text-2xl font-bold pt-3 px-4">
                    Regular Facility Hours
                  </Text>

                  <HoursRow label="M–Th" value={selectedGym?.hours?.mon} isDarkMode={isDarkMode} />
                  <View className="h-[1px] bg-black/10 dark:bg-white/10 mx-5" />

                  <HoursRow label="Fri" value={selectedGym?.hours?.fri} isDarkMode={isDarkMode} />
                  <View className="h-[1px] bg-black/10 dark:bg-white/10 mx-5" />

                  <HoursRow label="Sat" value={selectedGym?.hours?.sat} isDarkMode={isDarkMode} />
                  <View className="h-[1px] bg-black/10 dark:bg-white/10 mx-5" />

                  <HoursRow label="Sun" value={selectedGym?.hours?.sun} isDarkMode={isDarkMode} />
                </View>

                <Text className="text-gray-900 dark:text-white text-2xl mt-4 font-bold">Facility Activities</Text>
                <View className="flex-row flex-wrap justify-between mt-2">
                  {selectedGym?.facility_activities?.map((item, index) => (
                    <ActivityChip key={`${item}-${index}`} label={item} />
                  ))}
                </View>

                <Text className="text-gray-900 dark:text-white text-2xl font-bold mt-1">Features</Text>
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
  const { isOpen, minutesLeft } = isFacilityOpen(gym.hours);
  const openStyle = isOpen ? "text-[#2FBF71] text-4xl" : "text-[#E5533D] text-4xl"

  let timeDisplay = '';
  if (minutesLeft != null) {
    const hours = Math.floor(minutesLeft / 60);
    const mins = minutesLeft % 60;

    if (hours == 1 && mins > 0) {
      timeDisplay = `${hours} hour and ${mins} minutes`;
    } else if (hours == 1) {
      timeDisplay = `${hours} hour`;
    } else if (hours > 0 && mins > 0) {
      timeDisplay = `${hours} hours and ${mins} minutes`;
    } else if (hours > 0) {
      timeDisplay = `${hours} hours`;
    } else {
      timeDisplay = `${mins} minutes`;
    }
  }
  return (
    <AnimatedPressable
      style={rStyle}
      onPressIn={() => { scale.value = withTiming(0.95, { duration: 80 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 100 }); }}
      className="w-full min-h-[80px] bg-white dark:bg-[#111111] rounded-2xl border border-[#E5E5E5] dark:border-[#262626] px-4 mt-1 flex-row items-center justify-between mb-4"
      onPress={() => onPress(gym)}
    >
      <View>
        <Text className="text-black dark:text-white pb-1 text-xl font-bold">{gym.name}</Text>
        <View className="flex-row items-center" >
          <View className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: isOpen ? '#2FBF71' : '#E5533D' }} />
          <Text className="text-black dark:text-neutral-400 text-sm font-semibold">
            {isOpen ? 'Open ' : 'Closed '}
          </Text>
          <Text className="text-black dark:text-neutral-400 text-sm">
            {isOpen && timeDisplay ? `for ${timeDisplay}` : ''}
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
      className="w-full h-24 bg-[#BF5700] rounded-2xl border border-[#E5E5E5] dark:border-[#262626] px-5 mt-1 flex-row items-center justify-between mb-4"
      onPress={onPress}
    >
      <Text className="text-white pb-1 text-2xl font-bold">Scan In</Text>
      <Ionicons name="qr-code-outline" color="white" size={40} />
    </AnimatedPressable>
  );
}

const HoursRow = ({ label, value, isDarkMode }: { label: string; value?: string | null; isDarkMode: boolean }) => {
  const intervals = parseIntervals(value);
  const isClosed = intervals.length === 0;

  return (
    <View className="flex-row justify-between px-5 py-3">
      {/* Left: day label */}
      <Text className="text-gray-900 dark:text-white font-bold w-16">{label}</Text>

      {/* Right: stacked intervals */}
      <View className="flex-1 items-end">
        {isClosed ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <Text className="text-gray-900 dark:text-white text-xs" style={{ opacity: 0.85 }}>
              Closed
            </Text>
          </View>
        ) : (
          intervals.map((t, i) => (
            <Text
              key={`${label}-${i}`}
              className="text-gray-900 dark:text-white"
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
  container: { flex: 1 },
});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
