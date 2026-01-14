import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import MapView, { Marker, Callout } from 'react-native-maps';
import { FullWindowOverlay } from 'react-native-screens';
import { StyleSheet, View, Text } from 'react-native';
import { supabase } from '../lib/supabase';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';

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

    // variables for bottomsheetmodal
    const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
    const selectedFacility = useMemo(() => pins.find(p => p.id === selectedFacilityId), [pins, selectedFacilityId]);

    const sheetRef = useRef<BottomSheetModal>(null);
    const isPresentingRef = useRef(false);
    const snapPoints = useMemo(() => ['40%'], []);


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

    const renderBackdrop = (props: any) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    );

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
                onRegionChangeComplete={(region) => {
                    console.log("Centering", region.latitude, region.longitude);
                    console.log("Zoom deltas", region.latitudeDelta, region.longitudeDelta);
                }}
            >



                {pins.map((f) => (
                    <Marker
                        key={f.id}
                        coordinate={{ latitude: f.lat, longitude: f.lng }}
                        onPress={() => handleMarkerPress(f)}

                    />
                ))}

            </MapView>

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
                    <Text className="text-white font-large">Hello WOrld</Text>

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