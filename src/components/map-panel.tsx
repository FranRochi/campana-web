"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  calcFortalezaProvincialScore,
  calcFortalezaScore,
  FORTALEZA_COLORS,
  FORTALEZA_PROVINCIAL_COLORS,
  getContinuidadPoliticaLabel,
  getFortalezaNivel,
  getFortalezaProvincialNivel,
} from "@/lib/fortaleza";
import type { FiltroConfig, GeoJsonFeature, MunicipioDetalle, PbaGeoJson } from "@/types/campaign";
import { BLOQUE_COLORS, getMunicipioBloque } from "@/lib/bloque";
import type { MapFilters } from "./municipality-map";

import styles from "./map-panel.module.css";

const DynamicMap = dynamic(
  () => import("@/components/municipality-map").then((m) => m.MunicipalityMap),
  { ssr: false },
);

import type { FuerzaElectoral } from "@/types/campaign";

function num(value: number | null | undefined) {
  return value != null ? value.toLocaleString("es-AR") : "--";
}

function FuerzasList({ fuerzas }: { fuerzas: FuerzaElectoral[] }) {
  return (
    <div className={styles.concejalesList}>
      {fuerzas.slice(0, 4).map((f) => {
        const pct = parseFloat(f.porcentaje ?? "0");
        return (
          <div key={f.nombre}>
            <div className={styles.concejalRow}>
              <span className={styles.concejalName}>{f.nombre}</span>
              <span className={styles.concejalPct}>{pct.toFixed(1)}%</span>
            </div>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function forceColor(name: string): string {
  const n = name.toUpperCase();
  if (n.includes("CELESTE") || n.includes("FUERZA PATRIA") || n.includes("UNION POR LA PATRIA") || n.includes("FRENTE")) return BLOQUE_COLORS.fp;
  if (n.includes("VIOLETA") || n.includes("LIBERTAD AVANZA")) return BLOQUE_COLORS.lla;
  if (n.includes("AMARILLO") || n.includes("JUNTOS") || n.includes("CAMBIEMOS") || n.includes("PRO")) return BLOQUE_COLORS.jxc;
  if (n.includes("ROSA")) return BLOQUE_COLORS.otro;
  const palette = [BLOQUE_COLORS.otro, "#34C759", "#FF9500", "#5AC8FA"];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
}

function resolveColor(value: string | null | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const n = raw.toUpperCase();
  if (raw.startsWith("#")) return raw;
  if (n === "CELESTE") return BLOQUE_COLORS.fp;
  if (n === "VIOLETA") return BLOQUE_COLORS.lla;
  if (n === "AMARILLO") return BLOQUE_COLORS.jxc;
  if (n === "ROSA") return BLOQUE_COLORS.otro;
  return "";
}

function concejoMayorityLabel(value: "mayoria" | "mitad" | "minoria" | null | undefined): string {
  if (value === "mayoria") return "Si";
  if (value === "mitad") return "Mitad";
  if (value === "minoria") return "No";
  return "--";
}

function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pt`;
}

const BLOQUE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "fp", label: "PJ / Fuerza Patria", color: BLOQUE_COLORS.fp },
  { value: "jxc", label: "PRO / Juntos por el Cambio", color: BLOQUE_COLORS.jxc },
  { value: "lla", label: "Libertad Avanza", color: BLOQUE_COLORS.lla },
  { value: "otro", label: "Vecinalistas / Independientes", color: BLOQUE_COLORS.otro },
  { value: "sd", label: "Sin datos", color: "#BDBDBD" },
];

const FORTALEZA_OPTIONS = [
  { value: "all", label: "Sin capa", color: undefined },
  { value: "mostrar", label: "Mostrar todos", color: undefined },
  { value: "fuerte", label: "Liderazgo fuerte", color: FORTALEZA_COLORS.fuerte },
  { value: "competitivo", label: "Liderazgo competitivo", color: FORTALEZA_COLORS.competitivo },
  { value: "debil", label: "Liderazgo débil", color: FORTALEZA_COLORS.debil },
];

const FORTALEZA_LABELS: Record<string, string> = {
  fuerte: "Fuerte",
  competitivo: "Competitivo",
  debil: "Débil",
};

const FORTALEZA_PROVINCIAL_OPTIONS = [
  { value: "all", label: "Sin capa", color: undefined },
  { value: "mostrar", label: "Mostrar todos", color: undefined },
  { value: "fuerte", label: "Consolidado", color: FORTALEZA_PROVINCIAL_COLORS.fuerte },
  { value: "competitivo", label: "En disputa - Favorable", color: FORTALEZA_PROVINCIAL_COLORS.competitivo },
  { value: "debil", label: "En disputa - Desfavorable", color: FORTALEZA_PROVINCIAL_COLORS.debil },
  { value: "muy_debil", label: "Crítico", color: FORTALEZA_PROVINCIAL_COLORS.muy_debil },
];

const FORTALEZA_PROVINCIAL_LABELS: Record<string, string> = {
  fuerte: "Consolidado",
  competitivo: "En disputa · Favorable",
  debil: "En disputa · Desfavorable",
  muy_debil: "Crítico",
};

type FilterKey = keyof MapFilters;

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
    </svg>
  );
}

export function MapPanel() {
  const [geojson, setGeojson] = useState<PbaGeoJson | null>(null);
  const [selected, setSelected] = useState<GeoJsonFeature | null>(null);
  const [detalle, setDetalle] = useState<MunicipioDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fortalezaConfig, setFortalezaConfig] = useState<FiltroConfig | null>(null);
  const [activeFilters, setActiveFilters] = useState<MapFilters>({
    bloque: "all",
    seccion: "all",
    fortaleza: "all",
    fortalezaProvincial: "all",
  });
  const [openDropdown, setOpenDropdown] = useState<FilterKey | null>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); setError("Sin sesión activa."); return; }
    Promise.all([
      apiRequest<PbaGeoJson>("/maps/pba/", { token }),
      apiRequest<FiltroConfig>("/maps/filtros/fortaleza/", { token }).catch(() => null),
    ])
      .then(([geo, config]) => {
        setGeojson(geo);
        if (config) setFortalezaConfig(config);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar el mapa."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleSelect(feature: GeoJsonFeature) {
    setSelected(feature);
    setDetalle(null);
    const token = getToken();
    if (!token || !feature.properties.nombre_normalizado) return;
    try {
      const response = await apiRequest<MunicipioDetalle>(
        `/municipalities/${feature.properties.nombre_normalizado}/`,
        { token },
      );
      setDetalle(response);
    } catch {
      setDetalle(null);
    }
  }

  const secciones = useMemo(() => {
    if (!geojson) return [];
    const seen = new Set<string>();
    const result: { value: string; label: string }[] = [];
    for (const f of geojson.features) {
      const m = f.properties.municipio;
      if (m?.seccion_electoral_nombre && !seen.has(m.seccion_electoral_nombre)) {
        seen.add(m.seccion_electoral_nombre);
        result.push({ value: m.seccion_electoral_nombre, label: m.seccion_electoral_nombre });
      }
    }
    return result.sort((a, b) => a.label.localeCompare(b.label));
  }, [geojson]);

  // Section summary data (for the panel when a section is selected and no municipality is clicked)
  const sectionData = useMemo(() => {
    if (!geojson || activeFilters.seccion === "all") return null;
    const features = geojson.features.filter(
      (f) => f.properties.municipio?.seccion_electoral_nombre === activeFilters.seccion,
    );
    const totalPob = features.reduce((sum, f) => sum + (f.properties.municipio?.poblacion_2025 ?? 0), 0);
    const totalPadron = features.reduce((sum, f) => sum + (f.properties.municipio?.padron ?? 0), 0);
    const totalPadronProv = geojson.features.reduce((sum, f) => sum + (f.properties.municipio?.padron ?? 0), 0);
    const pctPadron = totalPadronProv > 0 ? (totalPadron / totalPadronProv) * 100 : null;
    const municipios = features.map((f) => f.properties.municipio).filter(Boolean) as NonNullable<GeoJsonFeature["properties"]["municipio"]>[];
    return { nombre: activeFilters.seccion, totalPob, totalPadron, pctPadron, municipios, count: features.length };
  }, [geojson, activeFilters.seccion]);

  function setFilter(key: FilterKey, value: string) {
    setActiveFilters((prev) => ({ ...prev, [key]: value }));
    setOpenDropdown(null);
    // Clear municipality selection when changing section
    if (key === "seccion") setSelected(null);
  }

  const EMPTY_FILTERS: MapFilters = { bloque: "all", seccion: "all", fortaleza: "all", fortalezaProvincial: "all" };

  function toggleDropdown(key: FilterKey) {
    setOpenDropdown((prev) => (prev === key ? null : key));
  }

  const hasActiveFilter = Object.values(activeFilters).some((v) => v !== "all");

  if (loading) return <div className={styles.loading}>Cargando mapa provincial...</div>;
  if (error || !geojson) return <div className={styles.loading}>{error || "Sin datos."}</div>;

  const municipio = selected?.properties.municipio;
  const concejalesResult = detalle?.resultados?.find((r) => r.cargo === "Concejales" && r.anio === 2025) ?? null;
  const intendResult = detalle?.resultados?.find((r) => r.cargo === "Intendente" && r.anio === 2023) ?? null;
  const gobResult = detalle?.resultados?.find((r) => r.cargo === "Gobernador" && r.anio === 2023) ?? null;
  const provincialResult2025 = detalle?.resultados?.find((r) => r.nivel === "provincial" && r.anio === 2025) ?? null;

  const fortalezaScore = calcFortalezaScore(municipio);
  const fortalezaNivel = getFortalezaNivel(fortalezaScore);
  const fortalezaProvincialScore = calcFortalezaProvincialScore(municipio);
  const fortalezaProvincialNivel = getFortalezaProvincialNivel(fortalezaProvincialScore);

  function getFpPorcentaje(fuerzas: FuerzaElectoral[]): number | null {
    let total = 0;
    let found = false;
    for (const f of fuerzas) {
      const n = f.nombre.toUpperCase();
      if (
        n.includes("FUERZA PATRIA") || n.includes("UNION POR LA PATRIA") ||
        n.includes("FRENTE DE TODOS") || n.includes("FRENTE PARA LA VICTORIA")
      ) {
        const pct = parseFloat(f.porcentaje ?? "0");
        if (!isNaN(pct)) { total += pct; found = true; }
      }
    }
    return found ? total : null;
  }

  const fpGob2023 = gobResult ? getFpPorcentaje(gobResult.fuerzas) : null;
  const fpProv2025 = provincialResult2025 ? getFpPorcentaje(provincialResult2025.fuerzas) : null;
  const fpTendenciaProvincial = fpGob2023 != null && fpProv2025 != null ? fpProv2025 - fpGob2023 : null;

  const partidoColor = resolveColor(municipio?.color) || forceColor(municipio?.frente || municipio?.partido || "");
  const poblacion2022 = detalle?.poblacion_2022 ?? municipio?.poblacion_2022 ?? null;
  const poblacion2025 = detalle?.poblacion_2025 ?? municipio?.poblacion_2025 ?? null;
  const padronMunicipio = detalle?.padron ?? municipio?.padron ?? null;

  const justificativo = detalle?.intendente?.justificativo_fortaleza;

  // Panel content: section overview OR municipality detail
  const showSectionPanel = activeFilters.seccion !== "all" && !selected && sectionData;

  return (
    <div className={styles.page}>
      <div className={styles.mapWrap}>
        <DynamicMap
          geojson={geojson}
          selectedMunicipality={selected?.properties.nombre_normalizado ?? null}
          onSelect={handleSelect}
          activeFilters={activeFilters}
        />

        {/* ── FILTER BAR ── */}
        <div className={styles.filtersBar} ref={filterBarRef}>
          {/* Bloque */}
          <div className={styles.filterWrap}>
            <button
              type="button"
              className={`${styles.filterBtn} ${activeFilters.bloque !== "all" ? styles.filterBtnActive : ""}`}
              onClick={() => toggleDropdown("bloque")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>
              Bloque político
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.chevron}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {openDropdown === "bloque" && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownHeader}>Filtrar por bloque</div>
                {BLOQUE_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" className={`${styles.dropdownOption} ${activeFilters.bloque === opt.value ? styles.dropdownSelected : ""}`} onClick={() => setFilter("bloque", opt.value)}>
                    {opt.color && <span className={styles.optDot} style={{ background: opt.color }} />}
                    {!opt.color && <span className={styles.optDot} style={{ background: "#ccc" }} />}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sección Electoral */}
          <div className={styles.filterWrap}>
            <button
              type="button"
              className={`${styles.filterBtn} ${activeFilters.seccion !== "all" ? styles.filterBtnActive : ""}`}
              onClick={() => toggleDropdown("seccion")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Sección Electoral
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.chevron}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {openDropdown === "seccion" && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownHeader}>Sección electoral</div>
                <button type="button" className={`${styles.dropdownOption} ${activeFilters.seccion === "all" ? styles.dropdownSelected : ""}`} onClick={() => setFilter("seccion", "all")}>
                  Todas las secciones
                </button>
                {secciones.map((s) => (
                  <button key={s.value} type="button" className={`${styles.dropdownOption} ${activeFilters.seccion === s.value ? styles.dropdownSelected : ""}`} onClick={() => setFilter("seccion", s.value)}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Liderazgo local */}
          <div className={styles.filterGroup}>
            <div className={styles.filterWrap}>
              <button
                type="button"
                className={`${styles.filterBtn} ${activeFilters.fortaleza !== "all" ? styles.filterBtnActive : ""}`}
                onClick={() => toggleDropdown("fortaleza")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                Liderazgo local
                {activeFilters.fortaleza !== "all" && activeFilters.fortaleza !== "mostrar" && (
                  <span
                    className={styles.fortalezaDot}
                    style={{ background: FORTALEZA_COLORS[activeFilters.fortaleza] ?? "#ccc" }}
                  />
                )}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.chevron}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {openDropdown === "fortaleza" && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>Liderazgo local</div>
                  {FORTALEZA_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${styles.dropdownOption} ${activeFilters.fortaleza === opt.value ? styles.dropdownSelected : ""}`}
                      onClick={() => setFilter("fortaleza", opt.value)}
                    >
                      {opt.color
                        ? <span className={styles.optDot} style={{ background: opt.color }} />
                        : <span className={styles.optDot} style={{ background: "#E4E7ED", border: "1px solid #ccc" }} />
                      }
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.filterInfoWrap}>
              <span className={styles.filterInfoIcon}><InfoIcon /></span>
              <div className={styles.filterInfoTooltip}>
                Ponderación del resultado municipal 2023, la performance de la lista local en 2025 y la capacidad de retención de mayoría en el Concejo Deliberante actual.
              </div>
            </div>
          </div>

          {/* Performance de Fuerza Patria */}
          <div className={styles.filterGroup}>
            <div className={styles.filterWrap}>
              <button
                type="button"
                className={`${styles.filterBtn} ${activeFilters.fortalezaProvincial !== "all" ? styles.filterBtnActive : ""}`}
                onClick={() => toggleDropdown("fortalezaProvincial")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Performance de Fuerza Patria
                {activeFilters.fortalezaProvincial !== "all" && activeFilters.fortalezaProvincial !== "mostrar" && (
                  <span
                    className={styles.fortalezaDot}
                    style={{ background: FORTALEZA_PROVINCIAL_COLORS[activeFilters.fortalezaProvincial] ?? "#ccc" }}
                  />
                )}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.chevron}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {openDropdown === "fortalezaProvincial" && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>Performance de Fuerza Patria</div>
                  {FORTALEZA_PROVINCIAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${styles.dropdownOption} ${activeFilters.fortalezaProvincial === opt.value ? styles.dropdownSelected : ""}`}
                      onClick={() => setFilter("fortalezaProvincial", opt.value)}
                    >
                      {opt.color
                        ? <span className={styles.optDot} style={{ background: opt.color }} />
                        : <span className={styles.optDot} style={{ background: "#E4E7ED", border: "1px solid #ccc" }} />
                      }
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.filterInfoWrap}>
              <span className={styles.filterInfoIcon}><InfoIcon /></span>
              <div className={styles.filterInfoTooltip} style={{ left: "auto", right: 0, transform: "none" }}>
                Evaluación del voto en categorías provinciales (Gobernador 2023 / Senadores-Diputados 2025). Mide la base electoral de Fuerza Patria en cada distrito.
              </div>
            </div>
          </div>

          {/* Clear all */}
          {hasActiveFilter && (
            <button
              type="button"
              className={styles.filterClear}
              onClick={() => { setActiveFilters(EMPTY_FILTERS); setSelected(null); }}
            >
              Limpiar
            </button>
          )}
        </div>

        {/* ── LEGEND ── */}
        <div className={styles.legend}>
          <div className={styles.legendTitle}>Intendente</div>
          <div className={styles.legendItem}><span className={styles.legendDot} style={{ background: BLOQUE_COLORS.fp }} />Fuerza Patria</div>
          <div className={styles.legendItem}><span className={styles.legendDot} style={{ background: BLOQUE_COLORS.jxc }} />PRO / Juntos por el Cambio</div>
          <div className={styles.legendItem}><span className={styles.legendDot} style={{ background: BLOQUE_COLORS.lla }} />La Libertad Avanza</div>
          <div className={styles.legendItem}><span className={styles.legendDot} style={{ background: BLOQUE_COLORS.otro }} />Vecinalistas / Independientes</div>
          <div className={styles.legendItem}><span className={styles.legendDot} style={{ background: "#BDBDBD" }} />Sin datos</div>
          {activeFilters.fortaleza !== "all" && (
            <>
              <div className={styles.legendDivider} />
              <div className={styles.legendTitle}>Liderazgo local</div>
              <div className={styles.legendItem}><span className={styles.legendCircle} style={{ background: FORTALEZA_COLORS.fuerte }} />Liderazgo fuerte</div>
              <div className={styles.legendItem}><span className={styles.legendCircle} style={{ background: FORTALEZA_COLORS.competitivo }} />Liderazgo competitivo</div>
              <div className={styles.legendItem}><span className={styles.legendCircle} style={{ background: FORTALEZA_COLORS.debil }} />Liderazgo débil</div>
            </>
          )}
          {activeFilters.fortalezaProvincial !== "all" && (
            <>
              <div className={styles.legendDivider} />
              <div className={styles.legendTitle}>Performance FP</div>
              <div className={styles.legendItem}><span className={styles.legendCircle} style={{ background: FORTALEZA_PROVINCIAL_COLORS.fuerte }} />Consolidado</div>
              <div className={styles.legendItem}><span className={styles.legendCircle} style={{ background: FORTALEZA_PROVINCIAL_COLORS.competitivo }} />En disputa - Favorable</div>
              <div className={styles.legendItem}><span className={styles.legendCircle} style={{ background: FORTALEZA_PROVINCIAL_COLORS.debil }} />En disputa - Desfavorable</div>
              <div className={styles.legendItem}><span className={styles.legendCircle} style={{ background: FORTALEZA_PROVINCIAL_COLORS.muy_debil }} />Crítico</div>
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT INFO PANEL ── */}
      <aside className={styles.panel}>
        {showSectionPanel ? (
          /* ── SECTION PANEL ── */
          <>
            <div className={styles.panelHeader}>
              <div className={styles.panelEyebrow}>SECCIÓN ELECTORAL</div>
              <div className={styles.panelTitle}>{sectionData.nombre}</div>
              <div className={styles.panelSub}>{sectionData.count} municipios</div>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.infoSection}>
                <div className={styles.infoLabel}>Datos del padrón</div>
                <div className={styles.popRow}>
                  <div className={styles.popItem}>
                    <span className={styles.popYear}>Población 2025</span>
                    <span className={styles.popVal}>{num(sectionData.totalPob)}</span>
                  </div>
                  <div className={styles.popDivider} />
                  <div className={styles.popItem}>
                    <span className={styles.popYear}>Padrón</span>
                    <span className={styles.popVal}>{num(sectionData.totalPadron)}</span>
                  </div>
                </div>
                {sectionData.pctPadron != null && (
                  <div className={styles.participacionRow}>
                    <span>% del padrón provincial</span>
                    <strong>{sectionData.pctPadron.toFixed(1)}%</strong>
                  </div>
                )}
              </div>

              <div className={styles.infoSection}>
                <div className={styles.infoLabel}>Municipios de la sección</div>
                <div className={styles.sectionMunicipioList}>
                  {sectionData.municipios.map((m) => (
                    <div key={m.nombre} className={styles.sectionMunicipioRow}>
                      <span
                        className={styles.sectionMunicipioDot}
                        style={{ background: BLOQUE_COLORS[getMunicipioBloque(m.frente, m.partido)] ?? "#BDBDBD" }}
                      />
                      <span className={styles.sectionMunicipioName}>{m.nombre}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.sectionHint}>
                Hacé clic en un municipio para ver su información detallada.
              </div>
            </div>
          </>
        ) : (
          /* ── MUNICIPALITY PANEL ── */
          <>
            <div className={styles.panelHeader}>
              <div className={styles.panelEyebrow}>MAPA PBA</div>
              <div className={styles.panelTitle}>{municipio?.nombre ?? "—"}</div>
              <div className={styles.panelSub}>
                {municipio
                  ? `Sección ${municipio.seccion_electoral_nombre || municipio.seccion_electoral_numero || "—"}`
                  : "Sección —"}
              </div>
            </div>

            <div className={styles.panelBody}>
              {!municipio ? (
                <div className={styles.empty}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25 }}>
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
                    <line x1="8" y1="2" x2="8" y2="18"/>
                    <line x1="16" y1="6" x2="16" y2="22"/>
                  </svg>
                  <p>Hacé clic en un municipio para ver su información</p>
                </div>
              ) : (
                <>
                  {/* ── INTENDENTE ── */}
                  <div className={styles.infoSection}>
                    <div className={styles.infoLabel}>Intendente</div>
                    <div className={styles.intendenteHeader}>
                      <div className={styles.intendenteNombre}>{municipio.intendente || "--"}</div>
                      {(municipio.frente || municipio.partido) && (
                        <div className={styles.partyBadge}>
                          <span className={styles.partyDot} style={{ background: partidoColor }} />
                          {municipio.frente || municipio.partido}
                        </div>
                      )}
                    </div>
                  </div>

                  {activeFilters.fortaleza !== "all" && fortalezaNivel && (
                    <div className={styles.infoSection}>
                      <div className={styles.infoLabel}>Liderazgo local</div>
                      <div className={styles.fortalezaBadge} style={{ borderColor: FORTALEZA_COLORS[fortalezaNivel] }}>
                        <span
                          className={styles.fortalezaCircleIndicator}
                          style={{ background: FORTALEZA_COLORS[fortalezaNivel] }}
                        />
                        <span className={styles.fortalezaNivelLabel}>{FORTALEZA_LABELS[fortalezaNivel]}</span>
                        {fortalezaScore != null && (
                          <span className={styles.fortalezaScoreNum}>{fortalezaScore.toFixed(0)} pts</span>
                        )}
                      </div>
                      <div className={styles.fortalezaDesglose}>
                        {municipio.porcentaje_2023 != null && (
                          <div className={styles.fortalezaRow}>
                            <span>% electoral 2023</span>
                            <strong>{municipio.porcentaje_2023.toFixed(1)}%</strong>
                          </div>
                        )}
                        {municipio.porcentaje_concejales_2025 != null && (
                          <div className={styles.fortalezaRow}>
                            <span>% concejales 2025</span>
                            <strong>{municipio.porcentaje_concejales_2025.toFixed(1)}%</strong>
                          </div>
                        )}
                        {municipio.tendencia_2023_2025 != null && (
                          <div className={styles.fortalezaRow}>
                            <span>Tendencia 2023-2025</span>
                            <strong style={{ color: municipio.tendencia_2023_2025 > 0 ? "#16A34A" : municipio.tendencia_2023_2025 < 0 ? "#EF4444" : undefined }}>
                              {formatDelta(municipio.tendencia_2023_2025)}
                            </strong>
                          </div>
                        )}
                        {(municipio.electo != null || municipio.interino != null) && (
                          <div className={styles.fortalezaRow}>
                            <span>Tipo mandato</span>
                            <strong>{municipio.interino ? "Interino" : "Electo"}</strong>
                          </div>
                        )}
                        {municipio.cantidad_mandatos != null && (
                          <div className={styles.fortalezaRow}>
                            <span>Trayectoria mandatos</span>
                            <strong>{municipio.cantidad_mandatos}</strong>
                          </div>
                        )}
                        {municipio.electo === true && (
                          <div className={styles.fortalezaRow}>
                            <span>Continuidad política</span>
                            <strong>{getContinuidadPoliticaLabel(municipio)}</strong>
                          </div>
                        )}
                        {municipio.control_concejo != null && (
                          <div className={styles.fortalezaRow}>
                            <span>Mayoría en Concejo</span>
                            <strong>{concejoMayorityLabel(municipio.control_concejo)}</strong>
                          </div>
                        )}
                      </div>
                      {justificativo && (
                        <p className={styles.justificativoText}>{justificativo}</p>
                      )}
                    </div>
                  )}

                  {activeFilters.fortalezaProvincial !== "all" ? (
                    <>
                      {/* ── BADGE PROVINCIAL ── */}
                      {fortalezaProvincialNivel && (
                        <div className={styles.infoSection}>
                          <div className={styles.infoLabel}>Performance de Fuerza Patria</div>
                          <div className={styles.fortalezaBadge} style={{ borderColor: FORTALEZA_PROVINCIAL_COLORS[fortalezaProvincialNivel] }}>
                            <span className={styles.fortalezaCircleIndicator} style={{ background: FORTALEZA_PROVINCIAL_COLORS[fortalezaProvincialNivel] }} />
                            <span className={styles.fortalezaNivelLabel}>{FORTALEZA_PROVINCIAL_LABELS[fortalezaProvincialNivel]}</span>
                            {fortalezaProvincialScore != null && (
                              <span className={styles.fortalezaScoreNum}>{fortalezaProvincialScore.toFixed(0)} pts</span>
                            )}
                          </div>

                          {/* FP summary numbers */}
                          <div className={styles.fortalezaDesglose}>
                            {fpGob2023 != null && (
                              <div className={styles.fortalezaRow}>
                                <span>FP Gobernador 2023</span>
                                <strong>{fpGob2023.toFixed(1)}%</strong>
                              </div>
                            )}
                            {fpProv2025 != null && (
                              <div className={styles.fortalezaRow}>
                                <span>FP Provincial 2025</span>
                                <strong>{fpProv2025.toFixed(1)}%</strong>
                              </div>
                            )}
                            {fpTendenciaProvincial != null && (
                              <div className={styles.fortalezaRow}>
                                <span>Tendencia FP 2023→2025</span>
                                <strong style={{ color: fpTendenciaProvincial > 0 ? "#16A34A" : fpTendenciaProvincial < 0 ? "#EF4444" : "#6B7280" }}>
                                  {formatDelta(fpTendenciaProvincial)}
                                </strong>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── GOBERNADOR 2023 ── */}
                      {gobResult && (
                        <div className={styles.infoSection}>
                          <div className={styles.infoLabel}>Gobernador 2023</div>
                          <FuerzasList fuerzas={gobResult.fuerzas} />
                          {gobResult.participacion_porcentaje && (
                            <div className={styles.participacionRow}>
                              <span>Participación</span>
                              <strong>{parseFloat(gobResult.participacion_porcentaje).toFixed(1)}%</strong>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── PROVINCIAL 2025 ── */}
                      {provincialResult2025 && (
                        <div className={styles.infoSection}>
                          <div className={styles.infoLabel}>{provincialResult2025.cargo} 2025</div>
                          <FuerzasList fuerzas={provincialResult2025.fuerzas} />
                          {provincialResult2025.participacion_porcentaje && (
                            <div className={styles.participacionRow}>
                              <span>Participación</span>
                              <strong>{parseFloat(provincialResult2025.participacion_porcentaje).toFixed(1)}%</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : activeFilters.fortaleza === "all" ? (
                    <>
                      {/* ── POBLACIÓN ── */}
                      <div className={styles.infoSection}>
                        <div className={styles.infoLabel}>Población</div>
                        <div className={styles.popRow}>
                          <div className={styles.popItem}>
                            <span className={styles.popYear}>2022</span>
                            <span className={styles.popVal}>{num(poblacion2022)}</span>
                          </div>
                          <div className={styles.popDivider} />
                          <div className={styles.popItem}>
                            <span className={styles.popYear}>2025</span>
                            <span className={styles.popVal}>{num(poblacion2025)}</span>
                          </div>
                        </div>
                        <div className={styles.participacionRow}>
                          <span>Padrón</span>
                          <strong>{num(padronMunicipio)}</strong>
                        </div>
                      </div>

                      {/* ── CONCEJALES 2025 ── */}
                      {concejalesResult && (
                        <div className={styles.infoSection}>
                          <div className={styles.infoLabel}>Concejales 2025</div>
                          <FuerzasList fuerzas={concejalesResult.fuerzas} />
                          <div className={styles.participacionRow}>
                            <span>Padrón</span>
                            <strong>{num(concejalesResult.padron)}</strong>
                          </div>
                          {concejalesResult.participacion_porcentaje && (
                            <div className={styles.participacionRow}>
                              <span>Participación</span>
                              <strong>{parseFloat(concejalesResult.participacion_porcentaje).toFixed(1)}%</strong>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── INTENDENTE 2023 ── */}
                      {intendResult && (
                        <div className={styles.infoSection}>
                          <div className={styles.infoLabel}>Intendente 2023</div>
                          <FuerzasList fuerzas={intendResult.fuerzas} />
                          {intendResult.participacion_porcentaje && (
                            <div className={styles.participacionRow}>
                              <span>Participación</span>
                              <strong>{parseFloat(intendResult.participacion_porcentaje).toFixed(1)}%</strong>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── GOBERNADOR 2023 ── */}
                      {gobResult && (
                        <div className={styles.infoSection}>
                          <div className={styles.infoLabel}>Gobernador 2023</div>
                          <FuerzasList fuerzas={gobResult.fuerzas} />
                          {gobResult.participacion_porcentaje && (
                            <div className={styles.participacionRow}>
                              <span>Padrón</span>
                              <strong>{num(gobResult.padron)}</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* ── INTENDENTE 2023 (modo fortaleza) ── */}
                      {intendResult && (
                        <div className={styles.infoSection}>
                          <div className={styles.infoLabel}>Intendente 2023</div>
                          <FuerzasList fuerzas={intendResult.fuerzas} />
                          {intendResult.participacion_porcentaje && (
                            <div className={styles.participacionRow}>
                              <span>Participación</span>
                              <strong>{parseFloat(intendResult.participacion_porcentaje).toFixed(1)}%</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
