import type { PersistedClient } from "@tanstack/react-query-persist-client";

/** Only migrate the legacy single-user cache for the account that owned it. */
export function migrateLegacyCache(legacy: PersistedClient | undefined, userId: string): PersistedClient | undefined {
  if (!legacy || legacy.buster !== userId || userId === "anon") return undefined;
  const rows = legacy.clientState.queries.flatMap((q) => Array.isArray(q.state.data) ? q.state.data : []);
  return {
    ...legacy,
    clientState: {
      ...legacy.clientState,
      mutations: legacy.clientState.mutations.map((mutation) => {
        if (mutation.mutationKey?.[0] !== "meal_logs" || mutation.mutationKey?.[1] !== "add-manual") return mutation;
        const input = mutation.state.variables as Record<string, unknown>;
        const optimistic = rows.find((row) => row?.id === input.id);
        return {
          ...mutation,
          scope: { id: "meal-writes" },
          state: {
            ...mutation.state,
            variables: {
              ...input,
              user_id: input.user_id ?? userId,
              logged_at: input.logged_at ?? optimistic?.logged_at ?? new Date(mutation.state.submittedAt).toISOString(),
            },
          },
        };
      }),
    },
  };
}
