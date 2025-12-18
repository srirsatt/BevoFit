import React from 'react';
import MapView from 'react-native-maps';
import { StyleSheet, View } from 'react-native';


export function Map() {
    return (
        <View style={styles.container}>
            <MapView 
                style={styles.map} 
                initialRegion={{
                    latitude: 30.284566,
                    longitude: -97.735673,
                    latitudeDelta: 0.0125,
                    longitudeDelta: 0.0125,
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