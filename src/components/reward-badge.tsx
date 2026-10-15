import { describeReward, type RewardId } from "@/types/rewards";

const PIXELS = { sm: 36, picker: 44, md: 56, lg: 132 } as const;

/** A reward's picture: the companion's artwork, or the accessory's emoji. */
export function RewardBadge({ reward, size = "md" }: { reward: RewardId; size?: keyof typeof PIXELS }) {
  const { icon, companion } = describeReward(reward);
  // The picker artwork sizes itself to 56px in CSS, so other sizes are set inline.
  const pixels = PIXELS[size];
  return companion ? (
    <span className={`companion-picker__art companion-picker__art--${reward.toLowerCase()} shrink-0`} style={{ width: pixels, height: pixels }} aria-hidden="true" />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-[#f4f1ff]" style={{ width: pixels, height: pixels, fontSize: pixels * 0.55 }} aria-hidden="true">{icon}</span>
  );
}
