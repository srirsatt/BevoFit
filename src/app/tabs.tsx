// tabs for classic tabs -> versions older than ios 26

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// import our screens
import { Home } from '../screens/Home';
import { Intramurals } from '../screens/Intramurals';
import { Map } from '../screens/Map';


type TabParamList = {
    Home: undefined;
    Intramurals: undefined;
    Map: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function ClassicTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false
            }}
        >
            <Tab.Screen name="Home" component={Home}></Tab.Screen>
            <Tab.Screen name="Intramurals" component={Intramurals}></Tab.Screen>
            <Tab.Screen name="Map" component={Map}></Tab.Screen>
        </Tab.Navigator>
    )
}