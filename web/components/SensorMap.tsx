"use client";
// Interactive sensor map. One round marker per device, coloured by AQI with the number
// inside; the selected device's geohash cell is outlined (devices publish only that cell).
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Rectangle, TileLayer, Tooltip, useMap } from "react-leaflet";
import { aqi, aqiStyle } from "@/lib/aqi";
import { decode } from "@/lib/geohash";
import { x10 } from "@/lib/format";
import type { Device } from "@/lib/types";

export interface FlyTarget { lat: number; lon: number; zoom?: number; key: number }

const MUMBAI: [number, number] = [19.08, 72.89];

/** Spread devices that share a cell around its centre so markers don't stack. */
function positions(devices: Device[]) {
  const byCell = new Map<string, Device[]>();
  for (const d of devices) byCell.set(d.geohash, [...(byCell.get(d.geohash) ?? []), d]);
  const out = new Map<string, [number, number]>();
  for (const [hash, ds] of byCell) {
    const c = decode(hash);
    ds.forEach((d, i) => {
      if (ds.length === 1) return out.set(d.device, [c.lat, c.lon]);
      const a = (2 * Math.PI * i) / ds.length;
      out.set(d.device, [c.lat + 0.0018 * Math.sin(a), c.lon + 0.0024 * Math.cos(a)]);
    });
  }
  return out;
}

function icon(d: Device, selected: boolean, pulse: boolean) {
  const r = d.last_reading;
  const v = r ? aqi(r.pm25_x10, r.pm10_x10) : null;
  const s = v != null ? aqiStyle(v) : { bg: "#9ca3af", fg: "#fff" };
  const size = selected ? 36 : 30;
  const cls = ["aqi-marker", selected && "selected", d.status === "flagged" && "flagged", d.status === "slashed" && "slashed", pulse && "pulse"]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="${cls}" style="width:${size}px;height:${size}px;background:${s.bg};color:${s.fg}">${d.status === "slashed" ? "✕" : (v ?? "–")}</div>`,
  });
}

function Fly({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], target.zoom ?? 13, { duration: 0.8 });
  }, [target, map]);
  return null;
}

export default function SensorMap({ devices, selected, onSelect, fly, height = 520 }: {
  devices: Device[];
  selected: string | null;
  onSelect: (device: string) => void;
  fly: FlyTarget | null;
  height?: number;
}) {
  const pos = useMemo(() => positions(devices), [devices]);

  // Pulse a marker briefly whenever its device sends a new reading.
  const lastNonce = useRef(new Map<string, number>());
  const [pulsing, setPulsing] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fresh: string[] = [];
    for (const d of devices) {
      const n = d.last_reading?.nonce ?? 0;
      const prev = lastNonce.current.get(d.device);
      if (prev != null && n > prev) fresh.push(d.device);
      lastNonce.current.set(d.device, n);
    }
    if (!fresh.length) return;
    setPulsing(new Set(fresh));
    const t = setTimeout(() => setPulsing(new Set()), 900);
    return () => clearTimeout(t);
  }, [devices]);

  const sel = devices.find((d) => d.device === selected);
  const cell = sel ? decode(sel.geohash).bounds : null;

  return (
    <MapContainer center={MUMBAI} zoom={11} scrollWheelZoom style={{ height, width: "100%" }} className="rounded-[14px]">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        className="pn-tiles"
      />
      <Fly target={fly} />
      {cell && (
        <Rectangle
          bounds={[[cell[0], cell[1]], [cell[2], cell[3]]]}
          pathOptions={{ color: "#4338ca", weight: 1.5, dashArray: "4 4", fillOpacity: 0.06 }}
        />
      )}
      {devices.map((d) => {
        const p = pos.get(d.device);
        if (!p) return null;
        const r = d.last_reading;
        return (
          <Marker
            key={d.device}
            position={p}
            icon={icon(d, d.device === selected, pulsing.has(d.device))}
            eventHandlers={{ click: () => onSelect(d.device) }}
            zIndexOffset={d.device === selected ? 1000 : 0}
            keyboard
            title={d.ens}
          >
            <Tooltip direction="top" offset={[0, -16]}>
              <div className="text-xs">
                <div className="font-semibold">{d.ens}</div>
                {r ? <div>PM2.5 {x10(r.pm25_x10)} · PM10 {x10(r.pm10_x10)} µg/m³</div> : <div>No readings</div>}
                <div className="text-gray-500">
                  cell {d.geohash} · {d.status}
                  {d.simulated ? " · simulated" : ""}
                </div>
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
