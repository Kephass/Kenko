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
import { registerWaterMutationDefaults } from "@/lib/waterMutations";
import { registerMealLogMutationDefaults } from "@/lib/mealLogMutations";
import { registerWaterPreferenceDefaults } from "@/lib/waterPreferenceMutations";
import { registerSavedMealDefaults } from "@/lib/savedMeals";
import { registerMealCopyDefaults } from "@/lib/copyMeal";
import { registerDishMutationDefaults } from "@/lib/dishMutations";
import { registerTargetSnapshotDefaults } from "@/lib/targetSnapshots";
import { registerProfileDefaults } from "@/lib/profileMutations";
import OfflineBanner from "@/components/OfflineBanner";
import SyncStatus from "@/components/SyncStatus";
import { retainUnsyncedCache } from "@/lib/offlineRetention";
import { migrateLegacyCache } from "@/lib/legacyCache";

const AuthContext = createContext<Session | null>(null);
export const useSession = () => useContext(AuthContext);

const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24h
const PUBLIC_ROUTES = new Set(["/login", "/reset-password"]);

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
    if (!loading && !session && !PUBLIC_ROUTES.has(pathname)) router.replace("/login");
  }, [loading, session, pathname, router]);

  if (loading) return null;

  const userId = session?.user.id ?? "anon";

  if (!session && !PUBLIC_ROUTES.has(pathname)) return null;
  return <UserData key={userId} session={session}>{children}</UserData>;
}

function UserData({ session, children }: { session: Session | null; children: React.ReactNode }) {
  const userId = session?.user.id ?? "anon";
  const [queryClient] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: CACHE_MAX_AGE }, mutations: { gcTime: Infinity } } });
    registerMealLogMutationDefaults(client);
    registerWaterMutationDefaults(client);
    registerDishMutationDefaults(client);
    registerMealCopyDefaults(client);
    registerSavedMealDefaults(client);
    registerWaterPreferenceDefaults(client);
    registerTargetSnapshotDefaults(client);
    registerProfileDefaults(client);
    return client;
  });
  const [persister] = useState<Persister>(() => {
    const key = `kenko-query-cache:${userId}`;
    return {
      persistClient: (client: PersistedClient) => set(key, client),
      restoreClient: async () => retainUnsyncedCache((await get<PersistedClient>(key)) ?? migrateLegacyCache(await get<PersistedClient>("kenko-query-cache"), userId), userId),
      removeClient: () => del(key),
    };
  });
  useEffect(() => () => { void queryClient.cancelQueries(); }, [queryClient]);
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: userId,
        dehydrateOptions: {
          shouldDehydrateMutation: (mutation) => (mutation.state.isPaused || mutation.state.status === "error") && !!mutation.options.mutationKey,
        },
      }}
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <AuthContext.Provider value={session}>
        <OfflineBanner />
        <SyncStatus />
        {children}
      </AuthContext.Provider>
    </PersistQueryClientProvider>
  );
}
