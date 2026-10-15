"use client";

import { useEffect, useRef, useState } from "react";
import { latLngBounds } from "leaflet";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { SAFE_ZONES } from "@/lib/safe-zones";
import type { SafeZone, SafetyLocation } from "@/types/safety";
import type { SeenLandmark } from "@/types/location";
import { SCENE_LANDMARK_ICONS } from "@/types/vision";

// Only the newest few seen places keep their name on the map; older ones show it on tap.
const LABELLED_LANDMARKS = 3;

/** A tracked person drawn as a named pin; `fresh` is false once their last report is old. */
export type MapPerson = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  fresh: boolean;
  selected?: boolean;
  /** Metres, as reported by the phone; drawn as a circle around the selected pin. */
  accuracy?: number;
};

// Close enough to tell which side of the street, or which building, the child is at.
const FOLLOW_ZOOM = 17;

type LiveMapProps = {
  location: SafetyLocation;
  /** When given, these named pins replace the plain dot at `location` (guardian variant). */
  people?: MapPerson[];
  /** Notable places the selected child's camera saw, newest first. */
  landmarks?: SeenLandmark[];
  safeZones?: SafeZone[];
  currentRoute?: [number, number][];
  destination?: Pick<SafetyLocation, "latitude" | "longitude">;
  familiarRoute?: [number, number][];
  variant?: "guardian" | "companion";
  routeColor?: string;
  /** Turn off when a parent shows the OpenStreetMap credit itself, e.g. a tilted frame that crops the corners. */
  showCredit?: boolean;
  className?: string;
};

export default function LiveMap({ location, people = [], landmarks = [], safeZones = SAFE_ZONES, currentRoute = [], destination, familiarRoute = [], variant = "guardian", routeColor = "#2e7d4f", showCredit = true, className = "" }: LiveMapProps) {
  const center: [number, number] = [location.latitude, location.longitude];
  const companion = variant === "companion";
  const [tileError, setTileError] = useState(false);
  const selectedPerson = people.find((person) => person.selected);

  return (
    <div className={`safepath-map ${companion ? "safepath-map--companion absolute inset-0" : "relative rounded-[20px] border border-[#e7e7e5]"} isolate overflow-hidden bg-[#f7f7f5] ${className}`} aria-label={companion ? "Одоогийн байршил орчмын гудамж" : "Байршлын газрын зураг"}>
      <MapContainer
        center={center}
        zoom={companion ? 16 : 14}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={!companion}
        touchZoom={!companion}
        dragging={!companion}
        doubleClickZoom={!companion}
        boxZoom={!companion}
        keyboard={!companion}
        className="absolute inset-0 z-0 size-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          eventHandlers={{
            tileload: () => setTileError(false),
            tileerror: () => setTileError(true),
          }}
        />
        {!companion && safeZones.map((zone, index) => (
          <Circle
            key={zone.id}
            center={[zone.latitude, zone.longitude]}
            radius={zone.radiusMeters}
            pathOptions={{
              color: index === 0 ? "#2e7d4f" : "#737373",
              fillColor: index === 0 ? "#2e7d4f" : "#737373",
              fillOpacity: 0.06,
              weight: 1.5,
              dashArray: index === 0 ? undefined : "4 5",
            }}
          >
            <Tooltip direction="top" permanent>{zone.name}</Tooltip>
          </Circle>
        ))}
        {!companion && familiarRoute.length > 1 && <Polyline positions={familiarRoute} pathOptions={{ color: "#77776f", weight: 3, opacity: 0.45, dashArray: "5 7" }} />}
        {currentRoute.length > 1 && <Polyline positions={currentRoute} pathOptions={{ color: routeColor, weight: companion ? 5 : 4, opacity: 0.85 }} />}
        {destination && <CircleMarker
          center={[destination.latitude, destination.longitude]}
          radius={8}
          pathOptions={{ color: "#ffffff", fillColor: "#2e7d4f", fillOpacity: 1, weight: 3 }}
        />}
        {!companion && people.length === 0 && <CircleMarker
          center={center}
          radius={9}
          pathOptions={{ color: "#ffffff", fillColor: "#111111", fillOpacity: 1, weight: 4 }}
        />}
        {!companion && landmarks.map((landmark, index) => (
          <CircleMarker
            key={landmark.id}
            center={[landmark.latitude, landmark.longitude]}
            radius={6}
            pathOptions={{ color: "#ffffff", fillColor: "#f59e0b", fillOpacity: index < LABELLED_LANDMARKS ? 1 : 0.7, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -6]} permanent={index < LABELLED_LANDMARKS}>
              {SCENE_LANDMARK_ICONS[landmark.kind]} {landmark.label}
            </Tooltip>
          </CircleMarker>
        ))}
        {!companion && selectedPerson?.accuracy ? (
          <Circle
            center={[selectedPerson.latitude, selectedPerson.longitude]}
            radius={selectedPerson.accuracy}
            pathOptions={{ color: "#2a7fff", fillColor: "#2a7fff", fillOpacity: 0.12, weight: 1.5 }}
          />
        ) : null}
        {!companion && people.map((person) => (
          <CircleMarker
            key={person.id}
            center={[person.latitude, person.longitude]}
            radius={person.selected ? 11 : 8}
            pathOptions={{ color: "#ffffff", fillColor: person.fresh ? "#2a7fff" : "#9ca3af", fillOpacity: 1, weight: 3 }}
          >
            <Tooltip direction="top" offset={[0, -10]} permanent>{person.name}</Tooltip>
          </CircleMarker>
        ))}
        {companion
          ? <FollowLocation location={location} />
          : selectedPerson
            ? <FollowPerson person={selectedPerson} />
            : <FitMap location={location} safeZones={safeZones} />}
      </MapContainer>

      {showCredit && <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute right-2 top-2 z-[400] rounded-xl bg-white/90 px-2 py-1 text-[10px] text-[#737373]">© OpenStreetMap</a>}
      {tileError && <p role="status" className="absolute inset-x-3 bottom-3 z-[400] rounded-xl bg-white/95 px-3 py-2 text-center text-xs leading-5 text-[#737373]">Газрын зураг ачаалсангүй. Интернэт холболтоо шалгана уу.</p>}

    </div>
  );
}

function FollowLocation({ location }: { location: SafetyLocation }) {
  const map = useMap();

  useEffect(() => {
    map.setView([location.latitude, location.longitude], 16, { animate: false });
  }, [location.latitude, location.longitude, map]);

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

/**
 * Keeps the selected child in view as new positions arrive. Once the guardian drags the map
 * themselves it stops following, until the map is remounted (the "back to child" button).
 */
function FollowPerson({ person }: { person: MapPerson }) {
  const map = useMap();
  const userMoved = useRef(false);
  const started = useRef(false);
  const { latitude, longitude, accuracy = 0 } = person;

  useEffect(() => {
    const stopFollowing = () => { userMoved.current = true; };
    map.on("dragstart", stopFollowing);
    return () => { map.off("dragstart", stopFollowing); };
  }, [map]);

  useEffect(() => {
    if (userMoved.current) return;
    // A rough Wi-Fi or cell fix would sit far outside a street-level view; show the whole circle instead.
    if (accuracy > 120) {
      const latitudeDelta = accuracy / 111_320;
      const longitudeDelta = accuracy / (111_320 * Math.cos((latitude * Math.PI) / 180));
      map.fitBounds(
        latLngBounds([[latitude - latitudeDelta, longitude - longitudeDelta], [latitude + latitudeDelta, longitude + longitudeDelta]]),
        { padding: [28, 28], maxZoom: FOLLOW_ZOOM, animate: started.current },
      );
    } else if (!started.current) {
      map.setView([latitude, longitude], FOLLOW_ZOOM, { animate: false });
    } else {
      map.panTo([latitude, longitude], { animate: true });
    }
    started.current = true;
  }, [accuracy, latitude, longitude, map]);

  return null;
}

function FitMap({ location, safeZones }: { location: SafetyLocation; safeZones: SafeZone[] }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [
      [location.latitude, location.longitude],
      ...safeZones.flatMap((zone) => {
        const latitudeDelta = zone.radiusMeters / 111_320;
        const longitudeDelta = zone.radiusMeters / (111_320 * Math.cos((zone.latitude * Math.PI) / 180));
        return [
          [zone.latitude - latitudeDelta, zone.longitude - longitudeDelta] as [number, number],
          [zone.latitude + latitudeDelta, zone.longitude + longitudeDelta] as [number, number],
        ];
      }),
    ];

    map.fitBounds(latLngBounds(points), { padding: [28, 28], maxZoom: 16, animate: true });
  }, [location.latitude, location.longitude, map, safeZones]);

  return null;
}
