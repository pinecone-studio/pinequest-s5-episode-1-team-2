"use client";

import { useEffect, useState } from "react";
import { isRewardId, type RewardId } from "@/types/rewards";
import type { Checkpoint } from "@/types/location";

const POLL_MS = 20_000;

/**
 * The signed-in child's goals and collected rewards, refreshed while the page is open.
 * `rewards` is null until known, and stays null for accounts that are not children.
 */
export function useCheckpoints({ poll = true }: { poll?: boolean } = {}) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [rewards, setRewards] = useState<RewardId[] | null>(null);
  const [isChild, setIsChild] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;

    async function load() {
      try {
        const response = await fetch("/api/checkpoints", { cache: "no-store", signal: controller.signal });
        if (response.status === 403) {
          setIsChild(false);
          return;
        }
        if (!response.ok) throw new Error("Checkpoint request failed.");
        const result: unknown = await response.json();
        if (result && typeof result === "object" && "checkpoints" in result && Array.isArray(result.checkpoints)) {
          setCheckpoints(result.checkpoints as Checkpoint[]);
        }
        if (result && typeof result === "object" && "rewards" in result && Array.isArray(result.rewards)) {
          setRewards(result.rewards.filter(isRewardId));
        }
        setIsChild(true);
      } catch {
        // Keep what was shown; try again on the next tick.
      }
      if (poll && !controller.signal.aborted) timer = window.setTimeout(load, POLL_MS);
    }

    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [poll]);

  return { checkpoints, rewards, isChild };
}
