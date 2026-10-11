"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function subscribeToStandaloneMode(onChange: () => void) {
  const mediaQuery = window.matchMedia("(display-mode: standalone)");
  mediaQuery.addEventListener("change", onChange);
  window.addEventListener("pageshow", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    mediaQuery.removeEventListener("change", onChange);
    window.removeEventListener("pageshow", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function getIsStandalone() {
  const appleNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    appleNavigator.standalone === true
  );
}

export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] =
    useState<InstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(true);
  const isStandalone = useSyncExternalStore(
    subscribeToStandaloneMode,
    getIsStandalone,
    () => false,
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallEvent(null);
      setShowInstructions(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (isStandalone) return null;

  const handleInstall = async () => {
    if (!installEvent) {
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
      setShowInstructions((visible) => !visible);
      return;
    }

    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <div className="relative z-10 mx-auto mt-4 w-full max-w-[390px] text-center">
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#22d3ee]/35 bg-[#0b2028]/80 px-4 text-[13px] font-semibold text-[#d8e8eb] transition hover:border-[#67e8f9] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]"
      >
        <span aria-hidden="true">＋</span>
        Нүүр дэлгэцэд нэмэх
      </button>

      {showInstructions && (
        <div
          role="status"
          className="mx-auto mt-3 max-w-[350px] rounded-2xl border border-[#22d3ee]/25 bg-[#0b2028] px-4 py-3 text-left text-[13px] leading-5 text-[#d8e8eb]"
        >
          {isIOS ? (
            <>
              <p className="font-semibold text-white">iPhone дээр нэмэх</p>
              <p className="mt-1">
                Safari-ийн Share <span aria-label="Share" role="img">□↑</span> товчийг дараад
                “Add to Home Screen” → “Add”-ыг сонгоно уу.
              </p>
              <p className="mt-1 text-[#a8bbc1]">
                Энэ сонголт харагдахгүй бол хуудсыг Safari дээр нээнэ үү.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-white">Нүүр дэлгэцэд нэмэх</p>
              <p className="mt-1">
                Хөтчийн цэснээс “Install app” эсвэл “Add to Home screen”-ийг сонгоно уу.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
