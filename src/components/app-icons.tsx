import {
  Building2,
  Bus,
  Crown,
  Footprints,
  Glasses,
  GraduationCap,
  Hospital,
  MapPin,
  Rainbow,
  Ribbon,
  School,
  Signpost,
  Star,
  Store,
  TrafficCone,
  Trees,
  type LucideIcon,
} from "lucide-react";
import type { AccessoryId } from "@/types/rewards";
import type { SceneLandmarkKind } from "@/types/vision";

/** One line icon per kind of place the camera can recognise. */
const LANDMARK_ICON: Record<SceneLandmarkKind, LucideIcon> = {
  building: Building2,
  shop: Store,
  school: School,
  hospital: Hospital,
  bus_stop: Bus,
  crossing: Footprints,
  traffic_light: TrafficCone,
  park: Trees,
  sign: Signpost,
  other: MapPin,
};

export function LandmarkIcon({ kind, size = 16, className = "" }: { kind: SceneLandmarkKind; size?: number; className?: string }) {
  const Icon = LANDMARK_ICON[kind] ?? MapPin;
  return <Icon size={size} strokeWidth={2} className={className} aria-hidden="true" />;
}

/** Each accessory as a line icon with its own colour, so it still reads at a glance. */
const ACCESSORY_ICON: Record<AccessoryId, { Icon: LucideIcon; color: string }> = {
  crown: { Icon: Crown, color: "#d4a017" },
  hat: { Icon: GraduationCap, color: "#334155" },
  glasses: { Icon: Glasses, color: "#0f172a" },
  bow: { Icon: Ribbon, color: "#db2777" },
  star: { Icon: Star, color: "#f59e0b" },
  rainbow: { Icon: Rainbow, color: "#7c3aed" },
};

export function AccessoryIcon({ id, size = 18, className = "" }: { id: AccessoryId; size?: number; className?: string }) {
  const { Icon, color } = ACCESSORY_ICON[id];
  return <Icon size={size} strokeWidth={2.2} color={color} className={className} aria-hidden="true" />;
}
