"use client";

/**
 * ClinicLocationPicker
 *
 * Uses Leaflet imperatively (no react-leaflet) to avoid the
 * "Map container is already initialized" error caused by React 18
 * Strict Mode double-invoking effects.
 *
 * Stack:
 *   - Leaflet 1.x          — map + marker (imperative API)
 *   - OpenStreetMap tiles   — free, no API key
 *   - Nominatim             — free address search + reverse geocode
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Public types ──────────────────────────────────────────────────────────────

export interface ClinicLocation {
  address: string;
  city: string;
  lat: number;
  lng: number;
}

interface Props {
  value?: ClinicLocation | null;
  onChange: (loc: ClinicLocation) => void;
  label?: string;
}

// ── Nominatim ─────────────────────────────────────────────────────────────────

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
}

async function nominatimSearch(q: string): Promise<NominatimResult[]> {
  const p = new URLSearchParams({ q, format: "json", addressdetails: "1", limit: "5", countrycodes: "ph" });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, {
    headers: { "Accept-Language": "en" },
  });
  return r.json();
}

async function nominatimReverse(lat: number, lng: number): Promise<NominatimResult | null> {
  const p = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "json", addressdetails: "1" });
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?${p}`, {
    headers: { "Accept-Language": "en" },
  });
  return r.ok ? r.json() : null;
}

function extractCity(r: NominatimResult): string {
  const a = r.address;
  return a.city ?? a.town ?? a.municipality ?? a.county ?? a.state ?? "";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842];
const DEFAULT_ZOOM = 13;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClinicLocationPicker({
  value,
  onChange,
  label = "Clinic Location",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Store the Leaflet map instance — typed as `unknown` to avoid importing
  // Leaflet types at module level (they reference `window`).
  const mapRef    = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);

  const [query, setQuery]           = useState(value?.address ?? "");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Place / move marker ───────────────────────────────────────────────────
  const placeMarker = useCallback(
    (lat: number, lng: number, address: string, city: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L;
      if (!L || !mapRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = mapRef.current as any;

      if (markerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (markerRef.current as any).setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (markerRef.current as any).on("dragend", async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pos = (markerRef.current as any).getLatLng();
          const result = await nominatimReverse(pos.lat, pos.lng);
          const addr = result?.display_name ?? `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
          const c    = result ? extractCity(result) : "";
          setQuery(addr);
          onChange({ address: addr, city: c, lat: pos.lat, lng: pos.lng });
        });
      }

      map.setView([lat, lng], 16);
      setQuery(address);
      onChange({ address, city, lat, lng });
    },
    [onChange],
  );

  // ── Init Leaflet imperatively ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamically import Leaflet CSS + library (client-only)
    let destroyed = false;

    import("leaflet/dist/leaflet.css").then(() =>
      import("leaflet").then((mod) => {
        if (destroyed || !containerRef.current) return;

        const L = mod.default ?? mod;

        // Inject into window so placeMarker callback can access it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).L = L;

        // Fix broken default marker icons (webpack asset hashing)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const center: [number, number] = value
          ? [value.lat, value.lng]
          : DEFAULT_CENTER;

        const map = L.map(containerRef.current!, {
          center,
          zoom: value ? 16 : DEFAULT_ZOOM,
          zoomControl: true,
        });

        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        // Place existing pin
        if (value) {
          markerRef.current = L.marker([value.lat, value.lng], { draggable: true }).addTo(map);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (markerRef.current as any).on("dragend", async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pos = (markerRef.current as any).getLatLng();
            const result = await nominatimReverse(pos.lat, pos.lng);
            const addr = result?.display_name ?? `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
            const c    = result ? extractCity(result) : "";
            setQuery(addr);
            onChange({ address: addr, city: c, lat: pos.lat, lng: pos.lng });
          });
        }

        // Click-to-pin
        map.on("click", async (e: { latlng: { lat: number; lng: number } }) => {
          const { lat, lng } = e.latlng;
          const result = await nominatimReverse(lat, lng);
          const addr = result?.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          const c    = result ? extractCity(result) : "";
          placeMarker(lat, lng, addr, c);
        });
      }),
    );

    // Cleanup — remove map on unmount so re-mount (Strict Mode) starts fresh
    return () => {
      destroyed = true;
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current as any).remove();
        mapRef.current  = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // ── Address search ────────────────────────────────────────────────────────
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        setSuggestions(await nominatimSearch(val));
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSelect = (r: NominatimResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    const city = extractCity(r);
    setSuggestions([]);
    placeMarker(lat, lng, r.display_name, city);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        {label}
      </Label>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search clinic address in the Philippines…"
          className="pl-8 pr-8"
        />
        {searching ? (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { setQuery(""); setSuggestions([]); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        {suggestions.length > 0 && (
          <ul className="absolute z-[9999] mt-1 w-full bg-background border border-border rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
                  onClick={() => handleSelect(r)}
                >
                  <MapPin className="inline h-3 w-3 mr-1.5 text-primary shrink-0" />
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map container — Leaflet mounts into this div */}
      <div
        ref={containerRef}
        className="w-full rounded-xl border border-border overflow-hidden h-[280px]"
        aria-label="Clinic location map"
      />

      {value && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3 shrink-0 text-primary" />
          <span className="truncate">{value.address}</span>
          <span className="ml-auto shrink-0 opacity-50">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Search an address or click the map to pin your clinic location. Drag the pin to adjust.
      </p>
    </div>
  );
}
