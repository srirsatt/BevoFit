import React from 'react';
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

type FacliityMarker = {
    id: string,
    name: string,
    lat: number,
    lng: number,
}


export function Map() {
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
                onRegionChangeComplete ={(region) => {
                    console.log("Centering", region.latitude, region.longitude);
                    console.log("Zoom deltas", region.latitudeDelta, region.longitudeDelta);
                }}
                
            />
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