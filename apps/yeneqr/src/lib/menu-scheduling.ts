/**
 * Menu Scheduling Utilities
 *
 * Check if a menu item is currently available based on its schedule.
 * Supports three availability types:
 *   - 'always': item is always available (when isAvailable is true)
 *   - 'manual': availability is controlled manually via isAvailable flag
 *   - 'scheduled': availability is determined by a time/day schedule
 *
 * Also supports direct time/day fields:
 *   - availableFrom / availableTo: HH:mm time window
 *   - availableDays: JSON array of day names
 */

interface ScheduleInput {
  days?: string[];    // ['monday', 'tuesday', ...] — lowercase day names
  startTime?: string; // '09:00' — HH:mm format
  endTime?: string;   // '22:00' — HH:mm format
  timeSlots?: { day: string; start: string; end: string }[];
}

interface SchedulableItem {
  isAvailable: boolean;
  availabilityType: string; // 'always' | 'scheduled' | 'manual'
  availabilitySchedule?: string | null; // JSON string
  availableFrom?: string | null; // HH:mm format, e.g., "09:00"
  availableTo?: string | null; // HH:mm format, e.g., "22:00"
  availableDays?: string | null; // JSON array of day names, e.g., '["monday","tuesday","friday"]'
}

/** Enriched availability result with reason */
export interface AvailabilityResult {
  available: boolean;
  reason?: string;
}

/**
 * Check if a menu item is currently available based on its schedule
 * and direct time/day fields.
 *
 * Returns an object with:
 *   - available: boolean indicating if the item is currently available
 *   - reason: optional string explaining why the item is unavailable
 */
export function isItemCurrentlyAvailable(item: SchedulableItem): AvailabilityResult {
  // If manually unavailable, always false
  if (!item.isAvailable) {
    return { available: false, reason: 'Item is marked as unavailable' };
  }

  // Check direct time window fields (availableFrom / availableTo)
  if (item.availableFrom && item.availableTo) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (currentTime < item.availableFrom || currentTime > item.availableTo) {
      return {
        available: false,
        reason: `Only available from ${item.availableFrom} to ${item.availableTo} (now ${currentTime})`,
      };
    }
  }

  // Check direct availableDays field
  if (item.availableDays) {
    try {
      const days = JSON.parse(item.availableDays) as string[];
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const today = dayNames[new Date().getDay()];
      if (!days.includes(today)) {
        const formattedDays = days.map((d) =>
          d.charAt(0).toUpperCase() + d.slice(1)
        ).join(', ');
        return {
          available: false,
          reason: `Only available on ${formattedDays} (today is ${today.charAt(0).toUpperCase() + today.slice(1)})`,
        };
      }
    } catch {
      // Invalid JSON — don't block availability
    }
  }

  // If always available, true
  if (item.availabilityType === 'always') {
    return { available: true };
  }

  // If manual, use the isAvailable flag (already checked above)
  if (item.availabilityType === 'manual') {
    return { available: item.isAvailable };
  }

  // If scheduled, check the schedule
  if (item.availabilityType === 'scheduled' && item.availabilitySchedule) {
    try {
      const schedule = JSON.parse(item.availabilitySchedule) as ScheduleInput;
      const scheduleResult = checkSchedule(schedule);
      if (!scheduleResult.inSchedule) {
        return { available: false, reason: scheduleResult.reason };
      }
      return { available: true };
    } catch {
      return { available: true }; // If schedule is invalid, default to available
    }
  }

  return { available: true };
}

/**
 * Check if the current time falls within the given schedule.
 * Returns a boolean for simple use.
 */
export function isInSchedule(schedule: ScheduleInput): boolean {
  return checkSchedule(schedule).inSchedule;
}

/**
 * Internal: Check schedule and return detailed result.
 */
function checkSchedule(schedule: ScheduleInput): { inSchedule: boolean; reason?: string } {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // If specific time slots are defined, use them
  if (schedule.timeSlots && schedule.timeSlots.length > 0) {
    const matchingSlot = schedule.timeSlots.find(slot => {
      if (slot.day.toLowerCase() !== currentDay) return false;
      const [startH, startM] = slot.start.split(':').map(Number);
      const [endH, endM] = slot.end.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    });

    if (matchingSlot) {
      return { inSchedule: true };
    }

    // Check if today is a scheduled day at all
    const todaySlots = schedule.timeSlots.filter(
      (slot) => slot.day.toLowerCase() === currentDay
    );
    if (todaySlots.length === 0) {
      return {
        inSchedule: false,
        reason: `Not scheduled for ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)}`,
      };
    }

    // Today has slots but current time is outside them
    const timeRanges = todaySlots
      .map((s) => `${s.start}-${s.end}`)
      .join(', ');
    return {
      inSchedule: false,
      reason: `Scheduled for ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)} at ${timeRanges} (now ${currentTime})`,
    };
  }

  // General day + time range
  const dayMatch = !schedule.days || schedule.days.length === 0 ||
    schedule.days.map(d => d.toLowerCase()).includes(currentDay);

  if (!dayMatch) {
    const formattedDays = (schedule.days || []).map((d) =>
      d.charAt(0).toUpperCase() + d.slice(1)
    ).join(', ');
    return {
      inSchedule: false,
      reason: `Only available on ${formattedDays} (today is ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)})`,
    };
  }

  // Check time range
  if (schedule.startTime && schedule.endTime) {
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return {
        inSchedule: false,
        reason: `Available ${schedule.startTime}-${schedule.endTime} (now ${currentTime})`,
      };
    }
  }

  return { inSchedule: true }; // No time restriction
}
