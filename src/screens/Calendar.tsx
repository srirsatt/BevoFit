import { StyleSheet, Text, View, ScrollView, useWindowDimensions, Pressable, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
    useSharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    interpolate,
    interpolateColor,
    Extrapolation,
    withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { getFacilityForStudio } from '../lib/facilities';
import { FacilityMarker } from '../lib/facilities';
import { showLocation } from 'react-native-map-link';
import * as Haptics from "expo-haptics";


type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
type ClassRow = {
    id: string;
    day: string;
    time: string;
    name: string;
    studio: string;
    instructor: string;
    activity_type: string;
    // supabase structure
};

type Weekday =
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";

// CalendarClass for cards
type CalendarClass = {
    id: string;
    day: string;
    name: string;
    studio: string;
    instructor: string;
    activityType: string;


    timeLabel: string;
    startLabel: string;
    endLabel: string;

    startMinutes: number;
    endMinutes: number;
    durationMinutes: number;
};

const DOT_SIZE = 6;
const DOT_GAP = 6;
const VISIBLE_DOTS = 5;
const DOT_STEP = DOT_SIZE + DOT_GAP;
const DOT_WINDOW_WIDTH = VISIBLE_DOTS * DOT_STEP;
const BURNT_ORANGE = "#BF5700";
const CARD_HEIGHT = 220;
const TITLE_HEIGHT = 65;
const DETAILS_HEIGHT = 70;
const FOOTER_HEIGHT = 60;

function parseTimeToMinutes(time: string): number {
    const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    if (!match) {
        throw new Error(`Invalid time format from ${time}`);
    }

    const [, hourString, minuteString, period] = match;

    let hours = Number(hourString);
    const minutes = Number(minuteString);

    if (period.toUpperCase() === "PM" && hours !== 12) {
        hours += 12;
    }

    if (period.toUpperCase() === "AM" && hours === 12) {
        hours = 0;
    }

    return hours * 60 + minutes;
}


function parseClassTimeRange(timeRange: string) {
    const [startLabel, endLabel] = timeRange
        .split("-")
        .map((part) => part.trim());

    const startMinutes = parseTimeToMinutes(startLabel);
    const endMinutes = parseTimeToMinutes(endLabel);

    return {
        startLabel,
        endLabel,
        startMinutes,
        endMinutes,
        durationMinutes: endMinutes - startMinutes,
    };
}

function normalizeDay(day: string) {
    const value = day.trim().toLowerCase();

    if (value === "mon") return "monday";
    if (value === "tue" || value === "tues") return "tuesday";
    if (value === "wed") return "wednesday";
    if (value === "thu" || value === "thur" || value === "thurs") return "thursday";
    if (value === "fri") return "friday";
    if (value === "sat") return "saturday";
    if (value === "sun") return "sunday";

    return value;
}

function getDayCounts(classes: CalendarClass[]) {
    return classes.reduce<Record<string, number>>((counts, item) => {
        const normalizedDay = normalizeDay(item.day);
        counts[normalizedDay] = (counts[normalizedDay] ?? 0) + 1;
        return counts;
    }, {});
}

function getInstructorInitials(instructor: string) {
    return instructor
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

function toCalendarClass(row: ClassRow): CalendarClass {
    const parsedTime = parseClassTimeRange(row.time);
    return {
        id: row.id,
        day: row.day,
        name: row.name,
        studio: row.studio,
        instructor: row.instructor,
        activityType: row.activity_type,


        timeLabel: row.time,
        startLabel: parsedTime.startLabel,
        endLabel: parsedTime.endLabel,

        startMinutes: parsedTime.startMinutes,
        endMinutes: parsedTime.endMinutes,
        durationMinutes: parsedTime.durationMinutes,
    };
}

function translateStudioName(studio: string) {
    const studioMap: Record<string, string> = {
        GRE: "Gregory Gym",
        RSC: "Rec Sports Center",
    };

    const [code, ...rest] = studio.trim().split(/\s+/);
    const translatedCode = studioMap[code] ?? code;

    return [translatedCode, ...rest].join(" ");
}

// TBD checker for diff pfp




const CalendarCard = ({ classItem, width, facilities }: { classItem: CalendarClass; width: number; facilities: FacilityMarker[] }) => {
    const scale = useSharedValue(1);
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === "dark";
    const isInstructorTBD = classItem.instructor.trim().toLowerCase() === "instructor tbd";
    const instructorInitials = isInstructorTBD ? "?" : getInstructorInitials(classItem.instructor);
    const facility = getFacilityForStudio(classItem.studio, facilities);
    const [titleLineCount, setTitleLineCount] = useState(1);

    const openClassDirections = async () => {
        if (!facility) return;

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        setTimeout(() => {
            showLocation({
                address: facility.addr,
                latitude: facility.lat,
                longitude: facility.lng,
                directionsMode: "walk",
                title: facility.name,
                appsWhiteList: ["apple-maps"],
            });
        }, 40);
    };

    // what should the card look like!



    /*

    Name
    Time
    Location
    Instructor

    */

    // no press behavior

    // autotranslate - RSC - rec sports center by location
    // GRE - gregory by location

    return (
        <View
            style={{ width, height: CARD_HEIGHT }}
            className="w-full bg-white dark:bg-[#0D0D0F] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2D] px-5 py-4 mt-1"
        >
            <View className="flex-1">
                <View style={{ height: TITLE_HEIGHT }}>
                    <Text
                        className="text-gray-900 dark:text-white text-2xl font-extrabold"
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.65}
                        onTextLayout={(event) => {
                            setTitleLineCount(event.nativeEvent.lines.length);
                        }}
                    >
                        {classItem.name}
                    </Text>
                    {titleLineCount === 1 && (
                        <Text
                            style={{ marginTop: 5 }}
                            className="text-gray-500 dark:text-neutral-500 text-md font-semibold-mt-1"
                            numberOfLines={1}
                        >
                            {classItem.activityType}
                        </Text>
                    )}
                </View>

                <View className="h-px bg-[#E5E5E5] dark:bg-[#2C2C30]" />

                <View
                    style={{ height: DETAILS_HEIGHT }}
                    className="flex-row items-center"
                >
                    <View className="flex-1">
                        <View className="flex-row items-center">
                            <Ionicons name="time-outline" color="#A3A3A3" size={20} />
                            <Text
                                className="text-gray-800 dark:text-neutral-200 text-base font-semibold ml-3"
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                            >
                                {classItem.timeLabel}
                            </Text>
                        </View>

                        <View className="flex-row items-center mt-2">
                            <Ionicons name="location-sharp" color="#A3A3A3" size={20} />
                            <Text
                                className="text-gray-600 dark:text-neutral-400 text-base font-medium ml-3"
                                numberOfLines={1}
                            >
                                {translateStudioName(classItem.studio)}
                            </Text>
                        </View>
                    </View>
                </View>

                <View className="h-px bg-[#E5E5E5] dark:bg-[#2C2C30]" />

                <View
                    style={{ height: FOOTER_HEIGHT }}
                    className="flex-row items-center justify-between"
                >
                    <View className="flex-row items-center flex-1 pr-3">
                        <View
                            style={{ backgroundColor: isInstructorTBD ? "#3F3F46" : BURNT_ORANGE }}
                            className="w-11 h-11 rounded-full items-center justify-center"
                        >
                            <Text className={`text-white ${isInstructorTBD ? "text-lg" : "text-sm"} font-extrabold`}>
                                {instructorInitials}
                            </Text>
                        </View>

                        <View className="ml-3 flex-1">
                            <Text
                                className="text-gray-800 dark:text-neutral-200 text-base font-medium"
                                numberOfLines={1}
                            >
                                {classItem.instructor}
                            </Text>
                            <Text className="text-gray-500 dark:text-neutral-500 text-xs font-semibold uppercase">
                                Instructor
                            </Text>
                        </View>
                    </View>

                    <Pressable
                        onPress={openClassDirections}
                        disabled={!facility}
                        className={`w-11 h-11 rounded-xl border items-center justify-center bg-white dark:bg-transparent ${facility
                            ? "border-[#D4D4D4] dark:border-[#525252]"
                            : "border-[#E5E5E5] dark:border-[#333333] opacity-40"
                            }`}
                    >
                        <View style={{ transform: [{ rotate: "45deg" }] }}>
                            <Ionicons name="arrow-up-outline" size={20} color={isDarkMode ? "#F5F5F5" : "#171717"} />
                        </View>
                    </Pressable>
                </View>
            </View>

        </View>
    )


}

const OrangeCard = ({ onPress, text, iconName }: { onPress: () => void; text: string; iconName: IoniconName }) => {
    const scale = useSharedValue(1);
    const rStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
        <AnimatedPressable
            style={rStyle}
            onPressIn={() => { scale.value = withTiming(0.95, { duration: 80 }); }}
            onPressOut={() => { scale.value = withTiming(1, { duration: 100 }); }}
            className="flex-1 h-20 bg-[#BF5700] rounded-2xl border border-[#E5E5E5] dark:border-[#262626] px-5 flex-row items-center justify-between"
            onPress={onPress}
        >
            <Text className="text-white text-xl font-bold" numberOfLines={1}>
                {text}
            </Text>
            <Ionicons name={iconName} color="white" size={30} />
        </AnimatedPressable>
    );
}

function AnimatedDot({
    index,
    totalCount,
    scrollX,
    snapInterval,
    inactiveColor,
}: {
    index: number;
    totalCount: number;
    scrollX: SharedValue<number>;
    snapInterval: number;
    inactiveColor: string;
}) {
    const animatedStyle = useAnimatedStyle(() => {
        const progress = scrollX.value / snapInterval;
        const centeredOffset = Math.floor(VISIBLE_DOTS / 2);
        const maxWindowStart = Math.max(totalCount - VISIBLE_DOTS, 0);
        const windowStart = Math.min(Math.max(progress - centeredOffset, 0), maxWindowStart);
        const positionInWindow = index - windowStart;
        const distanceFromActive = Math.abs(index - progress);

        const windowOpacity = interpolate(
            positionInWindow,
            [-1, 0, 1, VISIBLE_DOTS - 2, VISIBLE_DOTS - 1, VISIBLE_DOTS],
            [0, 0.45, 1, 1, 0.45, 0],
            Extrapolation.CLAMP
        );

        const windowScale = interpolate(
            positionInWindow,
            [-1, 0, 1, VISIBLE_DOTS - 2, VISIBLE_DOTS - 1, VISIBLE_DOTS],
            [0, 0.65, 1, 1, 0.65, 0],
            Extrapolation.CLAMP
        );

        const activeScale = interpolate(
            distanceFromActive,
            [0, 1, 2],
            [1.2, 1, 0],
            Extrapolation.CLAMP
        );

        const backgroundColor = interpolateColor(
            distanceFromActive,
            [0, 1],
            [BURNT_ORANGE, inactiveColor]
        );

        const activeOpacity = interpolate(
            distanceFromActive,
            [0, 1],
            [1, 0],
            Extrapolation.CLAMP
        );

        return {
            opacity: Math.max(windowOpacity, activeOpacity),
            transform: [{ scale: Math.max(windowScale, activeScale) }],
            backgroundColor,
        };
    });

    return (
        <Animated.View
            style={[{
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: DOT_SIZE / 2,
                marginRight: DOT_GAP,
                backgroundColor: inactiveColor,
            }, animatedStyle]}
        />
    );
}

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);


export function Calendar() {
    const [calendarClasses, setCalendarClasses] = useState<CalendarClass[]>([]);
    const scrollX = useSharedValue(0);
    const [loading, setLoading] = useState(true);
    const [facilities, setFacilities] = useState<FacilityMarker[]>([]);
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === "dark";
    const inactiveDotColor = isDarkMode ? "#525252" : "#D4D4D4";
    const { width } = useWindowDimensions();
    const cardWidth = width - 40;
    const cardGap = 12;
    const snapInterval = cardWidth + cardGap;

    useEffect(() => {
        async function loadClasses() {
            setLoading(true);

            try {
                const { data, error } = await supabase
                    .from("classes")
                    .select("id, day, time, name, studio, instructor, activity_type")


                if (error) {
                    console.error("[Calendar] Supabase classes query failed", error);
                    setLoading(false);
                    return;
                }


                console.log("[Calendar] Supabase classes loaded", {
                    rowCount: data?.length ?? 0,
                });

                const calendarCardObjects: CalendarClass[] = (data ?? [])
                    .flatMap((row) => {
                        try {
                            return [toCalendarClass(row)];
                        } catch (err) {
                            console.error("[Calendar] Skipping class with invalid data", {
                                row,
                                error: err,
                            });
                            return [];
                        }
                    })
                    .sort((a, b) => a.startMinutes - b.startMinutes);

                console.log("[Calendar] Calendar cards prepared", {
                    cardCount: calendarCardObjects.length,
                    skippedCount: (data?.length ?? 0) - calendarCardObjects.length,
                    dayCounts: getDayCounts(calendarCardObjects),
                });

                setCalendarClasses(calendarCardObjects);
            } catch (err) {
                console.error("[Calendar] Unexpected error while loading classes", err);
            } finally {
                setLoading(false);
            }
        }
        loadClasses();
    }, []);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollX.value = event.contentOffset.x;
        },
    });

    const insets = useSafeAreaInsets();

    const today = normalizeDay(
        new Date().toLocaleDateString("en-US", {
            weekday: "long",
        })
    ); // Monday - Sunday declaration

    const todayClasses = calendarClasses
        .filter((item) => normalizeDay(item.day) === today)
        .sort((a, b) => a.startMinutes - b.startMinutes);
    // filtering by Dates from supabase!

    const todayClassCount = todayClasses.length;

    useEffect(() => {
        if (loading) {
            console.log("[Calendar] Loading classes");
            return;
        }

        if (calendarClasses.length === 0) {
            console.warn("[Calendar] No class cards were created from Supabase rows");
            return;
        }

        if (todayClassCount === 0) {
            console.warn("[Calendar] No class cards match today's day filter", {
                today,
                totalCards: calendarClasses.length,
                dayCounts: getDayCounts(calendarClasses),
            });
        }
    }, [calendarClasses, loading, today, todayClassCount]);

    useEffect(() => {
        async function loadFacilities() {
            const { data, error } = await supabase
                .from("facilities")
                .select("id, name, lat, lng, general_info, addr")
                .not("lat", "is", null)
                .not("lng", "is", null);

            if (error) {
                console.error("cal err loading faciliites", error);
                setFacilities([]);
                return;
            }

            setFacilities((data ?? []) as FacilityMarker[]);
        }

        loadFacilities();
    }, []);

    const animatedDotRowStyle = useAnimatedStyle(() => {
        const progress = scrollX.value / snapInterval;
        const centeredOffset = Math.floor(VISIBLE_DOTS / 2);
        const maxWindowStart = Math.max(todayClassCount - VISIBLE_DOTS, 0);
        const windowStart = Math.min(Math.max(progress - centeredOffset, 0), maxWindowStart);
        const translateX = -windowStart * DOT_STEP;

        return {
            transform: [{ translateX }],
        };
    });

    /*
    console.log("all classes", calendarClasses.length);
    console.log("today", today);
    console.log("today classes", todayClasses.length);
    console.log("days", calendarClasses.map((item) => item.day));

    */


    return (
        <View
            style={{
                flex: 1,
                paddingTop: insets.top,
            }}
            className="bg-white dark:bg-black"
        >
            <View className="flex-1 w-full px-5 mt-4 mb-2">
                <Text className="text-gray-900 dark:text-white text-5xl mt-2 font-extrabold">Calendar</Text>

                {loading && (
                    <Text className="text-gray-500 dark:text-neutral-500 text-xs uppercase mt-2 mb-2">Loading...</Text>
                )}

                {!loading && todayClasses.length > 0 && (
                    <Text className="text-gray-500 dark:text-neutral-500 text-xs uppercase mt-2 mb-2">Today's Events</Text>
                )}

                <AnimatedScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={cardWidth + cardGap}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    disableIntervalMomentum
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    style={{ width, height: CARD_HEIGHT + 32, flexGrow: 0, marginLeft: -20, marginTop: 2 }}
                    contentContainerStyle={{ paddingTop: 0, paddingBottom: 8, paddingHorizontal: 20 }}
                >
                    {todayClasses.map((calClass) => (
                        <View key={calClass.id} style={{ marginRight: cardGap }}>
                            <CalendarCard classItem={calClass} width={cardWidth} facilities={facilities} />
                        </View>
                    ))}

                </AnimatedScrollView>

                <View
                    style={{
                        width: DOT_WINDOW_WIDTH,
                        overflow: "visible",
                        alignSelf: "center",
                        marginTop: -14,
                    }}
                >
                    <Animated.View
                        style={[
                            {
                                flexDirection: "row",
                                alignItems: "center",
                            },
                            animatedDotRowStyle,
                        ]}
                    >
                        {todayClasses.map((item, index) => (
                            <AnimatedDot
                                key={item.id}
                                index={index}
                                totalCount={todayClassCount}
                                scrollX={scrollX}
                                snapInterval={snapInterval}
                                inactiveColor={inactiveDotColor}
                            />
                        ))}

                    </Animated.View>
                </View>

                <View className="flex-row gap-3 mt-5 mb-4">
                    <OrangeCard onPress={() => { }} text='IMLeagues' iconName='medal-outline' />
                    <OrangeCard onPress={() => { }} text='TeXercise' iconName='body-outline' />
                </View>
            </View>
        </View>
    )
}


const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
