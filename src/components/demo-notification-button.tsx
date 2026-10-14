"use client";

import { useState } from "react";
import { SafePathLoading } from "@/components/safepath-loading";
import { Capacitor } from "@capacitor/core";
import { SOS_NOTIFICATION_CHANNEL_ID } from "@/lib/push/channels";

export function DemoNotificationButton({ onSent }: { onSent: () => void }) {
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function sendDemoNotification() {
    setSending(true);
    setStatus("");
    try {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        await PushNotifications.createChannel({
          id: SOS_NOTIFICATION_CHANNEL_ID,
          name: "Яаралтай тусламж — SOS",
          description: "Хүүхдээс ирсэн SOS дохио",
          importance: 5,
          sound: "sos_alert.wav",
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: "#F43F5E",
        });

        const { LocalNotifications } = await import("@capacitor/local-notifications");
        let permission = await LocalNotifications.checkPermissions();
        if (permission.display !== "granted") permission = await LocalNotifications.requestPermissions();
        if (permission.display !== "granted") {
          setStatus("Мэдэгдлийн зөвшөөрлийг утасны тохиргооноос асаана уу.");
          return;
        }

        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now() % 2_000_000_000,
            title: "🆘 SafePath — SOS (туршилт)",
            body: "Энэ бол туршилтын мэдэгдэл. Бодит SOS дохио биш.",
            channelId: SOS_NOTIFICATION_CHANNEL_ID,
            schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true },
            extra: { target: "guardian", type: "DEMO_ALERT" },
          }],
        });
      } else if ("Notification" in window) {
        let permission = Notification.permission;
        if (permission !== "granted") permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus("Хөтчийн мэдэгдлийн зөвшөөрлийг асаана уу.");
          return;
        }
        const notification = new Notification("🆘 SafePath — SOS (туршилт)", {
          body: "Энэ бол туршилтын мэдэгдэл. Бодит SOS дохио биш.",
          tag: "safepath-demo-sos",
        });
        notification.onclick = () => {
          window.focus();
          window.location.hash = "events";
          notification.close();
        };
      } else {
        setStatus("Энэ төхөөрөмж туршилтын мэдэгдлийг дэмжихгүй байна.");
        return;
      }

      onSent();
      setStatus("Туршилтын мэдэгдлийг энэ төхөөрөмжид илгээлээ.");
    } catch {
      setStatus("Туршилтын мэдэгдэл илгээж чадсангүй. Мэдэгдлийн тохиргоогоо шалгана уу.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void sendDemoNotification()}
        disabled={sending}
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-(--sp-line) bg-(--sp-surface) px-3 text-xs font-semibold text-(--sp-primary) transition hover:border-(--sp-primary) disabled:opacity-60"
      >
        {sending && <SafePathLoading variant="button" />}{sending ? "Илгээж байна…" : "Demo мэдэгдэл"}
      </button>
      {status && <p role="status" className="max-w-44 text-right text-[10px] leading-4 text-(--sp-muted)">{status}</p>}
    </div>
  );
}
