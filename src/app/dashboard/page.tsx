"use client";

import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { BLOQUE_COLORS, getMunicipioBloque } from "@/lib/bloque";
import {
  calcFortalezaProvincialScore,
  calcFortalezaScore,
  getFortalezaNivel,
  getFortalezaProvincialNivel,
} from "@/lib/fortaleza";
import type { GeoJsonFeature, PbaGeoJson } from "@/types/campaign";

import styles from "./page.module.css";

type MunicipioGeo = NonNullable<GeoJsonFeature["properties"]["municipio"]>;

const BLOC_META: Record<string, { label: string; color: string; bg: string }> = {
  fp:   { label: "Fuerza Patria",            color: BLOQUE_COLORS.fp,   bg: "#EFF7FD" },
  jxc:  { label: "PRO / Juntos x el Cambio", color: BLOQUE_COLORS.jxc,  bg: "#FFFBEA" },
  lla:  { label: "La Libertad Avanza",        color: BLOQUE_COLORS.lla,  bg: "#F5F0FF" },
  otro: { label: "Vecinalistas / Ind.",       color: BLOQUE_COLORS.otro, bg: "#FFF0F5" },
  sd:   { label: "Sin datos",                color: BLOQUE_COLORS.sd,   bg: "#F3F4F6" },
};

const FORTALEZA_META: Record<string, { label: string; color: string; bg: string }> = {
  fuerte:      { label: "Fuerte",       color: "#16A34A", bg: "#DCFCE7" },
  competitivo: { label: "Competitivo",  color: "#D97706", bg: "#FEF3C7" },
  debil:       { label: "Débil",        color: "#DC2626", bg: "#FEE2E2" },
  sin_datos:   { label: "Sin datos",    color: "#9CA3AF", bg: "#F3F4F6" },
};

const PROV_META: Record<string, { label: string; color: string; bg: string }> = {
  fuerte:      { label: "Consolidado",  color: "#16A34A", bg: "#DCFCE7" },
  competitivo: { label: "Favorable",   color: "#65A30D", bg: "#ECFCCB" },
  debil:       { label: "Desfavorable", color: "#DC2626", bg: "#FEE2E2" },
  muy_debil:   { label: "Crítico",      color: "#7F1D1D", bg: "#FEE2E2" },
  sin_datos:   { label: "Sin datos",   color: "#9CA3AF", bg: "#F3F4F6" },
};

function fmt(n: number): string { return n.toLocaleString("es-AR"); }
function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

interface Stats {
  total: number;
  totalPadron: number;
  totalPob: number;
  bloques: Record<string, number>;
  bloquesPadron: Record<string, number>;
  fortaleza: Record<string, number>;
  provincial: Record<string, number>;
  fpGanoProv: number;
  fpFortaleza: Record<string, number>;
  fpPadron: number;
  fpPob: number;
  local2023: number[];
  local2025: number[];
  provincial2023: number[];
  provincial2025: number[];
  topFP: MunicipioGeo[];
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function fmtPctValue(value: number | null): string {
  return value == null ? "Sin datos" : `${value.toFixed(1)}%`;
}

function fmtDelta(value: number | null): string {
  if (value == null) return "Sin datos";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pts`;
}

function computeStats(features: GeoJsonFeature[]): Stats {
  const bloques: Record<string, number>       = { fp: 0, jxc: 0, lla: 0, otro: 0, sd: 0 };
  const bloquesPadron: Record<string, number> = { fp: 0, jxc: 0, lla: 0, otro: 0, sd: 0 };
  const fortaleza: Record<string, number>     = { fuerte: 0, competitivo: 0, debil: 0, sin_datos: 0 };
  const provincial: Record<string, number>    = { fuerte: 0, competitivo: 0, debil: 0, muy_debil: 0, sin_datos: 0 };
  const fpFortaleza: Record<string, number>   = { fuerte: 0, competitivo: 0, debil: 0, sin_datos: 0 };
  let totalPadron = 0, totalPob = 0, fpGanoProv = 0, fpPadron = 0, fpPob = 0;
  const local2023: number[] = [];
  const local2025: number[] = [];
  const provincial2023: number[] = [];
  const provincial2025: number[] = [];
  const fpList: MunicipioGeo[] = [];

  for (const f of features) {
    const m = f.properties.municipio;
    if (!m) continue;
    const padron = m.padron ?? 0;
    const pob    = m.poblacion_2025 ?? 0;
    totalPadron += padron;
    totalPob    += pob;
    const bloque = getMunicipioBloque(m.frente, m.partido);
    bloques[bloque] = (bloques[bloque] ?? 0) + 1;
    bloquesPadron[bloque] = (bloquesPadron[bloque] ?? 0) + padron;
    const fScore = calcFortalezaScore(m);
    const fNivel = getFortalezaNivel(fScore);
    if (fNivel) fortaleza[fNivel]++; else fortaleza.sin_datos++;
    const pScore = calcFortalezaProvincialScore(m);
    const pNivel = getFortalezaProvincialNivel(pScore);
    if (pNivel) provincial[pNivel]++; else provincial.sin_datos++;
    if ((m.porcentaje_gobernador_2023 ?? 0) > 50) fpGanoProv++;
    if (bloque === "fp") {
      fpPadron += padron; fpPob += pob;
      if (m.padron) fpList.push(m);
      if (fNivel) fpFortaleza[fNivel]++; else fpFortaleza.sin_datos++;
      if (typeof m.porcentaje_2023 === "number") local2023.push(m.porcentaje_2023);
      if (typeof m.porcentaje_concejales_2025 === "number") local2025.push(m.porcentaje_concejales_2025);
      if (typeof m.porcentaje_gobernador_2023 === "number") provincial2023.push(m.porcentaje_gobernador_2023);
      if (typeof m.porcentaje_provincial_2025 === "number") provincial2025.push(m.porcentaje_provincial_2025);
    }
  }
  fpList.sort((a, b) => (b.padron ?? 0) - (a.padron ?? 0));
  return { total: features.length, totalPadron, totalPob, bloques, bloquesPadron, fortaleza, provincial, fpGanoProv, fpFortaleza, fpPadron, fpPob, local2023, local2025, provincial2023, provincial2025, topFP: fpList.slice(0, 10) };
}

function FortalezaBadge({ nivel }: { nivel: string | null }) {
  if (!nivel) return <span className={styles.badgeEmpty}>—</span>;
  const meta = FORTALEZA_META[nivel];
  if (!meta) return null;
  return (
    <span className={styles.badge} style={{ background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className={styles.sectionLabel}>{children}</h2>;
}

// SVG icons for election cards
function IconIntendente() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconConcejales() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconTendenciaUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
function IconTendenciaDown() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}
function IconGobernador() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="6" />
      <path d="M5 10a7 7 0 0 1 14 0" />
      <rect x="3" y="10" width="18" height="2" rx="1" />
      <rect x="2" y="20" width="20" height="2" rx="1" />
      <line x1="6" y1="12" x2="6" y2="20" />
      <line x1="10" y1="12" x2="10" y2="20" />
      <line x1="14" y1="12" x2="14" y2="20" />
      <line x1="18" y1="12" x2="18" y2="20" />
    </svg>
  );
}
function IconProvincial() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

export default function DashboardHomePage() {
  const [geojson, setGeojson] = useState<PbaGeoJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { queueMicrotask(() => { setLoading(false); setError("Sin sesión activa."); }); return; }
    apiRequest<PbaGeoJson>("/maps/pba/", { token })
      .then(setGeojson)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar datos."))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => (geojson ? computeStats(geojson.features) : null), [geojson]);

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p className={styles.loadingText}>Cargando panel...</p>
      </div>
    );
  }
  if (error || !stats) return <div className={styles.loadingScreen}>{error ?? "Sin datos."}</div>;

  const { total, totalPadron, totalPob, bloques, bloquesPadron, fortaleza, provincial, fpGanoProv, fpFortaleza, fpPadron, fpPob, topFP } = stats;
  const fpTotal = bloques.fp;
  const local2023Avg = avg(stats.local2023);
  const local2025Avg = avg(stats.local2025);
  const provincial2023Avg = avg(stats.provincial2023);
  const provincial2025Avg = avg(stats.provincial2025);
  const localTrend = local2023Avg == null || local2025Avg == null ? null : local2025Avg - local2023Avg;
  const provincialTrend = provincial2023Avg == null || provincial2025Avg == null ? null : provincial2025Avg - provincial2023Avg;

  return (
    <div className={styles.page}>

      {/* Header */}
      <header className={styles.header} style={{ animationDelay: "0s" }}>
        <div className={styles.headerLeft}>
          <p className={styles.eyebrow}>PBA · Campaña 2027</p>
          <h1 className={styles.title}>Panel de comando</h1>
        </div>
        <div className={styles.kpiPill}>
          {[
            { value: fmt(total),        label: "municipios" },
            { value: fmt(totalPadron),  label: "electores" },
            { value: fmt(totalPob),     label: "hab. 2025" },
          ].map(({ value, label }, i) => (
            <div key={label} className={styles.kpiPillItem}>
              {i > 0 && <span className={styles.kpiPillDiv} />}
              <span className={styles.kpiPillNum}>{value}</span>
              <span className={styles.kpiPillLabel}>{label}</span>
            </div>
          ))}
        </div>
      </header>

      {/* FP Hero */}
      <section className={styles.section} style={{ animationDelay: "0.06s" }}>
        <div className={styles.fpHero}>
          <div className={styles.fpHeroHead}>
            <div className={styles.fpHeroBrand}>
              <span className={styles.fpHeroDot} />
              <span className={styles.fpHeroBrandName}>Fuerza Patria</span>
              <span className={styles.fpHeroBrandSep}>·</span>
              <span className={styles.fpHeroBrandSub}>Panorama general</span>
            </div>
            <span className={styles.fpHeroTag}>{pct(bloques.fp, total)} del mapa político</span>
          </div>

          <div className={styles.fpHeroBody}>
            <div className={styles.fpHeroKpi}>
              <div className={styles.fpHeroKpiNum}>{bloques.fp}</div>
              <div className={styles.fpHeroKpiLabel}>municipios gobernados</div>
              <div className={styles.fpHeroKpiSub}>de {total} en la provincia</div>
              <div className={styles.fpBar}>
                <div className={styles.fpBarFill} style={{ "--bar-w": pct(bloques.fp, total) } as React.CSSProperties} />
              </div>
            </div>

            <div className={styles.fpHeroVDiv} />

            <div className={styles.fpHeroKpi}>
              <div className={styles.fpHeroKpiNum}>{fmt(fpPadron)}</div>
              <div className={styles.fpHeroKpiLabel}>electores en municipios FP</div>
              <div className={styles.fpHeroKpiSub}>{pct(fpPadron, totalPadron)} del total de electores</div>
              <div className={styles.fpBar}>
                <div className={styles.fpBarFill} style={{ "--bar-w": pct(fpPadron, totalPadron) } as React.CSSProperties} />
              </div>
            </div>

            <div className={styles.fpHeroVDiv} />

            <div className={styles.fpHeroStrength}>
              <p className={styles.fpHeroStrengthTitle}>Fortaleza de los {fpTotal} intendentes FP</p>
              <div className={styles.fpStrengthList}>
                {(["fuerte", "competitivo", "debil", "sin_datos"] as const)
                  .filter((key) => (fpFortaleza[key] ?? 0) > 0)
                  .map((key) => {
                  const meta  = FORTALEZA_META[key];
                  const count = fpFortaleza[key] ?? 0;
                  return (
                    <div key={key} className={styles.fpStrengthRow}>
                      <span className={styles.fpStrengthDot} style={{ background: meta.color }} />
                      <span className={styles.fpStrengthName}>{meta.label}</span>
                      <span className={styles.fpStrengthVal} style={{ color: meta.color }}>{count}</span>
                      <div className={styles.fpStrengthTrack}>
                        <div
                          className={styles.fpStrengthFill}
                          style={{ "--bar-w": pct(count, fpTotal), background: meta.color } as React.CSSProperties}
                        />
                      </div>
                      <span className={styles.fpStrengthPct}>{pct(count, fpTotal)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FP Electoral */}
      <section className={styles.section} style={{ animationDelay: "0.12s" }}>
        <SectionLabel>Fuerza Patria · Tendencia electoral comparada</SectionLabel>
        <div className={styles.electionWrapper}>

          {/* Grupo: Elección local */}
          <div className={styles.electionGroup}>
            <div className={styles.electionGroupHeader}>
              <span className={styles.electionGroupDot} style={{ background: "#1b4f84" }} />
              Elección local — Intendente &amp; Concejales
            </div>
            <div className={styles.electionGroupCards}>
              {([
                {
                  key: "local-2023",
                  label: "Intendente 2023",
                  year: "2023",
                  value: fmtPctValue(local2023Avg),
                  sub: `Promedio FP en ${stats.local2023.length} municipios`,
                  color: "#1b4f84",
                  bg: "linear-gradient(135deg,#EFF7FD,#DBEEF9)",
                  icon: <IconIntendente />,
                },
                {
                  key: "local-2025",
                  label: "Concejales 2025",
                  year: "2025",
                  value: fmtPctValue(local2025Avg),
                  sub: `Promedio FP en ${stats.local2025.length} municipios`,
                  color: "#16A34A",
                  bg: "linear-gradient(135deg,#F0FDF4,#DCFCE7)",
                  icon: <IconConcejales />,
                },
                {
                  key: "local-trend",
                  label: "Tendencia local",
                  year: "Δ",
                  value: fmtDelta(localTrend),
                  sub: "Concejales 2025 vs. Intendente 2023",
                  color: localTrend != null && localTrend >= 0 ? "#16A34A" : "#DC2626",
                  bg: localTrend != null && localTrend >= 0 ? "linear-gradient(135deg,#F0FDF4,#DCFCE7)" : "linear-gradient(135deg,#FFF5F5,#FEE2E2)",
                  icon: localTrend != null && localTrend >= 0 ? <IconTendenciaUp /> : <IconTendenciaDown />,
                },
              ]).map(({ key, label, year, value, sub, color, bg, icon }, idx) => (
                <div
                  key={key}
                  className={styles.electionCard}
                  style={{ background: bg, borderTopColor: color, animationDelay: `${0.12 + idx * 0.05}s` }}
                >
                  <div className={styles.electionCardTop}>
                    <div className={styles.electionIconWrap} style={{ color, borderColor: `${color}22` }}>
                      {icon}
                    </div>
                    <span className={styles.electionYear} style={{ color }}>{year}</span>
                  </div>
                  <div className={styles.electionNum} style={{ color }}>{value}</div>
                  <div className={styles.electionLabel}>{label}</div>
                  <div className={styles.electionSub}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Grupo: Elección provincial */}
          <div className={styles.electionGroup}>
            <div className={styles.electionGroupHeader}>
              <span className={styles.electionGroupDot} style={{ background: "#753bbd" }} />
              Elección provincial — Gobernador &amp; Legislativa
            </div>
            <div className={styles.electionGroupCards}>
              {([
                {
                  key: "prov-2023",
                  label: "Gobernador 2023",
                  year: "2023",
                  value: fmtPctValue(provincial2023Avg),
                  sub: `${fpGanoProv} municipios FP arriba del 50%`,
                  color: "#753bbd",
                  bg: "linear-gradient(135deg,#F5F0FF,#EDE3FF)",
                  icon: <IconGobernador />,
                },
                {
                  key: "prov-2025",
                  label: "Provincial 2025",
                  year: "2025",
                  value: fmtPctValue(provincial2025Avg),
                  sub: `Promedio FP en ${stats.provincial2025.length} municipios`,
                  color: "#D97706",
                  bg: "linear-gradient(135deg,#FFFBEB,#FEF3C7)",
                  icon: <IconProvincial />,
                },
                {
                  key: "prov-trend",
                  label: "Tendencia provincial",
                  year: "Δ",
                  value: fmtDelta(provincialTrend),
                  sub: "Provincial 2025 vs. Gobernador 2023",
                  color: provincialTrend != null && provincialTrend >= 0 ? "#16A34A" : "#DC2626",
                  bg: provincialTrend != null && provincialTrend >= 0 ? "linear-gradient(135deg,#F0FDF4,#DCFCE7)" : "linear-gradient(135deg,#FFF5F5,#FEE2E2)",
                  icon: provincialTrend != null && provincialTrend >= 0 ? <IconTendenciaUp /> : <IconTendenciaDown />,
                },
              ]).map(({ key, label, year, value, sub, color, bg, icon }, idx) => (
                <div
                  key={key}
                  className={styles.electionCard}
                  style={{ background: bg, borderTopColor: color, animationDelay: `${0.27 + idx * 0.05}s` }}
                >
                  <div className={styles.electionCardTop}>
                    <div className={styles.electionIconWrap} style={{ color, borderColor: `${color}22` }}>
                      {icon}
                    </div>
                    <span className={styles.electionYear} style={{ color }}>{year}</span>
                  </div>
                  <div className={styles.electionNum} style={{ color }}>{value}</div>
                  <div className={styles.electionLabel}>{label}</div>
                  <div className={styles.electionSub}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Bloques */}
      <section className={styles.section} style={{ animationDelay: "0.18s" }}>
        <SectionLabel>Conducción municipal · Bloque político</SectionLabel>
        <div className={styles.bloqueGrid}>
          {(["fp", "jxc", "lla", "otro", "sd"] as const).map((b, idx) => {
            const meta         = BLOC_META[b];
            const count        = bloques[b] ?? 0;
            const padronBloque = bloquesPadron[b] ?? 0;
            return (
              <div
                key={b}
                className={styles.bloqueCard}
                style={{ borderTopColor: meta.color, animationDelay: `${0.18 + idx * 0.04}s` }}
              >
                <div className={styles.bloqueColorStripe} style={{ background: meta.color }} />
                <div className={styles.bloqueCount} style={{ color: meta.color }}>{count}</div>
                <div className={styles.bloqueLabel}>{meta.label}</div>
                <div className={styles.bloquePctText}>{pct(count, total)} del total</div>
                <div className={styles.bloqueBarTrack}>
                  <div
                    className={styles.bloqueBarFill}
                    style={{ "--bar-w": pct(count, total), background: meta.color } as React.CSSProperties}
                  />
                </div>
                {padronBloque > 0 && (
                  <div className={styles.bloquePadronChip}>
                    {fmt(padronBloque)} electores · {pct(padronBloque, totalPadron)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 2-col: Fortaleza local + Performance provincial */}
      <div className={styles.twoCol} style={{ animationDelay: "0.22s" }}>

        <section className={styles.section}>
          <SectionLabel>Fortaleza del intendente · Todos los municipios</SectionLabel>
          <div className={styles.listCard}>
            {(["fuerte", "competitivo", "debil", "sin_datos"] as const)
              .filter((k) => (fortaleza[k] ?? 0) > 0)
              .map((k) => {
              const meta  = FORTALEZA_META[k];
              const count = fortaleza[k] ?? 0;
              return (
                <div key={k} className={styles.listRow} style={{ borderLeftColor: meta.color }}>
                  <div className={styles.listRowLeft}>
                    <span className={styles.listRowNum} style={{ color: meta.color }}>{count}</span>
                    <span className={styles.listRowLabel}>{meta.label}</span>
                  </div>
                  <div className={styles.listBarCol}>
                    <div className={styles.listBarTrack}>
                      <div
                        className={styles.listBarFill}
                        style={{ "--bar-w": pct(count, total), background: meta.color } as React.CSSProperties}
                      />
                    </div>
                    <span className={styles.listBarPct}>{pct(count, total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <SectionLabel>Performance FP · Nivel provincial</SectionLabel>
          <div className={styles.listCard}>
            {(["fuerte", "competitivo", "debil", "muy_debil", "sin_datos"] as const)
              .filter((k) => (provincial[k] ?? 0) > 0)
              .map((k) => {
              const meta  = PROV_META[k];
              const count = provincial[k] ?? 0;
              return (
                <div key={k} className={styles.listRow} style={{ borderLeftColor: meta.color }}>
                  <div className={styles.listRowLeft}>
                    <span className={styles.listRowNum} style={{ color: meta.color }}>{count}</span>
                    <span className={styles.listRowLabel}>{meta.label}</span>
                  </div>
                  <div className={styles.listBarCol}>
                    <div className={styles.listBarTrack}>
                      <div
                        className={styles.listBarFill}
                        style={{ "--bar-w": pct(count, total), background: meta.color } as React.CSSProperties}
                      />
                    </div>
                    <span className={styles.listBarPct}>{pct(count, total)}</span>
                  </div>
                </div>
              );
            })}
            <div className={styles.provBadge}>
              <span className={styles.provBadgeNum}>{fpGanoProv}</span>
              <span className={styles.provBadgeText}>municipios con FP &gt; 50% en elección a gobernador 2023</span>
            </div>
          </div>
        </section>

      </div>

      {/* Top FP table */}
      {topFP.length > 0 && (
        <section className={styles.section} style={{ animationDelay: "0.28s" }}>
          <SectionLabel>Fuerza Patria · Top municipios por electores</SectionLabel>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>#</span>
              <span>Municipio</span>
              <span>Intendente</span>
              <span>Fortaleza</span>
              <span>Electores</span>
              <span>2023 %</span>
              <span>Concej. 2025 %</span>
            </div>
            {topFP.map((m, i) => {
              const fNivel = getFortalezaNivel(calcFortalezaScore(m));
              return (
                <div key={m.nombre} className={`${styles.tableRow} ${i % 2 === 1 ? styles.tableRowAlt : ""}`}>
                  <span className={styles.tableRank}>{i + 1}</span>
                  <span className={styles.tableNombre}>{m.nombre}</span>
                  <span className={styles.tableIntendente}>{m.intendente || "—"}</span>
                  <span><FortalezaBadge nivel={fNivel} /></span>
                  <span className={styles.tableNum}>{m.padron ? fmt(m.padron) : "—"}</span>
                  <span className={styles.tableNum}>{m.porcentaje_2023 != null ? `${m.porcentaje_2023.toFixed(1)}%` : "—"}</span>
                  <span className={styles.tableNum}>{m.porcentaje_concejales_2025 != null ? `${m.porcentaje_concejales_2025.toFixed(1)}%` : "—"}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
