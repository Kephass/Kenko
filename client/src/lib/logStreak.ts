import { addDays, localDateISO } from "./utils";

/** Read daily aggregates in bounded windows until the first missing local day. */
export async function loadLogStreak(
  fetchDays: (start: string, end: string) => Promise<string[]>,
  today: string,
) {
  let cursor = new Date(`${today}T12:00:00`);
  let streak = 0;
  let first = true;
  for (;;) {
    const start = localDateISO(addDays(cursor, -365));
    const days = new Set(await fetchDays(start, localDateISO(cursor)));
    // Give the current day time to be logged; yesterday must still be present.
    if (first && !days.has(today)) cursor = addDays(cursor, -1);
    first = false;
    while (localDateISO(cursor) >= start) {
      if (!days.has(localDateISO(cursor))) return streak;
      streak++;
      cursor = addDays(cursor, -1);
    }
  }
}
