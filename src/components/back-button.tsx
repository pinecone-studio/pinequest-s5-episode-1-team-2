"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Returns to the previous page, or to `fallbackHref` when the app was opened straight on this one. */
export function BackButton({
  className = "",
  fallbackHref = "/",
  children,
}: {
  className?: string;
  fallbackHref?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Өмнөх хуудас руу буцах"
      className={className}
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
    >
      {children}
    </button>
  );
}
