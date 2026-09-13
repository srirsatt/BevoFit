import { AppState, StyleSheet, Text, View, ScrollView, useWindowDimensions, Pressable, useColorScheme, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { formatCalendarDate, getCalendarClock, getCalendarWeek, sortClassesFromCurrentTime } from '../lib/calendarTime';
import type { ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useFacilities } from '../hooks/useFacilities';
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
import * as WebBrowser from 'expo-web-browser';
import { useDemoMode } from '../contexts/DemoModeContext';
import { BottomSheetModal, BottomSheetFlatList, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { FullWindowOverlay } from 'react-native-screens';


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

type WeekAtGlanceDay = {
    day: Weekday;
    date: Date;
    classes: CalendarClass[];
    isCurrentMonth: boolean;
    isCurrentWeek: boolean;
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
const SCREEN_TOP_PADDING = 24;
const SCREEN_BOTTOM_PADDING = 80;
const WEEKDAYS: Weekday[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

const BlankCard = ({ width }: { width: number; }) => {
    return (
        <View
            style={{ width, height: CARD_HEIGHT }}
            className="w-full bg-white dark:bg-[#0D0D0F] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2D] px-5 py-4 mt-1 items-center justify-center"
        >
            <Text className="text-gray-900 dark:text-white text-3xl font-extrabold text-center">
                No classes today!
            </Text>
            <Text className="text-gray-500 dark:text-neutral-500 text-base font-semibold text-center mt-2">
                Check out IMLeagues or TeXercise for more!
            </Text>
        </View>
    )

}

function formatWeekRange(start: Date, end: Date) {
    const format = (date: Date) => `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
    return `${format(start)} - ${format(end)}`;
}

function getWeekAtGlanceDays(classes: CalendarClass[], today: Date) {
    return getCalendarWeek(today).map((date, index) => {
        const day = WEEKDAYS[index];
        const isCurrentMonth = date.getUTCMonth() === today.getUTCMonth();

        return {
            day,
            date,
            isCurrentMonth,
            isCurrentWeek: true,
            classes: classes
                .filter((classItem) => normalizeDay(classItem.day) === normalizeDay(day))
                .sort((a, b) => a.startMinutes - b.startMinutes),
        };
    });
}

const WeekAtGlanceCard = ({
    days,
    today,
    onSelectDay,
}: {
    days: WeekAtGlanceDay[];
    today: Date;
    onSelectDay: (day: WeekAtGlanceDay) => void;
}) => {
    const isDarkMode = useColorScheme() === 'dark';
    const monthLabel = formatCalendarDate(today, {
        month: "long",
        year: "numeric",
    });
    const weekStart = days[0]?.date ?? today;
    const weekEnd = days[days.length - 1]?.date ?? today;

    return (
        <View className="bg-white dark:bg-[#0D0D0F] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2D] px-5 pt-5 pb-8 mb-4">
            <View className="flex-row items-start justify-between">
                <Text className="text-gray-900 dark:text-white text-2xl font-extrabold">
                    {monthLabel}
                </Text>
                <Text className="text-gray-500 dark:text-neutral-500 text-xs uppercase font-extrabold mt-2">
                    Current week
                </Text>
            </View>

            <Text className="text-gray-500 dark:text-neutral-500 text-sm font-bold mt-2 mb-8">
                {formatWeekRange(weekStart, weekEnd)}
            </Text>

            <View className="flex-row -mx-3">
                {days.map((dayItem) => {
                    const isToday = dayItem.date.getTime() === today.getTime();
                    const classCount = dayItem.classes.length;
                    return (
                        <Pressable
                            key={`${dayItem.day}-${dayItem.date.toISOString()}`}
                            accessibilityRole="button"
                            accessibilityLabel={`${isToday ? 'Today, ' : ''}${formatCalendarDate(dayItem.date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${classCount} ${classCount === 1 ? 'class' : 'classes'}`}
                            accessibilityHint="Opens this day's events"
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onSelectDay(dayItem);
                            }}
                            className="flex-1 items-center py-1"
                        >
                            {({ pressed }) => (
                                <>
                                    <Text
                                        className="text-gray-500 dark:text-neutral-500 text-xs font-semibold text-center mb-3"
                                    >
                                        {dayItem.day[0]}
                                    </Text>
                                    <View className="h-12 w-full items-center justify-center">
                                        <View
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 18,
                                                backgroundColor: isToday
                                                    ? pressed ? '#D4650A' : BURNT_ORANGE
                                                    : isDarkMode
                                                        ? pressed ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)'
                                                        : pressed ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.035)',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {classCount > 0 ? (
                                                <Text
                                                    className="text-lg font-semibold text-center"
                                                    style={{ color: isToday || isDarkMode ? '#FFFFFF' : '#404040' }}
                                                >
                                                    {classCount}
                                                </Text>
                                            ) : (
                                                <View
                                                    className="w-1 h-1 rounded-full"
                                                    style={{ backgroundColor: isToday ? '#FFFFFF' : isDarkMode ? '#737373' : '#A3A3A3' }}
                                                />
                                            )}
                                        </View>
                                    </View>
                                </>
                            )}
                        </Pressable>
                    );
                })}
            </View>
            <Text className="text-gray-500 dark:text-neutral-500 text-xs text-center mt-4">
                Tap a day's number to view that day's classes.
            </Text>
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
    const [currentMinute, setCurrentMinute] = useState(() => Math.floor(Date.now() / 60000));
    const clock = useMemo(() => getCalendarClock(new Date(currentMinute * 60000)), [currentMinute]);
    // Refresh without another network request. Focus/foreground updates also
    // catch midnight or clock changes while this screen was inactive.
    useFocusEffect(useCallback(() => {
        const refreshClock = () => setCurrentMinute(Math.floor(Date.now() / 60000));
        refreshClock();
        let timer: ReturnType<typeof setTimeout>;
        const scheduleTick = () => {
            timer = setTimeout(() => {
                refreshClock();
                scheduleTick();
            }, 60000 - Date.now() % 60000);
        };
        if (AppState.currentState === 'active') scheduleTick();
        const subscription = AppState.addEventListener('change', state => {
            clearTimeout(timer);
            if (state === 'active') {
                refreshClock();
                scheduleTick();
            }
        });
        return () => {
            clearTimeout(timer);
            subscription.remove();
        };
    }, []));
    const [calendarClasses, setCalendarClasses] = useState<CalendarClass[]>([]);
    const scrollX = useSharedValue(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { markers: facilities, refresh: refreshFacilities } = useFacilities();
    const [selectedWeekDay, setSelectedWeekDay] = useState<WeekAtGlanceDay | null>(null);
    const [visibleClassRange, setVisibleClassRange] = useState<{ first: number; last: number } | null>(null);
    const weekSheetRef = useRef<BottomSheetModal>(null);
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === "dark";
    const inactiveDotColor = isDarkMode ? "#525252" : "#D4D4D4";
    const { width } = useWindowDimensions();
    const cardWidth = width - 40;
    const cardGap = 12;
    const snapInterval = cardWidth + cardGap;
    const { isDemoMode, setIsDemoMode } = useDemoMode();
    const weekSheetSnapPoints = useMemo(() => ["70%"], []);
    const calendarDate = useMemo(() => new Date(`${clock.dateKey}T00:00:00Z`), [clock.dateKey]);
    const weekAtGlanceDays = useMemo(() => getWeekAtGlanceDays(calendarClasses, calendarDate), [calendarClasses, calendarDate]);
    useEffect(() => {
        setSelectedWeekDay(previous => previous
            ? weekAtGlanceDays.find(day => day.day === previous.day) ?? null
            : null);
    }, [weekAtGlanceDays]);
    const weekViewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
    const onWeekClassesVisible = useCallback(({ viewableItems }: { viewableItems: ViewToken<CalendarClass>[] }) => {
        const indices = viewableItems.flatMap((item) => item.index === null ? [] : [item.index]);
        setVisibleClassRange(indices.length > 0
            ? { first: Math.min(...indices) + 1, last: Math.max(...indices) + 1 }
            : null);
    }, []);

    const renderWeekSheetBackdrop = useCallback((props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ), []);

    const openWeekDaySheet = useCallback((day: WeekAtGlanceDay) => {
        setVisibleClassRange(null);
        setSelectedWeekDay(day);
        weekSheetRef.current?.present();
    }, []);


    const _handleIMPressAsync = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        await WebBrowser.warmUpAsync();
        let link = "https://www.imleagues.com/Shibboleth.sso/Login?target=https%3a%2f%2fwww.imleagues.com%2fIntegration%2fShibboleth%2fSingleSignOn.aspx%3fType%3dSHI%26SchID%3d4e7db0d3e9cc46a581a8a8da95bb5d56&entityID=https%3a%2f%2fenterprise.login.utexas.edu%2fidp%2fshibboleth";
        if (isDemoMode) {
            link = "https://sriramsattiraju.com/IMleaguesimg";
        }
        await WebBrowser.openBrowserAsync(link, {
            dismissButtonStyle: 'close',
            enableDefaultShareMenuItem: false,
        });
    }

    const _handleTexPressAsync = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        await WebBrowser.warmUpAsync();
        let link = "https://apps.rs.utexas.edu/app/myrecsports/texercise/";
        if (isDemoMode) {
            link = "https://sriramsattiraju.com/TeXerciseimg";
        }
        await WebBrowser.openBrowserAsync(link, {
            dismissButtonStyle: 'close',
            enableDefaultShareMenuItem: false,
        });
    }

    const loadClasses = useCallback(async ({ showLoading = false } = {}) => {
        if (showLoading) {
            setLoading(true);
        }

        try {
            const { data, error } = await supabase
                .from("classes")
                .select("id, day, time, name, studio, instructor, activity_type")


            if (error) {
                console.error("[Calendar] Supabase classes query failed", error);
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
            if (showLoading) {
                setLoading(false);
            }
        }
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                loadClasses(),
                refreshFacilities(true),
            ]);
        } finally {
            setRefreshing(false);
        }
    }, [loadClasses, refreshFacilities]);

    useEffect(() => {
        loadClasses({ showLoading: true });
    }, [loadClasses]);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollX.value = event.contentOffset.x;
        },
    });

    const insets = useSafeAreaInsets();

    const today = normalizeDay(WEEKDAYS[clock.weekday]);

    const todayClasses = sortClassesFromCurrentTime(calendarClasses
        .filter((item) => normalizeDay(item.day) === today)
        .sort((a, b) => a.startMinutes - b.startMinutes), clock.minutes);
    // filtering by Dates from supabase!

    const todayClassCount = todayClasses.length;
    const hasTodayClasses = todayClassCount > 0;

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
                paddingTop: insets.top + SCREEN_TOP_PADDING,
            }}
            className="bg-white dark:bg-black"
        >
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingBottom: insets.bottom + SCREEN_BOTTOM_PADDING,
                }}
                automaticallyAdjustContentInsets={false}
                contentInsetAdjustmentBehavior="never"
                contentInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
                scrollIndicatorInsets={{ top: 0, bottom: 0, left: 0, right: 0 }}
                bounces
                alwaysBounceVertical
                overScrollMode="always"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={BURNT_ORANGE}
                        colors={[BURNT_ORANGE]}
                    />
                }
            >
                <View className="w-full px-5">
                    <Text className="text-gray-900 dark:text-white text-5xl font-extrabold">Calendar</Text>

                    {loading && (
                        <Text className="text-gray-500 dark:text-neutral-500 text-xs uppercase mt-2 mb-2">Loading...</Text>
                    )}

                    {!loading && (
                        <Text className="text-gray-500 dark:text-neutral-500 text-xs uppercase mt-2 mb-2">Today's Events</Text>
                    )}

                    <AnimatedScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        snapToInterval={cardWidth + cardGap}
                        snapToAlignment="start"
                        decelerationRate="fast"
                        disableIntervalMomentum
                        scrollEnabled={hasTodayClasses}
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
                        style={{ width, height: CARD_HEIGHT + 32, flexGrow: 0, marginLeft: -20, marginTop: 2 }}
                        contentContainerStyle={{ paddingTop: 0, paddingBottom: 8, paddingHorizontal: 20 }}
                    >
                        {hasTodayClasses ? (
                            todayClasses.map((calClass) => (
                                <View key={calClass.id} style={{ marginRight: cardGap }}>
                                    <CalendarCard classItem={calClass} width={cardWidth} facilities={facilities} />
                                </View>
                            ))
                        ) : (
                            !loading && (
                                <View style={{ marginRight: cardGap }}>
                                    <BlankCard width={cardWidth} />
                                </View>
                            )
                        )}

                    </AnimatedScrollView>

                    {hasTodayClasses ? (
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
                    ) : (
                        !loading && (
                            <View
                                style={{
                                    width: DOT_WINDOW_WIDTH,
                                    alignSelf: "center",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginTop: -14,
                                }}
                            >
                                {Array.from({ length: VISIBLE_DOTS }).map((_, index) => (
                                    <View
                                        key={index}
                                        style={{
                                            width: DOT_SIZE,
                                            height: DOT_SIZE,
                                            borderRadius: DOT_SIZE / 2,
                                            marginRight: index === VISIBLE_DOTS - 1 ? 0 : DOT_GAP,
                                            opacity: index === 0 || index === VISIBLE_DOTS - 1 ? 0.45 : 1,
                                            transform: [{
                                                scale: index === Math.floor(VISIBLE_DOTS / 2)
                                                    ? 1.2
                                                    : index === 0 || index === VISIBLE_DOTS - 1
                                                        ? 0.65
                                                        : 1
                                            }],
                                            backgroundColor: index === Math.floor(VISIBLE_DOTS / 2) ? BURNT_ORANGE : inactiveDotColor,
                                        }}
                                    />
                                ))}
                            </View>
                        )
                    )}

                    <View className="flex-row gap-3 mt-5 mb-4">
                        <OrangeCard onPress={_handleIMPressAsync} text='IMLeagues' iconName='medal-outline' />
                        <OrangeCard onPress={_handleTexPressAsync} text='TeXercise' iconName='body-outline' />
                    </View>

                    {!loading && (
                        <Text className="text-gray-500 dark:text-neutral-500 text-xs uppercase mt-1.3 mb-3">This Week at a glance</Text>
                    )}

                    <WeekAtGlanceCard days={weekAtGlanceDays} today={calendarDate} onSelectDay={openWeekDaySheet} />
                </View>
            </ScrollView>

            <FullWindowOverlay>
                <BottomSheetModal
                    ref={weekSheetRef}
                    snapPoints={weekSheetSnapPoints}
                    backdropComponent={renderWeekSheetBackdrop}
                    backgroundStyle={{ backgroundColor: isDarkMode ? '#0D0D0F' : '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
                    handleIndicatorStyle={{ backgroundColor: isDarkMode ? 'white' : '#D4D4D4', width: '10%', height: 5 }}
                    enableDynamicSizing={false}
                >
                    <View className="px-7 pt-3 pb-5">
                        <Text className="text-gray-900 dark:text-white text-3xl font-extrabold">
                            {selectedWeekDay?.day}
                        </Text>
                        <Text className="text-gray-500 dark:text-neutral-400 text-base mt-1">
                            {selectedWeekDay && formatCalendarDate(selectedWeekDay.date, { month: "long", day: "numeric" })}
                        </Text>
                        <Text className="text-[#BF5700] text-sm font-semibold mt-3">
                            {selectedWeekDay?.classes.length ?? 0} {(selectedWeekDay?.classes.length ?? 0) === 1 ? "class" : "classes"} scheduled
                        </Text>
                    </View>
                    <View className="h-px mx-7 bg-[#E5E5E5] dark:bg-[#2A2A2D]" />
                    <BottomSheetFlatList<CalendarClass>
                        key={selectedWeekDay?.date.toDateString() ?? 'empty'}
                        data={selectedWeekDay?.classes ?? []}
                        keyExtractor={(item: CalendarClass) => item.id}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 12, flexGrow: 1 }}
                        showsVerticalScrollIndicator
                        indicatorStyle={isDarkMode ? 'white' : 'black'}
                        viewabilityConfig={weekViewabilityConfig}
                        onViewableItemsChanged={onWeekClassesVisible}
                        ItemSeparatorComponent={() => <View className="h-px bg-[#E5E5E5] dark:bg-[#2A2A2D]" />}
                        ListEmptyComponent={
                            <View className="flex-1 items-center justify-center py-8">
                                <Ionicons name="calendar-outline" size={28} color={isDarkMode ? '#737373' : '#A3A3A3'} />
                                <Text className="text-gray-900 dark:text-white text-lg font-semibold mt-3">No classes scheduled</Text>
                                <Text className="text-gray-500 dark:text-neutral-400 text-sm text-center mt-2">Choose another day to see what's on.</Text>
                            </View>
                        }
                        renderItem={({ item }: { item: CalendarClass }) => (
                            <View className="flex-row items-start py-5">
                                <View className="w-24 pr-3">
                                    <Text className="text-gray-900 dark:text-neutral-200 text-sm font-semibold">{item.startLabel}</Text>
                                    <Text className="text-gray-500 dark:text-neutral-500 text-xs mt-1">{item.endLabel}</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-gray-900 dark:text-white text-lg font-bold">{item.name}</Text>
                                    <Text className="text-gray-500 dark:text-neutral-400 text-sm mt-1">{translateStudioName(item.studio)}</Text>
                                </View>
                            </View>
                        )}
                    />
                    {(selectedWeekDay?.classes.length ?? 0) > 0 && (
                        <View
                            className="border-t border-[#E5E5E5] dark:border-[#2A2A2D] px-7 pt-3"
                            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
                        >
                            <Text className="text-gray-500 dark:text-neutral-400 text-xs text-center">
                                {visibleClassRange
                                    ? `${visibleClassRange.first === visibleClassRange.last ? visibleClassRange.first : `${visibleClassRange.first}–${visibleClassRange.last}`} of ${selectedWeekDay?.classes.length} ${selectedWeekDay?.classes.length === 1 ? 'class' : 'classes'}`
                                    : `${selectedWeekDay?.classes.length} ${selectedWeekDay?.classes.length === 1 ? 'class' : 'classes'}`}
                            </Text>
                        </View>
                    )}
                </BottomSheetModal>
            </FullWindowOverlay>
        </View>
    )
}


const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
