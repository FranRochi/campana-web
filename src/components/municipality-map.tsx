"use client";

import "leaflet/dist/leaflet.css";

import { geoJSON as leafletGeoJSON, type LatLngBoundsExpression, type Layer } from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";

import type { GeoJsonFeature, PbaGeoJson } from "@/types/campaign";
import { BLOQUE_COLORS, getMunicipioBloque } from "@/lib/bloque";

export type MapFilters = {
  bloque: string;
  seccion: string;
  fortaleza: string;
  fortalezaProvincial: string;
};

type Props = {
  geojson: PbaGeoJson;
  selectedMunicipality: string | null;
  onSelect: (feature: GeoJsonFeature) => void;
  activeFilters?: MapFilters;
};

function getBloqueColor(m: GeoJsonFeature["properties"]["municipio"]): string {
  if (!m) return BLOQUE_COLORS.sd;
  const bloque = getMunicipioBloque(m.frente, m.partido);
  return BLOQUE_COLORS[bloque] ?? BLOQUE_COLORS.sd;
}

function featureMatchesFilters(m: GeoJsonFeature["properties"]["municipio"], activeFilters?: MapFilters): boolean {
  if (!activeFilters) return true;

  if (activeFilters.bloque !== "all") {
    const bloque = m ? getMunicipioBloque(m.frente, m.partido) : "sd";
    if (bloque !== activeFilters.bloque) return false;
  }

  if (activeFilters.seccion !== "all") {
    if (!m || m.seccion_electoral_nombre !== activeFilters.seccion) return false;
  }

  if (activeFilters.fortaleza !== "all" && activeFilters.fortaleza !== "mostrar") {
    const score = calcFortalezaScore(m);
    const nivel = getFortalezaNivel(score);
    if (nivel !== activeFilters.fortaleza) return false;
  }

  if (activeFilters.fortalezaProvincial !== "all" && activeFilters.fortalezaProvincial !== "mostrar") {
    const score = calcFortalezaProvincialScore(m);
    const nivel = getFortalezaProvincialNivel(score);
    if (nivel !== activeFilters.fortalezaProvincial) return false;
  }

  return true;
}

type MunicipioGeo = NonNullable<GeoJsonFeature["properties"]["municipio"]>;

function scaleIntendente2023(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (value >= 50) return 1;
  if (value >= 45) return 0.9;
  if (value >= 40) return 0.8;
  if (value >= 35) return 0.7;
  if (value >= 30) return 0.5;
  return 0.3;
}

function scaleConcejales2025(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (value >= 50) return 1;
  if (value >= 45) return 0.9;
  if (value >= 40) return 0.8;
  if (value >= 35) return 0.7;
  if (value >= 30) return 0.5;
  return 0.3;
}

function scaleControlConcejo(value: MunicipioGeo["control_concejo"]): number | null {
  if (value === "mayoria") return 1;
  if (value === "mitad") return 0.5;
  if (value === "minoria") return 0;
  return null;
}

function scaleTendencia(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (value > 5) return 1;
  if (value > 1) return 0.8;
  if (value >= -1) return 0.5;
  if (value >= -5) return 0.2;
  return 0;
}

function scaleTrayectoriaMandatos(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (value >= 3) return 1;
  if (value === 2) return 0.7;
  if (value === 1) return 0.4;
  return 0;
}

function scaleContinuidadPolitica(m: MunicipioGeo): number | null {
  if (m.electo !== true) return null;
  if (m.reelecto === true) return 1;
  if ((m.cantidad_mandatos ?? 0) >= 2) return 0.7;
  if ((m.cantidad_mandatos ?? 0) === 1) return 0.3;
  return null;
}

function scaleProvincial(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (value >= 50) return 1;
  if (value >= 40) return 0.8;
  if (value >= 35) return 0.65;
  if (value >= 30) return 0.45;
  return 0.25;
}

export function calcFortalezaProvincialScore(m: MunicipioGeo | null | undefined): number | null {
  if (!m) return null;
  const prov2023 = scaleProvincial(m.porcentaje_gobernador_2023);
  const prov2025 = scaleProvincial(m.porcentaje_provincial_2025);
  if (prov2023 == null && prov2025 == null) return null;
  let score = 0;
  let weight = 0;
  if (prov2023 != null) { score += prov2023 * 50; weight += 50; }
  if (prov2025 != null) { score += prov2025 * 50; weight += 50; }
  return (score / weight) * 100;
}

export function getFortalezaProvincialNivel(score: number | null): "fuerte" | "competitivo" | "debil" | "muy_debil" | null {
  if (score == null) return null;
  if (score >= 65) return "fuerte";
  if (score >= 45) return "competitivo";
  if (score >= 28) return "debil";
  return "muy_debil";
}

export const FORTALEZA_PROVINCIAL_COLORS: Record<string, string> = {
  fuerte: "#16A34A",
  competitivo: "#A3E635",
  debil: "#F87171",
  muy_debil: "#991B1B",
};

export function calcFortalezaScore(m: MunicipioGeo | null | undefined): number | null {
  if (!m) return null;
  let score = 0;
  let maxWeight = 0;

  const porcentaje2023 = scaleIntendente2023(m.porcentaje_2023);
  if (porcentaje2023 != null) {
    score += porcentaje2023 * 25;
    maxWeight += 25;
  }
  const controlConcejo = scaleControlConcejo(m.control_concejo);
  if (controlConcejo != null) {
    score += controlConcejo * 10;
    maxWeight += 10;
  }

  const trayectoria = scaleTrayectoriaMandatos(m.cantidad_mandatos);
  if (trayectoria != null) {
    score += trayectoria * 10;
    maxWeight += 10;
  }

  const continuidad = scaleContinuidadPolitica(m);
  if (continuidad != null) {
    score += continuidad * 10;
    maxWeight += 10;
  }
  const tendencia = scaleTendencia(m.tendencia_2023_2025);
  if (tendencia != null) {
    score += tendencia * 20;
    maxWeight += 20;
  }
  const porcentaje2025 = scaleConcejales2025(m.porcentaje_concejales_2025);
  if (porcentaje2025 != null) {
    score += porcentaje2025 * 25;
    maxWeight += 25;
  }

  if (maxWeight === 0) return null;
  return (score / maxWeight) * 100;
}

export function getFortalezaNivel(score: number | null): "fuerte" | "competitivo" | "debil" | null {
  if (score == null) return null;
  if (score >= 70) return "fuerte";
  if (score >= 45) return "competitivo";
  return "debil";
}

export const FORTALEZA_COLORS: Record<string, string> = {
  fuerte: "#22C55E",
  competitivo: "#F59E0B",
  debil: "#EF4444",
};

function getFeatureCentroid(feature: GeoJsonFeature): [number, number] | null {
  const geom = feature.geometry as { type: string; coordinates: unknown };
  let ring: number[][] | undefined;
  if (geom.type === "Polygon") {
    ring = (geom.coordinates as number[][][])[0];
  } else if (geom.type === "MultiPolygon") {
    ring = (geom.coordinates as number[][][][])[0]?.[0];
  }
  if (!ring || ring.length === 0) return null;
  let lat = 0, lng = 0;
  for (const pt of ring) {
    lng += pt[0];
    lat += pt[1];
  }
  return [lat / ring.length, lng / ring.length];
}

function MapViewport({
  geojson,
  selectedMunicipality,
}: {
  geojson: PbaGeoJson;
  selectedMunicipality: string | null;
}) {
  const map = useMap();

  const provinceBounds = useMemo<LatLngBoundsExpression | null>(() => {
    const layer = leafletGeoJSON(geojson as unknown as GeoJSON.GeoJsonObject);
    return layer.getBounds().isValid() ? layer.getBounds() : null;
  }, [geojson]);

  useEffect(() => {
    if (!selectedMunicipality) {
      if (provinceBounds) {
        map.fitBounds(provinceBounds, { padding: [24, 24], maxZoom: 8 });
      }
      return;
    }

    const target = geojson.features.find(
      (f) => f.properties.nombre_normalizado === selectedMunicipality,
    );
    if (!target) {
      if (provinceBounds) map.fitBounds(provinceBounds, { padding: [24, 24], maxZoom: 8 });
      return;
    }

    const layer = leafletGeoJSON(target as unknown as GeoJSON.GeoJsonObject);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      // Use a modest zoom so the surrounding area stays visible
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 9 });
    }
  }, [geojson, map, provinceBounds, selectedMunicipality]);

  return null;
}

export function MunicipalityMap({ geojson, selectedMunicipality, onSelect, activeFilters }: Props) {
  const filterKey = activeFilters ? JSON.stringify(activeFilters) : "none";
  const showFortaleza = activeFilters ? activeFilters.fortaleza !== "all" : false;
  const showFortalezaProvincial = activeFilters ? activeFilters.fortalezaProvincial !== "all" : false;
  const seccionMode = activeFilters ? activeFilters.seccion !== "all" : false;

  return (
    <MapContainer
      center={[-37.5, -60.5]}
      zoom={6}
      zoomControl={false}
      style={{ minHeight: "640px" }}
    >
      <ZoomControl position="bottomright" />
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
      />
      <MapViewport geojson={geojson} selectedMunicipality={selectedMunicipality} />
      <GeoJSON
        key={filterKey + (selectedMunicipality ?? "")}
        data={geojson as unknown as GeoJSON.GeoJsonObject}
        style={(feature) => {
          const properties = feature?.properties as GeoJsonFeature["properties"];
          const isActive = selectedMunicipality === properties.nombre_normalizado;
          const m = properties.municipio;

          // ── Section visualization mode ──
          if (seccionMode) {
            const inSection = m?.seccion_electoral_nombre === activeFilters?.seccion;
            if (!inSection) {
              return {
                color: "rgba(200,205,214,0.4)",
                weight: 0.4,
                fillColor: "#C8CDD6",
                fillOpacity: 0.18,
              };
            }
            return {
              color: isActive ? "#0F1F3D" : "#1B2B4B",
              weight: isActive ? 3 : 2.2,
              fillColor: getBloqueColor(m),
              fillOpacity: isActive ? 0.95 : 0.88,
            };
          }

          const hidden = !featureMatchesFilters(m, activeFilters);

          if (!hidden && showFortalezaProvincial) {
            const score = calcFortalezaProvincialScore(m);
            const nivel = getFortalezaProvincialNivel(score);
            const provColor = nivel ? FORTALEZA_PROVINCIAL_COLORS[nivel] : "#D1D5DB";
            return {
              color: isActive ? "#1B2B4B" : "rgba(255,255,255,0.85)",
              weight: isActive ? 2.4 : 0.9,
              fillColor: provColor,
              fillOpacity: isActive ? 0.95 : 0.82,
            };
          }

          return {
            color: isActive ? "#1B2B4B" : "rgba(255,255,255,0.7)",
            weight: isActive ? 2.4 : 0.9,
            fillColor: hidden ? "#E8EDF4" : getBloqueColor(m),
            fillOpacity: hidden ? 0.25 : (isActive ? 0.92 : 0.8),
          };
        }}
        onEachFeature={(feature, layer: Layer) => {
          const typedFeature = feature as unknown as GeoJsonFeature;
          const nombre = typedFeature.properties.municipio?.nombre || typedFeature.properties.nam;
          if (nombre) {
            layer.bindTooltip(nombre, {
              sticky: true,
              direction: "top",
              offset: [0, -6],
              className: "municipio-tooltip",
            });
          }
          layer.on({ click: () => onSelect(typedFeature) });
        }}
      />

      {showFortaleza && geojson.features.map((feature) => {
        const centroid = getFeatureCentroid(feature);
        if (!centroid) return null;

        const m = feature.properties.municipio;
        if (!featureMatchesFilters(m, activeFilters)) return null;

        const score = calcFortalezaScore(m);
        const nivel = getFortalezaNivel(score);
        const color = nivel ? FORTALEZA_COLORS[nivel] : "#9CA3AF";

        return (
          <CircleMarker
            key={`f-${feature.properties.nombre_normalizado}`}
            center={centroid}
            radius={7}
            pane="markerPane"
            pathOptions={{
              color: "white",
              weight: 1.5,
              fillColor: color,
              fillOpacity: nivel ? 0.92 : 0.55,
            }}
            eventHandlers={{
              click: () => onSelect(feature),
            }}
          />
        );
      })}
    </MapContainer>
  );
}

