import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';


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

export function Calendar() {
    const [calendarClasses, setCalendarClasses] = useState<CalendarClass[]>([]);
    const [loading, setLoading] = useState(true);

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

            const calendarCardObjects: CalendarClass[] = (data ?? [])
                .map(toCalendarClass)
                .sort((a, b) => a.startMinutes - b.startMinutes);

            setCalendarClasses(calendarCardObjects);
            setLoading(false);
        }
        loadClasses();
    }, []);

    const insets = useSafeAreaInsets();

    const today = new Date().toLocaleDateString("en-US", { 
        weekday: "long",
    }); // Monday - Sunday declaration

    const todayClasses = calendarClasses
        .filter((item) => item.day === today)
        .sort((a, b) => a.startMinutes - b.startMinutes);
    // filtering by Dates from supabase!

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
        </View>
    )
}