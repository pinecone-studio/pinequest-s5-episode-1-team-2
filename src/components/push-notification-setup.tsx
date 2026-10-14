"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SAFETY_NOTIFICATION_CHANNEL_ID, SOS_NOTIFICATION_CHANNEL_ID } from "@/lib/push/channels";

const TOKEN_STORAGE_KEY = "safepath:push-token";
type ListenerHandle = { remove: () => Promise<void> };
type PushPlugin = typeof import("@capacitor/push-notifications").PushNotifications;
type PushStatus = "idle" | "requesting" | "enabled" | "server-not-configured" | "denied" | "error";

export default function PushNotificationSetup() {
  const [nativeAndroid, setNativeAndroid] = useState(false);
  const [status, setStatus] = useState<PushStatus>("idle");
  const handlesRef = useRef<ListenerHandle[]>([]);
  const listenersReadyRef = useRef(false);
  const mountedRef = useRef(false);
  const pluginRef = useRef<PushPlugin | null>(null);

  const removeListeners = useCallback(async () => {
    const handles = handlesRef.current.splice(0);
    listenersReadyRef.current = false;
    await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
  }, []);

  const addListeners = useCallback(async (plugin: PushPlugin) => {
    if (listenersReadyRef.current) return;
    listenersReadyRef.current = true;

    handlesRef.current.push(await plugin.addListener("registration", async ({ value }) => {
      try {
        const platform = Capacitor.getPlatform();
        if (platform !== "android" && platform !== "ios") throw new Error("Unsupported push platform");
        const response = await fetch("/api/push/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: value, platform }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Push token registration failed");
        const result = await response.json() as { deliveryConfigured?: boolean };
        window.localStorage.setItem(TOKEN_STORAGE_KEY, value);
        if (mountedRef.current) setStatus(result.deliveryConfigured ? "enabled" : "server-not-configured");
      } catch {
        if (mountedRef.current) setStatus("error");
      }
    }));

    handlesRef.current.push(await plugin.addListener("registrationError", () => {
      if (mountedRef.current) setStatus("error");
    }));

    handlesRef.current.push(await plugin.addListener("pushNotificationActionPerformed", (action) => {
      const data = action.notification.data as Record<string, unknown> | undefined;
      if (data?.type === "SAFETY_ALERT" && data.target === "guardian") {
        window.location.assign("/guardian#events");
      }
    }));
  }, []);

  const prepareChannels = useCallback(async (plugin: PushPlugin) => {
    await Promise.all([
      plugin.createChannel({
        id: SOS_NOTIFICATION_CHANNEL_ID,
        name: "Яаралтай тусламж — SOS",
        description: "Хүүхдээс ирсэн SOS дохио",
        importance: 5,
        sound: "sos_alert.wav",
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: "#F43F5E",
      }),
      plugin.createChannel({
        id: SAFETY_NOTIFICATION_CHANNEL_ID,
        name: "SafePath аюулгүй байдлын мэдэгдэл",
        description: "Safe Zone-д орсон эсвэл гарсан тухай",
        importance: 4,
        visibility: 1,
        vibration: true,
      }),
    ]);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return () => { mountedRef.current = false; };
    }
    setNativeAndroid(true);

    let disposed = false;
    const initialize = async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        if (disposed) return;
        pluginRef.current = PushNotifications;
        await prepareChannels(PushNotifications);
        await addListeners(PushNotifications);
        if (disposed) {
          await removeListeners();
          return;
        }
        const permission = await PushNotifications.checkPermissions();
        if (disposed) return;
        if (permission.receive === "granted") {
          setStatus("requesting");
          await PushNotifications.register();
        } else if (permission.receive === "denied") {
          setStatus("denied");
        }
      } catch {
        if (!disposed) setStatus("error");
      }
    };
    void initialize();

    return () => {
      disposed = true;
      mountedRef.current = false;
      void removeListeners();
    };
  }, [addListeners, prepareChannels, removeListeners]);

  const enableNotifications = async () => {
    setStatus("requesting");
    try {
      const plugin = pluginRef.current ?? (await import("@capacitor/push-notifications")).PushNotifications;
      pluginRef.current = plugin;
      await prepareChannels(plugin);
      await addListeners(plugin);
      const current = await plugin.checkPermissions();
      const permission = current.receive === "granted" ? current : await plugin.requestPermissions();
      if (permission.receive !== "granted") {
        setStatus("denied");
        return;
      }
      await plugin.register();
    } catch {
      setStatus("error");
    }
  };

  if (!nativeAndroid) return null;

  return (
    <section
      aria-live="polite"
      className="mx-auto mb-3 flex w-[calc(100%_-_2rem)] max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-200/20 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 shadow-lg"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{status === "enabled" ? "Push мэдэгдэл идэвхтэй" : status === "server-not-configured" ? "Төхөөрөмж бүртгэгдсэн — сервер тохиргоо дутуу" : "Яаралтай мэдэгдэл"}</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">
          {status === "enabled" && "SOS болон Safe Zone дохиог энэ Android төхөөрөмжид хүргэхээр бүртгэлтэй."}
          {status === "server-not-configured" && "Төхөөрөмжийн token хадгалагдсан боловч серверийн FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY тохиргоо дутуу байна."}
          {status === "idle" && "SOS болон Safe Zone дохиог апп хаалттай үед ч хүлээн авахын тулд мэдэгдэл идэвхжүүлнэ үү."}
          {status === "requesting" && "Мэдэгдлийн зөвшөөрөл болон төхөөрөмжийн бүртгэлийг шалгаж байна…"}
          {status === "denied" && "Мэдэгдлийн зөвшөөрөл хаалттай байна. Android Settings → Apps → SafePath → Notifications хэсгээс асаагаарай."}
          {status === "error" && "Push тохируулга амжилтгүй. Сүлжээ, Firebase болон google-services.json тохиргоог шалгана уу."}
        </p>
      </div>
      {status !== "enabled" && (
        <button
          type="button"
          onClick={enableNotifications}
          disabled={status === "requesting"}
          className="min-h-10 shrink-0 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
        >
          {status === "requesting" ? "Түр хүлээнэ үү…" : status === "error" || status === "denied" ? "Дахин шалгах" : "Идэвхжүүлэх"}
        </button>
      )}
    </section>
  );
}
