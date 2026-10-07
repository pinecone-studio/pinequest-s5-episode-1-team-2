"use client";

import { useEffect } from "react";
import { latLngBounds } from "leaflet";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { SAFE_ZONES } from "@/lib/safe-zones";
import type { SafeZone, SafetyLocation } from "@/types/safety";

type LiveMapProps = {
  location: SafetyLocation;
  safeZones?: SafeZone[];
  currentRoute?: [number, number][];
  familiarRoute?: [number, number][];
  className?: string;
};

export default function LiveMap({ location, safeZones = SAFE_ZONES, currentRoute = [], familiarRoute = [], className = "" }: LiveMapProps) {
  const center: [number, number] = [location.latitude, location.longitude];

  return (
    <div className={`safepath-map relative isolate overflow-hidden rounded-[20px] border border-[#e7e7e5] bg-[#f7f7f5] ${className}`}>
      <MapContainer
        center={center}
        zoom={14}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom
        touchZoom
        className="absolute inset-0 z-0 size-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {safeZones.map((zone, index) => (
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
        {familiarRoute.length > 1 && <Polyline positions={familiarRoute} pathOptions={{ color: "#77776f", weight: 3, opacity: 0.45, dashArray: "5 7" }} />}
        {currentRoute.length > 1 && <Polyline positions={currentRoute} pathOptions={{ color: "#2e7d4f", weight: 4, opacity: 0.8 }} />}
        <CircleMarker
          center={center}
          radius={9}
          pathOptions={{ color: "#ffffff", fillColor: "#111111", fillOpacity: 1, weight: 4 }}
        />
        <FitMap location={location} safeZones={safeZones} />
      </MapContainer>

      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute right-2 top-2 z-[400] rounded-xl bg-white/90 px-2 py-1 text-[10px] text-[#737373]">© OpenStreetMap</a>

    </div>
  );
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
