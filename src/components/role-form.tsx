"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { setRole } from "@/app/actions/auth";
import type { Role } from "@/types/auth";

export const ROLE_STORAGE_KEY = "safepath-role";

/** The role this device last picked, or null when none was saved or storage is unavailable. */
function readSavedRole(): Role | null {
  try {
    const value = window.localStorage.getItem(ROLE_STORAGE_KEY);
    return value === "guardian" || value === "child" ? value : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * One role card on /role. Choosing it signs this device in as that role (the server keeps it
 * in the session) and remembers it in local storage, so the card picked last time is marked.
 */
export function RoleForm({ role, children }: { role: Role; children: ReactNode }) {
  const saved = useSyncExternalStore(subscribe, readSavedRole, () => null);

  return (
    <form
      action={setRole}
      className="relative"
      onSubmit={() => {
        try {
          window.localStorage.setItem(ROLE_STORAGE_KEY, role);
        } catch {
          // The choice still works for this session without local storage.
        }
      }}
    >
      <input type="hidden" name="role" value={role} />
      {children}
      {saved === role && (
        <span className="pointer-events-none absolute bottom-3 right-3.5 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-medium text-white/90 sm:bottom-4 sm:right-4">Сүүлд сонгосон</span>
      )}
    </form>
  );
}
