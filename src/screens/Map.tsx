import React, { useEffect, useState } from 'react';
import MapView, { Marker, Callout } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import { supabase } from '../lib/supabase';


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
};


export function Map() {
    const [pins, setPins] = useState<FacilityMarker[]>([]);
    // empty arr to start
    const [loading, setLoading] = useState(true);

    // enter pins from supabase to pins array on load, then map them on succesful load
    useEffect(() => {
        let isMounted = true;
        async function loadPins() {
            setLoading(true);

            const { data, error } = await supabase
                .from("facilities")
                .select("id, name, lat, lng")
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
                    latitude: 30.28684350735148,
                    longitude: -97.73702845323676,
                    latitudeDelta: 0.01624097636879185,
                    longitudeDelta: 0.0104106601780245,
                }}
            >
                {
                /*
                onRegionChangeComplete ={(region) => {
                    console.log("Centering", region.latitude, region.longitude);
                    console.log("Zoom deltas", region.latitudeDelta, region.longitudeDelta);
                }}
                    was for debug -> finding good map coords
                */
                }
                {pins.map((f) => (
                    <Marker 
                        key={f.id}
                        coordinate={{ latitude: f.lat, longitude: f.lng}}
                        title={f.name}
                        onPress={() => console.log("clicked on ", f.name)}
                    
                    />
                ))}
      
            </MapView>
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