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
import { useDemoMode } from '../contexts/DemoModeContext';

type IntramuralStructure = {
    id: number;
    category: string;
    event_name: string;
    event_fee: string;
    reg_dates: string;
    event_dates: string;
};

type IntramuralEvent = {
    event_name: string;
    reg_dates: string;
    event_fee: string;
    event_dates: string;
};

type eventMap = Map<string, IntramuralEvent[]>

export async function getIntramurals() {
    const { data, error } = await supabase
        .from('intramurals')
        .select('*')

    if (error) throw error;
    return data;
};



export function Calendar() {
    const insets = useSafeAreaInsets();
    const intramuralInfo = "The Intramural Sports program provides competitive and recreational sports leagues, " +
        "tournaments, and special events for all students, regardless of skill level."
    const [intramurals, setIntramurals] = useState<IntramuralStructure[]>([]);
    const [events, setEvents] = useState<eventMap>();
    const [intramuralsLoading, setIntramuralsLoading] = useState(true);
    const [intramuralsError, setIntramuralsError] = useState<string | null>(null);
    const { isDemoMode } = useDemoMode();



    function groupIntramuralsByCategory(intramurals: IntramuralStructure[]) {
        // load the map in events

        const map = new Map<string, IntramuralEvent[]>();

        for (const intramural of intramurals) {
            const event: IntramuralEvent = {
                event_name: intramural.event_name,
                reg_dates: intramural.reg_dates,
                event_fee: intramural.event_fee,
                event_dates: intramural.event_dates,
            };


            if (map.has(intramural.category)) {
                map.get(intramural.category)!.push(event);
            } else {
                map.set(intramural.category, [event]);
            }

        }

        setEvents(map);
    }


    async function loadIntramurals(isMounted: boolean) {
        try {
            const facilities = await getIntramurals();

            const initialIntramurals = facilities.map((f) => {
                return { ...f }
            });

            if (isMounted) {
                setIntramurals(initialIntramurals);
                groupIntramuralsByCategory(initialIntramurals);
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

    useEffect(() => {

    })


    const IMLeaguesCard = ({ onPress }: { onPress: () => void }) => {
        const scale = useSharedValue(1);
        const rStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

        return (
            <AnimatedPressable
                style={rStyle}
                onPressIn={() => { scale.value = withTiming(0.95, { duration: 80 }); }}
                onPressOut={() => { scale.value = withTiming(1, { duration: 100 }); }}
                className="w-full h-24 bg-[#BF5700] rounded-2xl border border-[#E5E5E5] dark:border-[#262626] px-5 mt-1 flex-row items-center justify-between mb-4"
                onPress={onPress}
            >
                <Text className="text-white pb-1 text-2xl font-bold">IMLeagues</Text>
                <Ionicons name="people-outline" color="white" size={40} />
            </AnimatedPressable>
        );
    }

    const CalendarCard = () => {
        return (
            <>
                {events && Array.from(events.entries()).map(([eventString, eventArray]) => (
                    <View
                        key={eventString}
                        className="w-full bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#E5E5E5] dark:border-[#262626] mb-4 overflow-hidden"
                    >
                        {/* Category Header */}
                        <View className="bg-gray-100 dark:bg-[#2a2a2a] px-4 py-4 border-b border-[#E5E5E5] dark:border-[#262626]">
                            <Text className="text-gray-900 dark:text-white text-2xl font-bold">{eventString}</Text>
                        </View>

                        {/* Table Header */}
                        <View className="flex flex-row bg-gray-50 dark:bg-[#222222] px-4 py-3 border-b border-[#E5E5E5] dark:border-[#333333]">
                            <Text className="text-gray-500 dark:text-neutral-400 font-semibold text-xs flex-1 text-center">EVENT</Text>
                            <Text className="text-gray-500 dark:text-neutral-400 font-semibold text-xs flex-1 text-center">EVENT DATE</Text>
                            <Text className="text-gray-500 dark:text-neutral-400 font-semibold text-xs flex-1 text-center">FEE</Text>
                        </View>

                        {/* Event Rows */}
                        {eventArray.map((event, index) => (
                            <View
                                key={index}
                                className={`flex flex-row px-4 py-3.5 ${index !== eventArray.length - 1 ? 'border-b border-[#E5E5E5] dark:border-[#2a2a2a]' : ''}`}
                            >
                                <Text className="text-gray-900 dark:text-white text-sm flex-1 text-center">{event.event_name}</Text>
                                <Text className="text-gray-900 dark:text-white text-sm flex-1 text-center">{event.event_dates}</Text>
                                <Text className="text-gray-900 dark:text-white text-sm flex-1 text-center">{event.event_fee}</Text>
                            </View>
                        ))}
                    </View>
                ))}
            </>
        )
    }

    const _handleButtonPressAsync = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        await WebBrowser.warmUpAsync();

        let link = "https://www.imleagues.com/Shibboleth.sso/Login?target=https%3a%2f%2fwww.imleagues.com%2fIntegration%2fShibboleth%2fSingleSignOn.aspx%3fType%3dSHI%26SchID%3d4e7db0d3e9cc46a581a8a8da95bb5d56&entityID=https%3a%2f%2fenterprise.login.utexas.edu%2fidp%2fshibboleth";

        if (isDemoMode) {
            link = "https://www.imleagues.com/spa/intramural/4e7db0d3e9cc46a581a8a8da95bb5d56/home";
        }

        await WebBrowser.openBrowserAsync(link, {
            dismissButtonStyle: 'close',
            enableDefaultShareMenuItem: false,
        });
    }


    return (
        <View
            style={{
                flex: 1,
                paddingTop: insets.top,
            }}
            className="bg-white dark:bg-black"
        >
            <View className="w-full px-5 mt-4 mb-2">
                <Text className="text-gray-900 dark:text-white text-5xl mt-2 font-extrabold">Calendar</Text>
            </View>
            <ScrollView
                className="flex-1 px-5"
                contentContainerStyle={{
                    paddingBottom: insets.bottom + 55
                }}
            >
                {intramuralsLoading && <Text className="text-gray-500 dark:text-neutral-500 text-xs uppercase mt-2 mb-2">Events Loading...</Text>}
                {!intramuralsLoading && events && events.size > 0 && (<Text className="text-gray-500 dark:text-neutral-500 text-xs uppercase mt-2 mb-2">Events</Text>)}
                <IMLeaguesCard onPress={_handleButtonPressAsync} />
                <CalendarCard />
            </ScrollView>
        </View>
    )
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);