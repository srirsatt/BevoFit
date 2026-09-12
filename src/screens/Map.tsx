import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import MapView, { Marker, Callout } from 'react-native-maps';
import { FullWindowOverlay } from 'react-native-screens';
import { StyleSheet, View, Text, Pressable, useColorScheme } from 'react-native';
import { supabase } from '../lib/supabase';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { showLocation } from 'react-native-map-link';
import { useRouter } from 'expo-router';
import { usableWalkingOrigin, walkingMinutes, type WalkingOrigin } from '../lib/walkingTime';

/*
desired facilities:

Bellmont Hall
Caven-Clark Courts
Caven-Clark Track/Turf 
Gregory Gym
Natatorium - Greg
Recreational Sports Center
Whitaker Sports Complex

*/

type FacilityMarker = {
    id: string,
    name: string,
    lat: number,
    lng: number,
    general_info: string,
    addr: string,
};


export function Map() {
    const [pins, setPins] = useState<FacilityMarker[]>([]);
    // empty arr to start
    const [loading, setLoading] = useState(true);
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';

    // variables for bottomsheetmodal
    const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
    const selectedFacility = useMemo(() => pins.find(p => p.id === selectedFacilityId), [pins, selectedFacilityId]);
    const latestOriginRef = useRef<WalkingOrigin | null>(null);
    const [walkMinutes, setWalkMinutes] = useState<number | null>(null);

    useEffect(() => {
        setWalkMinutes(null);
        if (!selectedFacility) return;
        let cancelled = false;
        let pending = false;
        let lastRequestAt = 0;

        const updateWalkingTime = async () => {
            const origin = latestOriginRef.current;
            if (!origin || !usableWalkingOrigin(origin)) {
                setWalkMinutes(null);
                return;
            }
            if (pending || Date.now() - lastRequestAt < 60000) return;
            pending = true;
            lastRequestAt = Date.now();
            const minutes = await walkingMinutes(origin, selectedFacility);
            if (!cancelled) {
                setWalkMinutes(latestOriginRef.current && usableWalkingOrigin(latestOriginRef.current) ? minutes : null);
            }
            pending = false;
        };

        void updateWalkingTime();
        const timer = setInterval(() => { void updateWalkingTime(); }, 5000);
        return () => { cancelled = true; clearInterval(timer); };
    }, [selectedFacility]);

    const sheetRef = useRef<BottomSheetModal>(null);
    const isPresentingRef = useRef(false);
    const snapPoints = useMemo(() => ['45%'], []);
    const directionsScale = useSharedValue(1);
    const directionsStyle = useAnimatedStyle(() => ({ transform: [{ scale: directionsScale.value }] }));
    const closeScale = useSharedValue(1);
    const closeStyle = useAnimatedStyle(() => ({ transform: [{ scale: closeScale.value }] }));


    const handleMarkerPress = useCallback((gym: FacilityMarker) => {
        if (isPresentingRef.current) return;

        isPresentingRef.current = true;
        setSelectedFacilityId(gym.id);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        sheetRef.current?.present();
    }, []);

    const onDismiss = useCallback(() => {
        isPresentingRef.current = false;
        setSelectedFacilityId(null);

    }, []);

    const handleSheetChanges = useCallback((index: number) => {
        if (index === -1) {
            isPresentingRef.current = false;
        }
    }, []);

    // handler for more info button -> moves to modal press from home
    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        sheetRef.current?.dismiss();
    }

    const renderBackdrop = (props: any) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    );

    // directions button press action
    const openDirections = (addr: string | undefined, name: string | undefined) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        showLocation({
            address: addr,
            directionsMode: 'walk',
            title: name,
            appsWhiteList: ['apple-maps']
        });
    }

    // enter pins from supabase to pins array on load, then map them on succesful load
    useEffect(() => {
        let isMounted = true;
        async function loadPins() {
            setLoading(true);

            const { data, error } = await supabase
                .from("facilities")
                .select("id, name, lat, lng, general_info, addr")
                .not("lat", "is", null)
                .not("lng", "is", null);

            if (error) {
                console.error("Error loading facilities from supabase", error);
                if (isMounted) setPins([]); // sets as blank on error
            } else {
                if (isMounted) setPins((data ?? []) as FacilityMarker[]);
            }

            if (isMounted) {
                setLoading(false); // finish loading sequence
            }
        }

        loadPins();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                initialRegion={{
                    latitude: 30.284191170256957,
                    longitude: -97.73406558584728,
                    latitudeDelta: 0.009380758294785352,
                    longitudeDelta: 0.006013015735092608,
                }}
                showsUserLocation={true}
                onUserLocationChange={({ nativeEvent }) => {
                    latestOriginRef.current = nativeEvent.coordinate ?? null;
                }}
                showsMyLocationButton={false}
                onRegionChangeComplete={(region) => {
                    console.log("Centering", region.latitude, region.longitude);
                    console.log("Zoom deltas", region.latitudeDelta, region.longitudeDelta);
                }}
            >



                {pins.map((f) => (
                    <Marker
                        key={f.id}
                        coordinate={{ latitude: f.lat, longitude: f.lng }}
                        onPress={(e) => { handleMarkerPress(f) }}
                        flat={true}
                        stopPropagation={true}
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View style={{
                            width: 36,
                            height: 36,
                            backgroundColor: '#BF5700',
                            borderRadius: 18,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 2,
                            borderColor: 'white'
                        }}>
                            <Ionicons name="barbell" size={20} color="white" />
                        </View>
                    </Marker>
                ))}

            </MapView>

            <FullWindowOverlay>
                <BottomSheetModal
                    ref={sheetRef}
                    onChange={handleSheetChanges}
                    onDismiss={onDismiss}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: isDarkMode ? '#111111' : '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
                    handleIndicatorStyle={{ backgroundColor: isDarkMode ? 'white' : '#D4D4D4', width: '10%', height: 5 }}
                    enableDynamicSizing={true}
                    maxDynamicContentSize={600}
                >
                    <BottomSheetView>
                        <View className="px-6">
                            <Text className="text-gray-900 dark:text-white text-3xl mt-1 font-bold">{selectedFacility?.name}</Text>
                            <View className="flex-row flex-wrap items-center mt-2 gap-y-1">
                                <Ionicons name="location-sharp" size={14} color="#9CAEAF" />
                                <Text className="text-gray-500 dark:text-gray-400 text-sm" style={{ flexShrink: 1 }}> {selectedFacility?.addr}</Text>
                                {walkMinutes !== null && (
                                    <View className="flex-row items-center" accessible accessibilityLabel={`${walkMinutes} minute walk`}>
                                        <View className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 mx-2" />
                                        <Text className="text-gray-500 dark:text-gray-400 text-sm mr-1">{walkMinutes} min</Text>
                                        <Ionicons name="walk-outline" size={14} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                                    </View>
                                )}
                            </View>
                            <View className="h-[1px] w-full bg-[#E5E5E5] dark:bg-[#262626] mt-5"></View>
                            <Text className="text-gray-900 dark:text-white text-xl mt-3">{selectedFacility?.general_info}</Text>
                            <AnimatedPressable
                                style={directionsStyle}
                                className="w-full bg-[#BF5700] h-[49px] mt-5 rounded-xl items-center justify-center"
                                onPressIn={() => { directionsScale.value = withTiming(0.95, { duration: 80 }); }}
                                onPressOut={() => { directionsScale.value = withTiming(1, { duration: 100 }); }}
                                onPress={() => openDirections(selectedFacility?.addr, selectedFacility?.name)}
                            >
                                <Text className="text-white font-bold text-lg ">Directions</Text>
                            </AnimatedPressable>
                            <AnimatedPressable
                                style={closeStyle}
                                className="w-full bg-gray-200 dark:bg-[#262626] h-[49px] mt-3 mb-8 rounded-xl items-center justify-center"
                                onPressIn={() => { closeScale.value = withTiming(0.95, { duration: 80 }); }}
                                onPressOut={() => { closeScale.value = withTiming(1, { duration: 100 }); }}
                                onPress={() => handleClose()}
                            >
                                <Text className="text-gray-900 dark:text-white font-bold text-lg ">Close</Text>
                            </AnimatedPressable>
                        </View>
                    </BottomSheetView>

                </BottomSheetModal>
            </FullWindowOverlay>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    map: {
        width: '100%',
        height: '100%',
    },
});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
