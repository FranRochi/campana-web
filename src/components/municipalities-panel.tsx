"use client";

import { useEffect, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { BLOQUE_COLORS, getMunicipioBloque } from "@/lib/bloque";
import { FORTALEZA_COLORS, calcFortalezaScore, getFortalezaNivel } from "@/lib/fortaleza";
import type {
  FuerzaElectoral,
  GeoJsonFeature,
  MunicipioDetalle,
  MunicipioTablaFila,
  PaginatedResponse,
  PbaGeoJson,
  ResultadoElectoral,
} from "@/types/campaign";

import styles from "./municipalities-panel.module.css";

/* ── helpers ──────────────────────────────────────────────── */
function fmt(n: number | null | undefined) { return n != null ? n.toLocaleString("es-AR") : "—"; }
function fmtPct(n: number | null | undefined) { return n != null ? `${n.toFixed(1)}%` : "—"; }
function norm(s: string) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

const BLOQUE_LABELS: Record<string, string> = {
  fp: "PJ / Fuerza Patria", lla: "La Libertad Avanza",
  jxc: "JxC / PRO", otro: "Otros / Locales", sd: "Sin datos",
};
const FORTALEZA_LABELS: Record<string, string> = {
  fuerte: "Fuerte", competitivo: "Competitivo", debil: "Débil",
};

const POSICIONAMIENTO: Record<string, { label: string; color: string; bg: string }> = {
  propio_consolidado: { label: "Territorio propio consolidado", color: "#16A34A", bg: "#DCFCE7" },
  propio_riesgo:      { label: "Territorio propio en riesgo",   color: "#D97706", bg: "#FEF3C7" },
  disputado:          { label: "Territorio disputado",          color: "#753bbd", bg: "#F5F0FF" },
  adverso:            { label: "Territorio adverso",            color: "#DC2626", bg: "#FEE2E2" },
};

function getPosicionamiento(bloque: string, pct: number | null) {
  if (bloque === "fp") {
    if (pct == null) return POSICIONAMIENTO.propio_riesgo;
    if (pct >= 50) return POSICIONAMIENTO.propio_consolidado;
    if (pct >= 40) return POSICIONAMIENTO.propio_riesgo;
    return POSICIONAMIENTO.disputado;
  }
  return (pct != null && pct >= 40) ? POSICIONAMIENTO.disputado : POSICIONAMIENTO.adverso;
}

function getFPPct(fuerzas: FuerzaElectoral[]): number | null {
  const pats = ["FUERZA PATRIA", "UNION POR LA PATRIA", "FRENTE DE TODOS", "FRENTE PARA LA VICTORIA", "PARTIDO JUSTICIALISTA"];
  for (const pat of pats) {
    const f = fuerzas.find(x => x.nombre.toUpperCase().includes(pat));
    if (f?.porcentaje != null) return parseFloat(f.porcentaje);
  }
  return null;
}
function getWinnerPct(fuerzas: FuerzaElectoral[]): number | null {
  const s = [...fuerzas].sort((a, b) => parseFloat(b.porcentaje ?? "0") - parseFloat(a.porcentaje ?? "0"));
  return s[0]?.porcentaje != null ? parseFloat(s[0].porcentaje) : null;
}
function getTopTwo(fuerzas: FuerzaElectoral[]): [FuerzaElectoral | null, FuerzaElectoral | null] {
  const s = [...fuerzas].sort((a, b) => parseFloat(b.porcentaje ?? "0") - parseFloat(a.porcentaje ?? "0"));
  return [s[0] ?? null, s[1] ?? null];
}
function getElection(resultados: ResultadoElectoral[], anio: number, nivel: string) {
  return resultados.find(r => r.anio === anio && r.nivel === nivel) ?? null;
}
/* ── PBA SVG Map ─────────────────────────────────────────── */
const PBA_MIN_LNG = -63.6, PBA_MAX_LNG = -56.4;
const PBA_MIN_LAT = -41.6, PBA_MAX_LAT = -32.8;
const SVG_W = 220, SVG_H = 240;

function project(lng: number, lat: number): [number, number] {
  const x = ((lng - PBA_MIN_LNG) / (PBA_MAX_LNG - PBA_MIN_LNG)) * SVG_W;
  const y = ((PBA_MAX_LAT - lat) / (PBA_MAX_LAT - PBA_MIN_LAT)) * SVG_H;
  return [x, y];
}

function ringToPath(ring: number[][], step = 3): string {
  const pts = ring.filter((_, i) => i % step === 0 || i === ring.length - 1);
  return pts.map(([lng, lat], i) => {
    const [x, y] = project(lng, lat);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + " Z";
}

function geomToPath(geom: GeoJsonFeature["geometry"]): string {
  if (geom.type === "Polygon") {
    return geom.coordinates.map(r => ringToPath(r as number[][])).join(" ");
  }
  if (geom.type === "MultiPolygon") {
    return (geom.coordinates as number[][][][]).map(poly =>
      poly.map(r => ringToPath(r)).join(" ")
    ).join(" ");
  }
  return "";
}

function PBAMapSVG({ features, selectedNorm, color }: {
  features: GeoJsonFeature[];
  selectedNorm: string;
  color: string;
}) {
  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} xmlns="http://www.w3.org/2000/svg" className={styles.mapSvg}>
      {features.map(f => {
        const isSelected =
          norm(f.properties.nombre_normalizado || "") === selectedNorm ||
          norm(f.properties.nam || "") === selectedNorm;
        const d = geomToPath(f.geometry);
        if (!d) return null;
        return (
          <path
            key={f.properties.nombre_normalizado}
            d={d}
            fill={isSelected ? color : "#C8D8E8"}
            stroke="#ffffff"
            strokeWidth={isSelected ? "1" : "0.4"}
            opacity={isSelected ? 1 : 0.75}
          />
        );
      })}
    </svg>
  );
}

/* ── Mock data (seeded, hasta que se carguen datos reales) ── */
function getMockData(nombre: string, poblacion: number | null | undefined) {
  const pop  = poblacion || 10000;
  const seed = (nombre.charCodeAt(0) || 65) + (nombre.charCodeAt(nombre.length - 1) || 65);
  const rng  = (min: number, max: number) => min + ((seed * 7 + pop) % (max - min + 1));
  return {
    obrasHechas:       rng(55, 92),
    rutasReparadas:    rng(18, 45),
    escuelasProvinc:   rng(5, 80),
    escuelasMunic:     rng(2, 30),
    matriculaTotal:    rng(800, 18000),
    caps:              rng(2, 25),
    hospitalesProvinc: rng(1, 6),
    hospitalesMunic:   rng(0, 3),
    pobConsumos:       rng(10, 35),
    subsidiosActivos:  rng(4, 20),
    programasSociales: rng(6, 28),
    superavit:         rng(1, 15) * 100_000,
    gastosDevengados:  rng(50, 200) * 1_000_000,
    recursosPercibidos:rng(60, 220) * 1_000_000,
    poderPolitico:     (["Bajo", "Medio", "Alto"] as const)[seed % 3],
    internaFuerza:     ["Movimiento Derecho al Futuro", "La Cámpora", "Kolina", "Renovación PJ"][(seed + 2) % 4],
    eventos:           [
      `Aniversario de ${nombre.split(" ")[0]}`,
      `Expo${nombre.split(" ")[0]}`,
      "Festival regional",
    ],
  };
}

/* ── Ficha ───────────────────────────────────────────────── */
function Ficha({ m, features, onBack }: { m: MunicipioDetalle; features: GeoJsonFeature[]; onBack: () => void }) {
  const bloque      = getMunicipioBloque(m.intendente?.frente, m.intendente?.partido);
  const bloqueColor = BLOQUE_COLORS[bloque] || "#BDBDBD";
  const selectedNorm = norm(m.nombre_normalizado || m.nombre);

  const r2023   = getElection(m.resultados, 2023, "municipal");
  const r2025   = getElection(m.resultados, 2025, "municipal");
  const rGob23  = getElection(m.resultados, 2023, "provincial");
  const rProv25 = getElection(m.resultados, 2025, "provincial");

  const pct2023   = r2023   ? (getFPPct(r2023.fuerzas) ?? getWinnerPct(r2023.fuerzas)) : null;
  const pct2025   = r2025   ? getFPPct(r2025.fuerzas)   : null;
  const pctGob23  = rGob23  ? getFPPct(rGob23.fuerzas)  : null;
  const pctProv25 = rProv25 ? getFPPct(rProv25.fuerzas) : null;
  const tendencia = pct2023 != null && pct2025 != null ? pct2025 - pct2023 : null;

  const mockGeo = {
    porcentaje_2023: pct2023, porcentaje_concejales_2025: pct2025,
    tendencia_2023_2025: tendencia, control_concejo: null,
    electo: null, interino: null, reelecto: null, cantidad_mandatos: null,
    porcentaje_gobernador_2023: pctGob23, porcentaje_provincial_2025: pctProv25,
  } as Parameters<typeof calcFortalezaScore>[0];

  const fortalezaScore = calcFortalezaScore(mockGeo);
  const fortalezaNivel = getFortalezaNivel(fortalezaScore);
  const fortalezaColor = fortalezaNivel ? FORTALEZA_COLORS[fortalezaNivel] : "#9CA3AF";
  const fortalezaPct   = fortalezaScore != null ? Math.round(fortalezaScore) : 0;
  const posicionamiento = getPosicionamiento(bloque, pct2023);

  const historial = [...m.resultados].sort((a, b) => b.anio - a.anio);

  const initials = m.intendente
    ? m.intendente.nombre.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
    : "—";

  const ex = getMockData(m.nombre, m.poblacion_2025 ?? m.poblacion_2022);

  const PODER_COLORS: Record<string, { color: string; bg: string }> = {
    Bajo:  { color: "#DC2626", bg: "#FEE2E2" },
    Medio: { color: "#D97706", bg: "#FEF3C7" },
    Alto:  { color: "#16A34A", bg: "#DCFCE7" },
  };
  const poderStyle = PODER_COLORS[ex.poderPolitico] ?? PODER_COLORS.Medio;
  const poderPct = ex.poderPolitico === "Bajo" ? 15 : ex.poderPolitico === "Medio" ? 50 : 85;

  return (
    <>
      {/* ── Desktop layout ─────────────────────────────── */}
      <div className={styles.dFicha}>
        <div className={styles.fichaLayout}>

          {/* LEFT COL: map + basic info */}
          <div className={styles.fichaLeft}>
            <div className={styles.fichaCard}>
              <div className={styles.fichaCardTitle}>Provincia de Buenos Aires</div>
              <div className={styles.fichaMapWrap}>
                {features.length > 0 ? (
                  <PBAMapSVG features={features} selectedNorm={selectedNorm} color={bloqueColor} />
                ) : (
                  <div className={styles.mapPlaceholder}><div className={styles.mapSpinner} /></div>
                )}
                <div className={styles.fichaMapLegend}>
                  <div className={styles.fichaMapLegendItem}>
                    <span className={styles.fichaMapLegendDot} style={{ background: bloqueColor }} />{m.nombre}
                  </div>
                  <div className={styles.fichaMapLegendItem}>
                    <span className={styles.fichaMapLegendDot} style={{ background: "#C8D8E8" }} />Otros municipios
                  </div>
                </div>
              </div>
              <div className={styles.fichaInfoList}>
                <div className={styles.fichaInfoRow}>
                  <span className={styles.fichaInfoLbl}>👥 Habitantes</span>
                  <span className={styles.fichaInfoVal}>{fmt(m.poblacion_2025 ?? m.poblacion_2022)}</span>
                </div>
                <div className={styles.fichaInfoRow}>
                  <span className={styles.fichaInfoLbl}>🗳️ Electores</span>
                  <span className={styles.fichaInfoVal}>{fmt(m.padron)}</span>
                </div>
                <div className={styles.fichaInfoRow}>
                  <span className={styles.fichaInfoLbl}>🏛️ Sección</span>
                  <span className={styles.fichaInfoVal}>{m.seccion_electoral_nombre || `Sección ${m.seccion_electoral_numero}` || "—"}</span>
                </div>
                <div className={styles.fichaInfoRow}>
                  <span className={styles.fichaInfoLbl}>🔵 Bloque</span>
                  <span className={styles.fichaInfoVal} style={{ color: bloqueColor }}>{BLOQUE_LABELS[bloque]}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COL */}
          <div className={styles.fichaRight}>

            {/* Intendente row */}
            <div className={styles.fichaCardRow}>
              <div className={styles.fichaCardTitle}>Situación sociopolítica</div>
              <div className={styles.fichaSocioRow}>
                <div className={styles.avatar} style={{ background: `linear-gradient(135deg, ${bloqueColor}cc, ${bloqueColor}77)` }}>
                  {initials}
                </div>
                <div className={styles.fichaSocioInfo}>
                  <div className={styles.fichaSocioName}>{m.intendente?.nombre ?? "—"}</div>
                  <div className={styles.fichaSocioCargo}>Intendente/a de {m.nombre}</div>
                  {m.intendente?.partido && <div className={styles.fichaSocioPartido}>{m.intendente.partido}</div>}
                  {m.intendente?.frente && m.intendente.frente !== m.intendente.partido && (
                    <div className={styles.fichaSocioFrente}>{m.intendente.frente}</div>
                  )}
                </div>
                <div className={styles.fichaTlRow}>
                  {historial.slice(0, 3).map((r, i) => {
                    const [t1] = getTopTwo(r.fuerzas);
                    return (
                      <div key={`tl-${i}`} className={styles.fichaTlCard}>
                        <div className={styles.fichaTlYear}>{r.anio}</div>
                        <div className={styles.fichaTlCargo}>{r.cargo}</div>
                        {t1?.porcentaje && <div className={styles.fichaTlPct}>{parseFloat(t1.porcentaje).toFixed(1)}%</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mid: 5 institutional sections */}
            <div className={styles.fichaMid}>
              <div className={styles.fichaSec}>
                <div className={styles.fichaSecHeader}>
                  <div className={styles.fichaSecIcon} style={{ background: "#EDFAF4", color: "#2E9E6B" }}>🏗️</div>
                  <div className={styles.fichaSecTitle}>Obras y Rutas</div>
                </div>
                <div className={styles.fichaBig} style={{ color: "#2E9E6B" }}>{ex.obrasHechas}%</div>
                <div className={styles.fichaBigSub}>avance de obras</div>
                <div className={styles.fichaProgTrack}><div className={styles.fichaProgFill} style={{ width: `${ex.obrasHechas}%`, background: "#2E9E6B" }} /></div>
                <div className={styles.fichaSecRow}><span className={styles.fichaSecLbl}>Rutas reparadas</span><span className={styles.fichaSecNum}>{ex.rutasReparadas}%</span></div>
              </div>
              <div className={styles.fichaSec}>
                <div className={styles.fichaSecHeader}>
                  <div className={styles.fichaSecIcon} style={{ background: "#EFF7FD", color: "#4F8FC0" }}>🎓</div>
                  <div className={styles.fichaSecTitle}>Educación</div>
                </div>
                <div className={styles.fichaBig} style={{ color: "#4F8FC0" }}>{ex.matriculaTotal.toLocaleString("es-AR")}</div>
                <div className={styles.fichaBigSub}>alumnos matriculados</div>
                <div className={styles.fichaSecRow}><span className={styles.fichaSecLbl}>Escuelas prov.</span><span className={styles.fichaSecNum}>{ex.escuelasProvinc}</span></div>
                <div className={styles.fichaSecRow}><span className={styles.fichaSecLbl}>Escuelas mun.</span><span className={styles.fichaSecNum}>{ex.escuelasMunic}</span></div>
              </div>
              <div className={styles.fichaSec}>
                <div className={styles.fichaSecHeader}>
                  <div className={styles.fichaSecIcon} style={{ background: "#FEF2F2", color: "#D63C3C" }}>🏥</div>
                  <div className={styles.fichaSecTitle}>Salud</div>
                </div>
                <div className={styles.fichaBig} style={{ color: "#D63C3C" }}>{ex.caps}</div>
                <div className={styles.fichaBigSub}>CAPS activos</div>
                <div className={styles.fichaSecRow}><span className={styles.fichaSecLbl}>Hosp. prov.</span><span className={styles.fichaSecNum}>{ex.hospitalesProvinc}</span></div>
                <div className={styles.fichaSecRow}><span className={styles.fichaSecLbl}>Hosp. mun.</span><span className={styles.fichaSecNum}>{ex.hospitalesMunic}</span></div>
                <div className={styles.fichaSecRow}><span className={styles.fichaSecLbl}>Cobertura</span><span className={styles.fichaSecNum}>{ex.pobConsumos}%</span></div>
              </div>
              <div className={styles.fichaSec}>
                <div className={styles.fichaSecHeader}>
                  <div className={styles.fichaSecIcon} style={{ background: "#EDFAF4", color: "#2E9E6B" }}>💵</div>
                  <div className={styles.fichaSecTitle}>Economía y Coparte.</div>
                </div>
                <div className={styles.fichaBig} style={{ color: "#2E9E6B", fontSize: "13px", fontWeight: 700, margin: "2px 0" }}>
                  ${(ex.superavit / 1_000_000).toFixed(1)}M
                </div>
                <div className={styles.fichaBigSub}>superávit estimado</div>
                <div className={styles.fichaSecRow}><span className={styles.fichaSecLbl}>Gastos dev.</span><span className={styles.fichaSecNum}>${(ex.gastosDevengados / 1_000_000).toFixed(0)}M</span></div>
                <div className={styles.fichaSecRow}><span className={styles.fichaSecLbl}>Recursos</span><span className={styles.fichaSecNum}>${(ex.recursosPercibidos / 1_000_000).toFixed(0)}M</span></div>
              </div>
              <div className={styles.fichaSec}>
                <div className={styles.fichaSecHeader}>
                  <div className={styles.fichaSecIcon} style={{ background: "#F5F0FF", color: "#753bbd" }}>🤝</div>
                  <div className={styles.fichaSecTitle}>Desarrollo Social</div>
                </div>
                <div className={styles.fichaSecRow}><span className={styles.fichaSecLbl}>Subsidios activos</span><span className={styles.fichaSecNum}>{ex.subsidiosActivos}</span></div>
                <div className={styles.fichaSecRow}><span className={styles.fichaSecLbl}>Prog. sociales</span><span className={styles.fichaSecNum}>{ex.programasSociales}</span></div>
                <div className={styles.fichaSecDivider} />
                <div className={styles.fichaEventsHeader}>🎉 Eventos</div>
                <div className={styles.fichaEventsList}>
                  {ex.eventos.map((ev, i) => <div key={i}>· {ev}</div>)}
                </div>
              </div>
            </div>

            {/* Bottom: 4 analysis cards */}
            <div className={styles.fichaBot}>
              <div className={styles.fichaPolCard}>
                <div className={styles.fichaPolCardHeader}>
                  <div className={styles.fichaPolCardIcon} style={{ background: poderStyle.bg, color: poderStyle.color }}>🌐</div>
                  <div className={styles.fichaPolCardTitle}>Poder Político Territorial</div>
                </div>
                <div className={styles.fichaSliderTrack}><div className={styles.fichaSliderFill} style={{ width: `${poderPct}%` }} /></div>
                <div className={styles.fichaSliderLabels}><span>Bajo</span><span>Medio</span><span>Alto</span></div>
                <div className={styles.fichaPolResult} style={{ background: poderStyle.bg, color: poderStyle.color }}>{ex.poderPolitico.toUpperCase()}</div>
              </div>
              <div className={styles.fichaPolCard}>
                <div className={styles.fichaPolCardHeader}>
                  <div className={styles.fichaPolCardIcon} style={{ background: "#EFF7FD", color: "#1b4f84" }}>💪</div>
                  <div className={styles.fichaPolCardTitle}>Fortaleza del Intendente</div>
                </div>
                <div className={styles.fichaSliderTrack}><div className={styles.fichaSliderFill} style={{ width: `${fortalezaPct}%` }} /></div>
                <div className={styles.fichaSliderLabels}><span>Débil</span><span>Competit.</span><span>Fuerte</span></div>
                <div className={styles.fichaPolResult} style={{ background: fortalezaColor + "22", color: fortalezaColor }}>
                  {fortalezaNivel ? FORTALEZA_LABELS[fortalezaNivel].toUpperCase() : "SIN DATOS"}
                </div>
              </div>
              <div className={styles.fichaPolCard}>
                <div className={styles.fichaPolCardHeader}>
                  <div className={styles.fichaPolCardIcon} style={{ background: posicionamiento.bg, color: posicionamiento.color }}>🚩</div>
                  <div className={styles.fichaPolCardTitle}>Posicionamiento Territorial</div>
                </div>
                <div className={styles.fichaPolDesc}><strong>{m.intendente?.nombre ?? "—"}</strong> · {m.intendente?.partido ?? ""}</div>
                <div className={styles.fichaPolResult} style={{ background: posicionamiento.bg, color: posicionamiento.color }}>{posicionamiento.label.toUpperCase()}</div>
              </div>
              <div className={styles.fichaPolCard}>
                <div className={styles.fichaPolCardHeader}>
                  <div className={styles.fichaPolCardIcon} style={{ background: bloqueColor + "22", color: bloqueColor }}>⚖️</div>
                  <div className={styles.fichaPolCardTitle}>Interna de la Fuerza</div>
                </div>
                <div className={styles.fichaPolDesc}>Espacio interno al que responde el intendente.</div>
                <div className={styles.fichaPolResult} style={{ background: bloqueColor + "18", color: bloqueColor }}>{ex.internaFuerza.toUpperCase()}</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Mobile layout ──────────────────────────────── */}
      <div className={styles.mFicha}>

        {/* Navy header */}
        <div className={styles.mHeader}>
          <button className={styles.mBreadcrumb} onClick={onBack}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Municipios
          </button>
          <div className={styles.mTitle}>{m.nombre}</div>
          <div className={styles.mSubtitle}>{m.seccion_electoral_nombre || `Sección ${m.seccion_electoral_numero}`} · {BLOQUE_LABELS[bloque]}</div>
          <div className={styles.mStatsRow}>
            <div><div className={styles.mStatVal}>{fmt(m.padron)}</div><div className={styles.mStatLbl}>Electores</div></div>
            <div><div className={styles.mStatVal}>{fmt(m.poblacion_2025 ?? m.poblacion_2022)}</div><div className={styles.mStatLbl}>Habitantes</div></div>
            <div><div className={styles.mStatVal}>{fmtPct(pct2023)}</div><div className={styles.mStatLbl}>FP 2023</div></div>
            <div><div className={styles.mStatVal} style={{ color: fortalezaColor }}>{fortalezaNivel ? FORTALEZA_LABELS[fortalezaNivel] : "—"}</div><div className={styles.mStatLbl}>Fortaleza</div></div>
          </div>
        </div>

        {/* Dark card: intendente + political 2×2 */}
        <div className={styles.mDarkCardWrap}>
          <div className={styles.mDarkCard}>
            <div className={styles.mIntRow}>
              <div className={styles.mAvatarMob} style={{ background: `linear-gradient(135deg, ${bloqueColor}cc, ${bloqueColor}66)` }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.mIntName}>{m.intendente?.nombre ?? "—"}</div>
                <div className={styles.mIntCargo}>Intendente/a de {m.nombre}</div>
                {m.intendente?.partido && <div className={styles.mIntBadge}>{m.intendente.partido}</div>}
              </div>
            </div>
            <div className={styles.mPolGrid}>
              <div className={styles.mPolItem}>
                <div className={styles.mPolItemLbl}>Fortaleza</div>
                <div className={styles.mPolItemVal} style={{ color: fortalezaColor }}>
                  {fortalezaNivel ? FORTALEZA_LABELS[fortalezaNivel] : "—"}
                </div>
                <div className={styles.mPolBar} style={{ background: `linear-gradient(90deg, ${fortalezaColor}, ${fortalezaColor}66)`, width: `${fortalezaPct}%` }} />
              </div>
              <div className={styles.mPolItem}>
                <div className={styles.mPolItemLbl}>Poder territorial</div>
                <div className={styles.mPolItemVal} style={{ color: poderStyle.color }}>{ex.poderPolitico}</div>
                <div className={styles.mPolBar} style={{ background: `linear-gradient(90deg, ${poderStyle.color}, ${poderStyle.color}66)`, width: `${poderPct}%` }} />
              </div>
              <div className={styles.mPolItem}>
                <div className={styles.mPolItemLbl}>Posicionamiento</div>
                <div className={styles.mPolItemVal} style={{ color: posicionamiento.color, fontSize: "10px", lineHeight: "1.2" }}>{posicionamiento.label}</div>
              </div>
              <div className={styles.mPolItem}>
                <div className={styles.mPolItemLbl}>Interna</div>
                <div className={styles.mPolItemVal} style={{ color: bloqueColor, fontSize: "10px", lineHeight: "1.2" }}>{ex.internaFuerza}</div>
              </div>
            </div>
          </div>
        </div>

        {/* White cards: institutional sections */}
        <div className={styles.mCardsArea}>

          {/* Obras y Rutas */}
          <div className={styles.mCard}>
            <div className={styles.mCardHeader}>
              <div className={styles.mCardIcon} style={{ background: "#EDFAF4", color: "#2E9E6B" }}>🏗️</div>
              <div className={styles.mCardTitle}>Obras y Rutas</div>
            </div>
            <div className={styles.mTwoCol}>
              <div>
                <div className={styles.mMetricLbl}>Avance obras</div>
                <div className={styles.mMetricBig} style={{ color: "#2E9E6B" }}>{ex.obrasHechas}%</div>
                <div className={styles.mProg}><div className={styles.mProgFill} style={{ width: `${ex.obrasHechas}%`, background: "#2E9E6B" }} /></div>
              </div>
              <div>
                <div className={styles.mMetricLbl}>Rutas reparadas</div>
                <div className={styles.mMetricBig} style={{ color: "#4F8FC0" }}>{ex.rutasReparadas}%</div>
                <div className={styles.mProg}><div className={styles.mProgFill} style={{ width: `${ex.rutasReparadas}%`, background: "#4F8FC0" }} /></div>
              </div>
            </div>
          </div>

          {/* Educación */}
          <div className={styles.mCard}>
            <div className={styles.mCardHeader}>
              <div className={styles.mCardIcon} style={{ background: "#EFF7FD", color: "#4F8FC0" }}>🎓</div>
              <div className={styles.mCardTitle}>Educación</div>
            </div>
            <div className={styles.mMetricLbl}>Matrícula total</div>
            <div className={styles.mMetricBig} style={{ color: "#4F8FC0" }}>{ex.matriculaTotal.toLocaleString("es-AR")}</div>
            <div className={styles.mMetricSub}>alumnos matriculados</div>
            <div className={styles.mRow}><span className={styles.mRowLbl}>Escuelas prov.</span><span className={styles.mRowVal}>{ex.escuelasProvinc}</span></div>
            <div className={styles.mRow}><span className={styles.mRowLbl}>Escuelas mun.</span><span className={styles.mRowVal}>{ex.escuelasMunic}</span></div>
          </div>

          {/* Salud */}
          <div className={styles.mCard}>
            <div className={styles.mCardHeader}>
              <div className={styles.mCardIcon} style={{ background: "#FEF2F2", color: "#D63C3C" }}>🏥</div>
              <div className={styles.mCardTitle}>Salud</div>
            </div>
            <div className={styles.mTwoCol}>
              <div>
                <div className={styles.mMetricLbl}>CAPS activos</div>
                <div className={styles.mMetricBig} style={{ color: "#D63C3C" }}>{ex.caps}</div>
              </div>
              <div>
                <div className={styles.mMetricLbl}>Cobertura</div>
                <div className={styles.mMetricBig} style={{ color: "#D63C3C" }}>{ex.pobConsumos}%</div>
              </div>
            </div>
            <div className={styles.mRow}><span className={styles.mRowLbl}>Hosp. provinciales</span><span className={styles.mRowVal}>{ex.hospitalesProvinc}</span></div>
            <div className={styles.mRow}><span className={styles.mRowLbl}>Hosp. municipales</span><span className={styles.mRowVal}>{ex.hospitalesMunic}</span></div>
          </div>

          {/* Economía */}
          <div className={styles.mCard}>
            <div className={styles.mCardHeader}>
              <div className={styles.mCardIcon} style={{ background: "#EDFAF4", color: "#2E9E6B" }}>💵</div>
              <div className={styles.mCardTitle}>Economía y Coparticipación</div>
            </div>
            <div className={styles.mMetricLbl}>Superávit estimado</div>
            <div className={styles.mMetricBig} style={{ color: "#2E9E6B", fontSize: "26px" }}>${(ex.superavit / 1_000_000).toFixed(1)}M</div>
            <div className={styles.mMetricSub}>pesos corrientes</div>
            <div className={styles.mRow}><span className={styles.mRowLbl}>Gastos devengados</span><span className={styles.mRowVal}>${(ex.gastosDevengados / 1_000_000).toFixed(0)}M</span></div>
            <div className={styles.mRow}><span className={styles.mRowLbl}>Recursos percibidos</span><span className={styles.mRowVal}>${(ex.recursosPercibidos / 1_000_000).toFixed(0)}M</span></div>
          </div>

          {/* Desarrollo Social */}
          <div className={styles.mCard}>
            <div className={styles.mCardHeader}>
              <div className={styles.mCardIcon} style={{ background: "#F5F0FF", color: "#753bbd" }}>🤝</div>
              <div className={styles.mCardTitle}>Desarrollo Social</div>
            </div>
            <div className={styles.mRow}><span className={styles.mRowLbl}>Subsidios activos</span><span className={styles.mRowVal}>{ex.subsidiosActivos}</span></div>
            <div className={styles.mRow}><span className={styles.mRowLbl}>Prog. sociales</span><span className={styles.mRowVal}>{ex.programasSociales}</span></div>
            <div style={{ height: 1, background: "#F0F2F5", margin: "10px 0" }} />
            <div className={styles.mCardTitle} style={{ marginBottom: 8 }}>🎉 Eventos</div>
            {ex.eventos.map((ev, i) => (
              <div key={i} className={styles.mEventItem}>· {ev}</div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}

/* ── Main ────────────────────────────────────────────────── */
export function MunicipalitiesPanel() {
  const [query, setQuery]         = useState("");
  const [ddResults, setDdResults] = useState<MunicipioTablaFila[]>([]);
  const [ddOpen, setDdOpen]       = useState(false);
  const [focusIdx, setFocusIdx]   = useState(-1);
  const [selected, setSelected]   = useState<MunicipioDetalle | null>(null);
  const [geoFeatures, setGeoFeatures] = useState<GeoJsonFeature[]>([]);
  const [loading, setLoading]     = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load GeoJSON once for the map
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiRequest<PbaGeoJson>("/maps/pba/", { token })
      .then(g => setGeoFeatures(g.features))
      .catch(() => undefined);
  }, []);

  // Search autocomplete
  useEffect(() => {
    if (!query.trim()) { setDdResults([]); setDdOpen(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const token = getToken();
      if (!token) return;
      apiRequest<PaginatedResponse<MunicipioTablaFila>>(
        `/municipalities/tabla/?search=${encodeURIComponent(query.trim())}&page_size=8`,
        { token }
      ).then(resp => {
        setDdResults(resp.results);
        setDdOpen(resp.results.length > 0);
        setFocusIdx(-1);
      }).catch(() => undefined);
    }, 180);
  }, [query]);

  async function selectMunicipio(row: MunicipioTablaFila) {
    setDdOpen(false); setQuery(row.nombre);
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const detail = await apiRequest<MunicipioDetalle>(`/municipalities/${row.nombre_normalizado}/`, { token });
      setSelected(detail);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!ddOpen || !ddResults.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, ddResults.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const m = focusIdx >= 0 ? ddResults[focusIdx] : ddResults[0]; if (m) selectMunicipio(m); }
    else if (e.key === "Escape") setDdOpen(false);
  }

  return (
    <div className={`${styles.layout} ${selected ? styles.layoutWithFicha : ""}`}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <div className={styles.eyebrow}>Territorio</div>
            <div className={styles.title}>Buscador de Municipios</div>
          </div>
          <div className={styles.searchWrap}>
            <div className={styles.searchBox}>
              <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Buscar municipio..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => setDdOpen(false), 150)}
                autoComplete="off"
                className={styles.searchInput}
              />
              {ddOpen && ddResults.length > 0 && (
                <div className={styles.dropdown}>
                  {ddResults.map((row, i) => {
                    const b = getMunicipioBloque(row.intendente?.frente, row.intendente?.partido);
                    return (
                      <div
                        key={row.id}
                        className={`${styles.ddItem} ${i === focusIdx ? styles.ddItemFocused : ""}`}
                        onMouseDown={e => { e.preventDefault(); selectMunicipio(row); }}
                      >
                        <div className={styles.ddLeft}>
                          <span className={styles.ddDot} style={{ background: BLOQUE_COLORS[b] || "#ccc" }} />
                          <span className={styles.ddName}>{row.nombre}</span>
                        </div>
                        <span className={styles.ddMeta}>
                          {row.seccion_electoral_nombre || `Secc. ${row.seccion_electoral_numero}`} · {fmt(row.poblacion_2025 ?? row.poblacion_2022)} hab.
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {loading ? (
          <div className={styles.emptyState}>
            <div className={styles.spinner} />
            <p>Cargando ficha...</p>
          </div>
        ) : !selected ? (
          <div className={styles.emptyState}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p>Ingresá el nombre de un municipio para ver su ficha completa</p>
          </div>
        ) : (
          <Ficha m={selected} features={geoFeatures} onBack={() => setSelected(null)} />
        )}
      </div>

    </div>
  );
}
