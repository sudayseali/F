import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase, invokeEdgeFunction } from "../lib/supabase";
import { useTelegram } from "./TelegramContext";
import { tgHaptics } from "../lib/telegram";

export type AlertCategory = "referral" | "task" | "offer" | "system";

export interface UserNotification {
  id: string;
  user_id: string;
  category: AlertCategory;
  event_key: string;
  title: string;
  message: string;
  amount: number | null;
  action_url: string | null;
  metadata: Record<string, unknown>;
  telegram_sent: boolean;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface AlertPreferences {
  referral: boolean;
  task: boolean;
  offer: boolean;
  telegram_push: boolean;
}

const DEFAULT_PREFS: AlertPreferences = {
  referral: true,
  task: true,
  offer: true,
  telegram_push: true,
};

interface AlertsContextType {
  notifications: UserNotification[];
  unreadCount: number;
  prefs: AlertPreferences;
  loading: boolean;
  savingPrefs: boolean;
  isDrawerOpen: boolean;
  drawerTab: "inbox" | "prefs";
  liveToast: UserNotification | null;
  openAlertsDrawer: (tab?: "inbox" | "prefs") => void;
  closeAlertsDrawer: () => void;
  setDrawerTab: (tab: "inbox" | "prefs") => void;
  dismissToast: () => void;
  refreshAlerts: () => Promise<void>;
  markAsRead: (notificationId?: string) => Promise<void>;
  updatePrefs: (patch: Partial<AlertPreferences>) => Promise<void>;
}

const AlertsContext = createContext<AlertsContextType>({
  notifications: [],
  unreadCount: 0,
  prefs: DEFAULT_PREFS,
  loading: false,
  savingPrefs: false,
  isDrawerOpen: false,
  drawerTab: "inbox",
  liveToast: null,
  openAlertsDrawer: () => {},
  closeAlertsDrawer: () => {},
  setDrawerTab: () => {},
  dismissToast: () => {},
  refreshAlerts: async () => {},
  markAsRead: async () => {},
  updatePrefs: async () => {},
});

export const useAlerts = () => useContext(AlertsContext);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useTelegram();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prefs, setPrefs] = useState<AlertPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"inbox" | "prefs">("inbox");
  const [liveToast, setLiveToast] = useState<UserNotification | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshAlerts = useCallback(async () => {
    if (!user?.uuid) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const data = await invokeEdgeFunction<{
        notifications: UserNotification[];
        unreadCount: number;
        prefs: AlertPreferences;
      }>("alerts", { action: "list" });

      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(typeof data?.unreadCount === "number" ? data.unreadCount : 0);
      if (data?.prefs) {
        setPrefs({
          referral: data.prefs.referral !== false,
          task: data.prefs.task !== false,
          offer: data.prefs.offer !== false,
          telegram_push: data.prefs.telegram_push !== false,
        });
      }
    } catch {
      // Fail quietly so UI never crashes if alerts service is temporarily unreachable
    } finally {
      setLoading(false);
    }
  }, [user?.uuid]);

  useEffect(() => {
    refreshAlerts();
  }, [refreshAlerts]);

  // Real-time subscription for instant Referral, Task & Offer alerts
  useEffect(() => {
    if (!user?.uuid) return;

    const channel = supabase
      .channel(`user_alerts_${user.uuid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${user.uuid}`,
        },
        (payload) => {
          const incoming = payload.new as UserNotification | undefined;
          if (!incoming || !incoming.id) return;

          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, 40);
          });
          setUnreadCount((c) => c + 1);
          setLiveToast(incoming);
          tgHaptics.notification("success");

          if (typeof incoming.amount === "number" && incoming.amount > 0) {
            refreshUser();
          }

          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => {
            setLiveToast(null);
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [user?.uuid, refreshUser]);

  const openAlertsDrawer = useCallback((tab: "inbox" | "prefs" = "inbox") => {
    tgHaptics.impact("light");
    setDrawerTab(tab);
    setIsDrawerOpen(true);
    refreshAlerts();
  }, [refreshAlerts]);

  const closeAlertsDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setLiveToast(null);
  }, []);

  const markAsRead = useCallback(
    async (notificationId?: string) => {
      if (!user?.uuid) return;

      const nowIso = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) =>
          !notificationId || n.id === notificationId
            ? { ...n, is_read: true, read_at: n.read_at || nowIso }
            : n
        )
      );

      if (notificationId) {
        setUnreadCount((c) => Math.max(0, c - 1));
      } else {
        setUnreadCount(0);
      }

      try {
        await invokeEdgeFunction("alerts", {
          action: "mark_read",
          ...(notificationId ? { notification_id: notificationId } : {}),
        });
      } catch {
        refreshAlerts();
      }
    },
    [user?.uuid, refreshAlerts]
  );

  const updatePrefs = useCallback(
    async (patch: Partial<AlertPreferences>) => {
      if (!user?.uuid) return;
      tgHaptics.selection();
      const optimistic = { ...prefs, ...patch };
      setPrefs(optimistic);
      setSavingPrefs(true);
      try {
        const res = await invokeEdgeFunction<{ prefs: AlertPreferences }>("alerts", {
          action: "update_prefs",
          prefs: optimistic,
        });
        if (res?.prefs) setPrefs(res.prefs);
      } catch {
        setPrefs(prefs);
      } finally {
        setSavingPrefs(false);
      }
    },
    [user?.uuid, prefs]
  );

  return (
    <AlertsContext.Provider
      value={{
        notifications,
        unreadCount,
        prefs,
        loading,
        savingPrefs,
        isDrawerOpen,
        drawerTab,
        liveToast,
        openAlertsDrawer,
        closeAlertsDrawer,
        setDrawerTab,
        dismissToast,
        refreshAlerts,
        markAsRead,
        updatePrefs,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
}
