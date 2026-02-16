// tabs for classic tabs -> versions older than ios 26

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from "@expo/vector-icons/Ionicons";

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
                headerShown: false,
                animation: 'fade',
                tabBarActiveTintColor: "#BF5700",
                tabBarStyle: {
                    backgroundColor: '#0F0F12',
                    borderTopColor: "#262626",
                    height: 75,
                    paddingBottom: 20,
                },
                tabBarLabelStyle: {
                    marginTop: 3,
                }
            }}
        >
            <Tab.Screen
                name="Home"
                component={Home}
                options={{
                    tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
                }}
            >
            </Tab.Screen>
            <Tab.Screen
                name="Intramurals"
                component={Intramurals}
                options={{
                    tabBarLabel: 'IM Sports',
                    tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />
                }}
            >
            </Tab.Screen>
            <Tab.Screen
                name="Map"
                component={Map}
                options={{
                    tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />
                }}
            >
            </Tab.Screen>
        </Tab.Navigator>
    )
}