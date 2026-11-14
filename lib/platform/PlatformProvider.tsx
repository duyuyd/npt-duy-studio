"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { mergeRows, parseSettings, SETTING_KEYS, type PlatformSettings, type SettingRow } from "./settings";
import { themeStyle } from "./theme";

type PlatformContextValue = {
  settings: PlatformSettings;
  applySavedRows: (rows: SettingRow[]) => void;
  realtimeWarning: boolean;
};
const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ initialRows, children }: { initialRows: SettingRow[]; children: ReactNode }) {
  const [rows, setRows] = useState(initialRows);
  const [realtimeWarning, setRealtimeWarning] = useState(false);
  const settings = useMemo(() => parseSettings(rows), [rows]);
  const applySavedRows = useCallback((incoming: SettingRow[]) => {
    setRows((previous) => mergeRows(previous, incoming));
  }, []);

  const primaryColor = settings?.primary_color;
  useEffect(() => {
    if (!primaryColor) return;
    const theme = themeStyle(primaryColor) as Record<string, string>;
    document.documentElement.style.setProperty("--primary", theme["--primary"]);
    document.documentElement.style.setProperty("--on-primary", theme["--on-primary"]);
  }, [primaryColor]);

  useEffect(() => {
    if (!settings) return;
    const supabase = createClient();
    const channel = supabase.channel("public-platform-settings")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "platform_settings" }, (event) => {
        const row = event.new as SettingRow;
        if (row?.key) applySavedRows([row]);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeWarning(false);
          // Close the race between server render and the start of the subscription.
          void supabase.from("platform_settings").select("key,value,updated_at").in("key", [...SETTING_KEYS])
            .then(({ data, error }) => {
              if (error) setRealtimeWarning(true);
              else if (data) applySavedRows(data as SettingRow[]);
            });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeWarning(true);
        }
      });
    return () => { void supabase.removeChannel(channel); };
    // Subscribe once; incoming row changes do not create a new subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applySavedRows, Boolean(settings)]);

  if (!settings) {
    return <main className="mx-auto max-w-xl px-6 py-24 text-center"><h1 className="text-2xl font-semibold">Chưa kết nối được cấu hình</h1><p className="mt-4 text-slate-600">Kiểm tra thông tin Supabase và chạy file SQL Phase 1. Không có dữ liệu thay thế được hiển thị.</p></main>;
  }
  return <PlatformContext.Provider value={{ settings, applySavedRows, realtimeWarning }}><div className="app-shell" style={themeStyle(settings.primary_color)}>{children}</div></PlatformContext.Provider>;
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) throw new Error("usePlatform must be used within PlatformProvider");
  return context;
}
