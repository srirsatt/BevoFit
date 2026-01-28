import { Text, View, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';

type IntramuralStructure = {
    id: number;
    category: string;
    event_name: string;
    event_fee: string;
    reg_dates: string;
    event_dates: string;
};

export async function getIntramurals() {
    const { data, error } = await supabase
        .from('intramurals')
        .select('*')

    if (error) throw error;
    return data;
};

export function Intramurals() {

    const insets = useSafeAreaInsets();
    const intramuralInfo = "The Intramural Sports program provides competitive and recreational sports leagues, " +
        "tournaments, and special events for all students, regardless of skill level."
    const [intramurals, setIntramurals] = useState<IntramuralStructure[]>([]);
    const [intramuralsLoading, setIntramuralsLoading] = useState(true);
    const [intramuralsError, setIntramuralsError] = useState<string | null>(null);


    async function loadIntramurals(isMounted: boolean) {
        try {
            const facilities = await getIntramurals();

            const initialIntramurals = facilities.map((f) => {
                return { ...f }
            });

            if (isMounted) {
                setIntramurals(initialIntramurals);
                setIntramuralsLoading(false);
            }

        } catch (e: any) {
            console.error("Error in loadIntramurals: ", e);
            if (isMounted) {
                setIntramuralsError(e.message);
                setIntramuralsLoading(false);
            }
        }
    }

    useEffect(() => {
        let isMounted = true;
        loadIntramurals(isMounted);
        return () => { isMounted = false; };
    }, []);


    const IMLeaguesCard = ({ onPress }: { onPress: () => void }) => {
        const scale = useSharedValue(1);
        const rStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

        return (
            <AnimatedPressable
                style={rStyle}
                onPressIn={() => { scale.value = withTiming(0.95, { duration: 80 }); }}
                onPressOut={() => { scale.value = withTiming(1, { duration: 100 }); }}
                className="w-full h-24 bg-[#BF5700] rounded-2xl border border-[#262626] px-5 mt-1 flex-row items-center justify-between mb-4"
                onPress={onPress}
            >
                <Text className="text-white pb-1 text-2xl font-bold">IMLeagues</Text>
                <Ionicons name="people-outline" color="white" size={40} />
            </AnimatedPressable>
        );
    }

    const CalendarCard = () => {
        return (
            <View
                className="w-full p-5 bg-[#111111] rounded-2xl"
            >
                <Text className="text-white">{intramurals.length}</Text>
            </View>
        )
    }

    const _handleButtonPressAsync = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        await WebBrowser.warmUpAsync();

        await WebBrowser.openBrowserAsync("https://www.imleagues.com/Shibboleth.sso/Login?target=https%3a%2f%2fwww.imleagues.com%2fIntegration%2fShibboleth%2fSingleSignOn.aspx%3fType%3dSHI%26SchID%3d4e7db0d3e9cc46a581a8a8da95bb5d56&entityID=https%3a%2f%2fenterprise.login.utexas.edu%2fidp%2fshibboleth", {
            dismissButtonStyle: 'close',
            enableDefaultShareMenuItem: false,
        });
    }


    return (
        <View
            style={{
                flex: 1,
                backgroundColor: 'black',
                paddingTop: insets.top,
            }}
        >
            <View className="w-full px-5 mt-4 mb-2">
                <Text className="text-white text-5xl mt-2 font-extrabold">Intramurals</Text>
            </View>
            <ScrollView
                className="flex-1 px-5"
                contentContainerStyle={{
                    paddingBottom: insets.bottom + 55
                }}
            >
                {intramuralsLoading && <Text className="text-neutral-500 text-xs uppercase mt-2 mb-2">Events Loading...</Text>}
                {!intramuralsLoading && intramurals.length > 0 && (<Text className="text-neutral-500 text-xs uppercase mt-2 mb-2">Events</Text>)}
                <IMLeaguesCard onPress={_handleButtonPressAsync} />
                <CalendarCard />
            </ScrollView>
        </View>
    )
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);