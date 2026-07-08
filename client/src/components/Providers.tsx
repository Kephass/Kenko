"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  type PersistedClient,
  type Persister,
} from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { registerMealLogMutationDefaults } from "@/lib/mealLogMutations";
import OfflineBanner from "@/components/OfflineBanner";

const AuthContext = createContext<Session | null>(null);
export const useSession = () => useContext(AuthContext);

const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24h

const queryClient = new QueryClient({
  // gcTime must outlive maxAge or persisted queries get collected before restore.
  defaultOptions: { queries: { gcTime: CACHE_MAX_AGE } },
});
registerMealLogMutationDefaults(queryClient);

// IndexedDB persister: structured clone, no JSON round-trip needed.
const persister: Persister = {
  persistClient: (client: PersistedClient) => set("kenko-query-cache", client),
  restoreClient: () => get<PersistedClient>("kenko-query-cache"),
  removeClient: () => del("kenko-query-cache"),
};

export default function Providers({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !session && pathname !== "/login") router.replace("/login");
  }, [loading, session, pathname, router]);

  if (loading) return null;

  const userId = session?.user.id ?? "anon";

  return (
    // Keyed by user so a login/logout remounts and re-restores with the right buster.
    <PersistQueryClientProvider
      key={userId}
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: userId,
        dehydrateOptions: {
          // Only queue mutations with registered defaults (they can resume after a
          // reload); everything else — notably the AI log-meal call — is never persisted.
          shouldDehydrateMutation: (mutation) =>
            mutation.state.isPaused && !!mutation.options.mutationKey,
        },
      }}
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <AuthContext.Provider value={session}>
        <OfflineBanner />
        {children}
      </AuthContext.Provider>
    </PersistQueryClientProvider>
  );
}
