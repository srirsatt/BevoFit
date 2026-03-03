// tabs for classic tabs -> versions older than ios 26

import React from 'react';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Pressable, useColorScheme, GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
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

function HapticTabButton({ onPress, ref: _ref, ...rest }: BottomTabBarButtonProps) {
    const handlePress = (e: GestureResponderEvent) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.(e);
    };
    return <Pressable onPress={handlePress} {...rest} />;
}

export default function ClassicTabs() {
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                animation: 'fade',
                tabBarActiveTintColor: "#BF5700",
                tabBarInactiveTintColor: isDarkMode ? '#888888' : '#999999',
                tabBarStyle: {
                    backgroundColor: isDarkMode ? '#0F0F12' : '#FFFFFF',
                    borderTopColor: isDarkMode ? '#262626' : '#E5E5E5',
                    height: 75,
                    paddingBottom: 20,
                },
                tabBarLabelStyle: {
                    marginTop: 3,
                },
                tabBarButton: (props) => <HapticTabButton {...props} />,
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