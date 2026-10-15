export const SCENE_LANDMARK_KINDS = [
  "building",
  "shop",
  "school",
  "hospital",
  "bus_stop",
  "crossing",
  "traffic_light",
  "park",
  "sign",
  "other",
] as const;

export type SceneLandmarkKind = (typeof SCENE_LANDMARK_KINDS)[number];

export const SCENE_LANDMARK_SIDES = ["left", "center", "right"] as const;

export type SceneLandmarkSide = (typeof SCENE_LANDMARK_SIDES)[number];

// A landmark the vision model actually saw in the captured frame.
export type SceneLandmark = {
  /** Short, easy name: readable sign text, or a description such as "Шар өнгийн өндөр байр". */
  label: string;
  /** One easy-to-spot cue: colour, floors, shape. */
  detail: string;
  kind: SceneLandmarkKind;
  side: SceneLandmarkSide;
  /** [ymin, xmin, ymax, xmax] normalised to 0–1000 within the captured frame, when the model located it. */
  box: [number, number, number, number] | null;
};
