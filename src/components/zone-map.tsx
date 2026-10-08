"use client";

import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { SafeZone } from "@/types/safety";

type Point = { latitude: number; longitude: number };

type ZoneMapProps = {
  center: Point;
  zones: SafeZone[];
  /** The zone being added: its centre and size. */
  draft: Point | null;
  draftRadius: number;
  childPosition: Point | null;
  onPick: (latitude: number, longitude: number) => void;
};

/** A map for placing safe zones: tap to choose the centre of a new zone. */
export default function ZoneMap({ center, zones, draft, draftRadius, childPosition, onPick }: ZoneMapProps) {
  return (
    <MapContainer center={[center.latitude, center.longitude]} zoom={15} className="size-full" aria-label="Аюулгүй бүсийн газрын зураг">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution="&copy; OpenStreetMap" />
      {zones.map((zone) => (
        <Circle key={zone.id} center={[zone.latitude, zone.longitude]} radius={zone.radiusMeters} pathOptions={{ color: "#2e7d4f", fillColor: "#2e7d4f", fillOpacity: 0.1, weight: 1.5 }}>
          <Tooltip direction="top" permanent>{zone.name}</Tooltip>
        </Circle>
      ))}
      {childPosition && (
        <CircleMarker center={[childPosition.latitude, childPosition.longitude]} radius={7} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#111111", fillOpacity: 1 }} />
      )}
      {draft && (
        <Circle center={[draft.latitude, draft.longitude]} radius={draftRadius} pathOptions={{ color: "#e3433b", fillColor: "#e3433b", fillOpacity: 0.1, weight: 2, dashArray: "6 6" }} />
      )}
      <PickOnClick onPick={onPick} />
      <ShowDraft draft={draft} />
    </MapContainer>
  );
}

function PickOnClick({ onPick }: { onPick: ZoneMapProps["onPick"] }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

/** Brings a centre picked with "use my location" into view if it is off screen. */
function ShowDraft({ draft }: { draft: Point | null }) {
  const map = useMap();
  useEffect(() => {
    if (draft && !map.getBounds().contains([draft.latitude, draft.longitude])) map.setView([draft.latitude, draft.longitude]);
  }, [draft, map]);
  return null;
}
