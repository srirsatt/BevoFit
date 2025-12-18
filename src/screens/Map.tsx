import React from 'react';
import MapView from 'react-native-maps';
import { StyleSheet, View } from 'react-native';


export function Map() {
    return (
        <View style={styles.container}>
            <MapView 
                style={styles.map} 
                initialRegion={{
                    latitude: 30.286465125666073,
                    longitude: -97.73765808557216,
                    latitudeDelta: 0.013753447601704494,
                    longitudeDelta: 0.00881609046538756,
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