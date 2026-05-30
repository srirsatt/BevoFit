import { StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSharedValue } from 'react-native-reanimated';


type ClassRow = {
    id: string;
    day: string;
    time: string;
    name: string;
    studio: string;
    instructor: string;
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


    timeLabel: string;
    startLabel: string;
    endLabel: string;

    startMinutes: number;
    endMinutes: number;
    durationMinutes: number;
};

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

function toCalendarClass(row: ClassRow): CalendarClass {
    const parsedTime = parseClassTimeRange(row.time);
    return {
        id: row.id,
        day: row.day,
        name: row.name,
        studio: row.studio,
        instructor: row.instructor,


        timeLabel: row.time,
        startLabel: parsedTime.startLabel,
        endLabel: parsedTime.endLabel,

        startMinutes: parsedTime.startMinutes,
        endMinutes: parsedTime.endMinutes,
        durationMinutes: parsedTime.durationMinutes,
    };
}


const CalendarCard = ({ classItem, width }: { classItem: CalendarClass; width: number }) => {
    const scale = useSharedValue(1);

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
            style={{ width }}
            className="w-full min-h-[200px] bg-white dark:bg-[#111111] rounded-2xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-3 mt-1 flex-row items-center"
        >
            <View className="flex-col ">
                <Text className="text-black dark:text-white">{classItem.name}</Text>
                <Text className="text-black dark:text-white">{classItem.timeLabel}</Text>
                <Text className="text-black dark:text-white">{classItem.studio}</Text>
                <Text className="text-black dark:text-white">{classItem.instructor}</Text>
            </View>

        </View>
    )


}


export function Calendar() {
    const [calendarClasses, setCalendarClasses] = useState<CalendarClass[]>([]);
    const [loading, setLoading] = useState(true);
    const { width } = useWindowDimensions();
    const cardWidth = width - 40;
    const cardGap = 12;

    useEffect(() => {
        async function loadClasses() {
            setLoading(true);

            const { data, error } = await supabase
                .from("classes")
                .select("id, day, time, name, studio, instructor")


            if (error) {
                console.error(error);
                setLoading(false);
                return;
            }


            //console.log("supabase row count", data?.length);
            //console.log("supabase raw data", data);

            const calendarCardObjects: CalendarClass[] = (data ?? [])
                .flatMap((row) => {
                    try {
                        return [toCalendarClass(row)];
                    } catch (err) {
                        console.error("Skipping class with invalid data", row, err);
                        return [];
                    }
                })
                .sort((a, b) => a.startMinutes - b.startMinutes);

            setCalendarClasses(calendarCardObjects);
            setLoading(false);
        }
        loadClasses();
    }, []);

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

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={cardWidth + cardGap}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    disableIntervalMomentum
                    style={{ height: 250, flexGrow: 0, marginTop: 2 }}
                    contentContainerStyle={{ paddingVertical: 8 }}
                >
                    {todayClasses.map((calClass) => (
                        <View key={calClass.id} style={{ marginRight: cardGap }}>
                            <CalendarCard classItem={calClass} width={cardWidth} />
                        </View>
                    ))}

                </ScrollView>
            </View>
        </View>
    )
}
