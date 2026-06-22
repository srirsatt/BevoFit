import { formatInTimeZone } from 'date-fns-tz';

export type FacilityHours = {
  mon?: string | null;
  tue?: string | null;
  wed?: string | null;
  thu?: string | null;
  fri?: string | null;
  sat?: string | null;
  sun?: string | null;
  special_date?: string | null;   // "YYYY-MM-DD"
  special_hours?: string | null;
};


function convertTo24Hour(hour: number, minute: number, period: string): string {
  let hour24 = hour;

  if (period.toUpperCase() === 'PM' && hour !== 12) {
    hour24 = hour + 12;
  } else if (period.toUpperCase() === 'AM' && hour === 12) {
    hour24 = 0;
  }

  return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function isTimeInRange(currentTime: string, hoursString: string): { isOpen: boolean, minutesLeft: number | null } {
  // Parse "10:00 AM - 11:00 PM" format
  const match = hoursString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);

  if (!match) return { isOpen: false, minutesLeft: null };

  const [_, openHour, openMin, openPeriod, closeHour, closeMin, closePeriod] = match;

  // Convert to 24-hour format
  const openTime = convertTo24Hour(parseInt(openHour), parseInt(openMin), openPeriod);
  const closeTime = convertTo24Hour(parseInt(closeHour), parseInt(closeMin), closePeriod);

  // Current time is already in "HH:mm" 24-hour format
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMin;
  const openMinutes = parseInt(openTime.split(':')[0]) * 60 + parseInt(openTime.split(':')[1]);
  const closeMinutes = parseInt(closeTime.split(':')[0]) * 60 + parseInt(closeTime.split(':')[1]);

  // Handle overnight hours (e.g., 10 PM - 2 AM)
  if (closeMinutes < openMinutes) {
    const minCheck = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    if (minCheck) {
      let minutesLeft: number;
      if (currentMinutes >= openMinutes) {
        minutesLeft = (24 * 60 - currentMinutes) + closeMinutes;
      } else {
        minutesLeft = closeMinutes - currentMinutes;
      }
      return { isOpen: true, minutesLeft }
    } else {
      return { isOpen: false, minutesLeft: null }
    }
  }

  const minCheck = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  if (minCheck) {
    return { isOpen: true, minutesLeft: closeMinutes - currentMinutes }
  } else {
    return { isOpen: false, minutesLeft: null }
  }
}


function parseIntervals(hoursStr?: string | null): string[] {
  if (!hoursStr) return [];
  const s = hoursStr.trim();
  if (!s || s.toLowerCase().includes('closed')) return [];
  // split on pipe and normalize spacing
  return s
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);
}

export function isFacilityOpen(hours: FacilityHours | null | undefined): { isOpen: boolean, minutesLeft: number | null } {
  if (!hours) return { isOpen: false, minutesLeft: null };

  // 1. Get current time in Austin (Central Time)
  const now = new Date();
  const austinTimeZone = 'America/Chicago';

  // 2. Get current day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = parseInt(formatInTimeZone(now, austinTimeZone, 'i')); // 1-7 (Mon-Sun)
  const currentTime = formatInTimeZone(now, austinTimeZone, 'HH:mm'); // "14:30"

  // 3. Check for special hours first (overrides regular hours)
  if (hours.special_date && hours.special_hours) {
    const todayDate = formatInTimeZone(now, austinTimeZone, 'yyyy-MM-dd');
    if (todayDate === hours.special_date) {
      if (hours.special_hours.toLowerCase() === 'closed') return { isOpen: false, minutesLeft: null };
      return isTimeInRange(currentTime, hours.special_hours);
    }
  }


  // 4. Get today's hours string based on day of week
  let todayHours: string | null | undefined;

  if (dayOfWeek === 7) {
    // Sunday
    todayHours = hours.sun;
  } else if (dayOfWeek === 6) {
    // Saturday
    todayHours = hours.sat;
  } else if (dayOfWeek === 5) {
    // Friday
    todayHours = hours.fri;
  } else {
    // Monday-Thursday
    todayHours = hours.mon || hours.tue || hours.wed || hours.thu;
  }

  // 5. Check if closed or no hours
  if (!todayHours || todayHours.toLowerCase().includes('closed')) {
    return { isOpen: false, minutesLeft: null };
  }

  // 6. Parse hours and check if current time is in range
  const intervals = parseIntervals(todayHours);
  for (const interval of intervals) {
    const result = isTimeInRange(currentTime, interval);

    if (result.isOpen) return result;
  }

  return { isOpen: false, minutesLeft: null };
}
