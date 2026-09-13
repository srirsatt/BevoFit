export const CALENDAR_TIME_ZONE = 'America/Chicago';

const austinClock = new Intl.DateTimeFormat('en-US', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function getCalendarClock(now: Date = new Date()) {
    const parts = austinClock.formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)!.value);
    // This is a calendar date, encoded at UTC midnight for timezone-independent
    // date arithmetic. It is not the timestamp of midnight in Austin.
    const date = new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
    return {
        date,
        dateKey: date.toISOString().slice(0, 10),
        weekday: date.getUTCDay(),
        minutes: value('hour') * 60 + value('minute'),
    };
}

export function getCalendarWeek(date: Date): Date[] {
    return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(date);
        day.setUTCDate(date.getUTCDate() - date.getUTCDay() + index);
        return day;
    });
}

export function formatCalendarDate(date: Date, options: Intl.DateTimeFormatOptions): string {
    return date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

export function sortClassesFromCurrentTime<T extends { startMinutes: number; endMinutes: number }>(
    classes: T[], currentMinutes: number,
): T[] {
    const sorted = [...classes].sort((a, b) => a.startMinutes - b.startMinutes);
    return [
        ...sorted.filter(item => item.endMinutes > currentMinutes),
        ...sorted.filter(item => item.endMinutes <= currentMinutes),
    ];
}
