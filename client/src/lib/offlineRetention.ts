import type { PersistedClient } from "@tanstack/react-query-persist-client";

/** Cache expiry must not discard user changes that have never reached the server. */
export function retainUnsyncedCache(saved: PersistedClient | undefined, userId: string, now = Date.now()): PersistedClient | undefined {
  if (!saved || userId === "anon" || saved.buster !== userId) return undefined;
  const hasUnsynced = saved.clientState.mutations.some(mutation => mutation.state.isPaused || mutation.state.status === "error");
  // Only the persistence envelope is renewed. Query dataUpdatedAt stays unchanged,
  // so online queries still refetch normally rather than treating old data as fresh.
  return hasUnsynced ? { ...saved, timestamp: now } : saved;
}
