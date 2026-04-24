import type { GeoJsonFeature } from "@/types/campaign";

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

export function getContinuidadPoliticaLabel(m: MunicipioGeo | null | undefined): string {
  if (!m || m.electo !== true) return "--";
  if (m.reelecto === true) return "Reelecto";
  if ((m.cantidad_mandatos ?? 0) >= 2) return "Retorno";
  if ((m.cantidad_mandatos ?? 0) === 1) return "Nuevo";
  return "--";
}

function scaleContinuidadPolitica(m: MunicipioGeo): number | null {
  if (m.electo !== true) return null;
  if (m.reelecto === true) return 1;
  if ((m.cantidad_mandatos ?? 0) >= 2) return 0.7;
  if ((m.cantidad_mandatos ?? 0) === 1) return 0.3;
  return null;
}

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

// ── FORTALEZA PROVINCIAL ──────────────────────────────────────────────────────

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
