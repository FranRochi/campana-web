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
  fuerte:      { label: "Fuerte",       color: "#16A34A", bg: "#F0FDF4" },
  competitivo: { label: "Competitivo",  color: "#D97706", bg: "#FFFBEB" },
  debil:       { label: "Débil",        color: "#DC2626", bg: "#FEF2F2" },
  sin_datos:   { label: "Sin datos",    color: "#9CA3AF", bg: "#F9FAFB" },
};

const PROV_META: Record<string, { label: string; color: string; bg: string }> = {
  fuerte:      { label: "Consolidado",               color: "#16A34A", bg: "#F0FDF4" },
  competitivo: { label: "En disputa · Favorable",    color: "#65A30D", bg: "#F7FEE7" },
  debil:       { label: "En disputa · Desfavorable", color: "#DC2626", bg: "#FEF2F2" },
  muy_debil:   { label: "Crítico",                   color: "#7F1D1D", bg: "#FEF2F2" },
  sin_datos:   { label: "Sin datos",                 color: "#9CA3AF", bg: "#F9FAFB" },
};

function fmt(n: number): string {
  return n.toLocaleString("es-AR");
}

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
  fpConcejo: Record<string, number>;
  fpPadron: number;
  fpPob: number;
  topFP: MunicipioGeo[];
}

function computeStats(features: GeoJsonFeature[]): Stats {
  const bloques: Record<string, number>       = { fp: 0, jxc: 0, lla: 0, otro: 0, sd: 0 };
  const bloquesPadron: Record<string, number> = { fp: 0, jxc: 0, lla: 0, otro: 0, sd: 0 };
  const fortaleza: Record<string, number>     = { fuerte: 0, competitivo: 0, debil: 0, sin_datos: 0 };
  const provincial: Record<string, number>    = { fuerte: 0, competitivo: 0, debil: 0, muy_debil: 0, sin_datos: 0 };
  const fpFortaleza: Record<string, number>   = { fuerte: 0, competitivo: 0, debil: 0, sin_datos: 0 };
  const fpConcejo: Record<string, number>     = { mayoria: 0, mitad: 0, minoria: 0, sd: 0 };
  let totalPadron = 0;
  let totalPob    = 0;
  let fpGanoProv  = 0;
  let fpPadron    = 0;
  let fpPob       = 0;
  const fpList: MunicipioGeo[] = [];

  for (const f of features) {
    const m = f.properties.municipio;
    if (!m) continue;

    const padron = m.padron ?? 0;
    const pob    = m.poblacion_2025 ?? 0;
    totalPadron += padron;
    totalPob    += pob;

    const bloque = getMunicipioBloque(m.frente, m.partido);
    bloques[bloque]       = (bloques[bloque] ?? 0) + 1;
    bloquesPadron[bloque] = (bloquesPadron[bloque] ?? 0) + padron;

    const fScore = calcFortalezaScore(m);
    const fNivel = getFortalezaNivel(fScore);
    if (fNivel) fortaleza[fNivel]++;
    else        fortaleza.sin_datos++;

    const pScore = calcFortalezaProvincialScore(m);
    const pNivel = getFortalezaProvincialNivel(pScore);
    if (pNivel) provincial[pNivel]++;
    else        provincial.sin_datos++;

    if ((m.porcentaje_gobernador_2023 ?? 0) > 50) fpGanoProv++;

    if (bloque === "fp") {
      fpPadron += padron;
      fpPob    += pob;
      if (m.padron) fpList.push(m);

      if (fNivel) fpFortaleza[fNivel]++;
      else        fpFortaleza.sin_datos++;

      const ctrl = m.control_concejo;
      if (ctrl === "mayoria")   fpConcejo.mayoria++;
      else if (ctrl === "mitad")   fpConcejo.mitad++;
      else if (ctrl === "minoria") fpConcejo.minoria++;
      else                         fpConcejo.sd++;
    }
  }

  fpList.sort((a, b) => (b.padron ?? 0) - (a.padron ?? 0));

  return {
    total: features.length,
    totalPadron,
    totalPob,
    bloques,
    bloquesPadron,
    fortaleza,
    provincial,
    fpGanoProv,
    fpFortaleza,
    fpConcejo,
    fpPadron,
    fpPob,
    topFP: fpList.slice(0, 10),
  };
}

function FortalezaBadge({ nivel }: { nivel: string | null }) {
  if (!nivel) return <span className={styles.badgeEmpty}>—</span>;
  const meta = FORTALEZA_META[nivel];
  if (!meta) return null;
  return (
    <span
      className={styles.badge}
      style={{ background: meta.bg, color: meta.color, borderColor: `${meta.color}33` }}
    >
      {meta.label}
    </span>
  );
}

export default function InicioDashboardPage() {
  const [geojson, setGeojson] = useState<PbaGeoJson | null>(null);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      queueMicrotask(() => { setLoading(false); setError("Sin sesión activa."); });
      return;
    }
    apiRequest<PbaGeoJson>("/maps/pba/", { token })
      .then(setGeojson)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar datos."))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(
    () => (geojson ? computeStats(geojson.features) : null),
    [geojson],
  );

  if (loading) return <div className={styles.loading}><span>Cargando datos del panel...</span></div>;
  if (error || !stats) return <div className={styles.loading}>{error ?? "Sin datos."}</div>;

  const {
    total, totalPadron, totalPob,
    bloques, bloquesPadron,
    fortaleza, provincial,
    fpGanoProv, fpFortaleza, fpConcejo,
    fpPadron, fpPob, topFP,
  } = stats;

  const fpTotal = bloques.fp;

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>PBA · Campaña 2027</div>
          <h1 className={styles.title}>Panel de comando</h1>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.headerStat}>
            <span className={styles.headerStatNum}>{fmt(total)}</span>
            <span className={styles.headerStatLabel}>municipios</span>
          </div>
          <div className={styles.headerStatDiv} />
          <div className={styles.headerStat}>
            <span className={styles.headerStatNum}>{fmt(Math.round(totalPadron / 1000))}k</span>
            <span className={styles.headerStatLabel}>padrón electoral</span>
          </div>
          <div className={styles.headerStatDiv} />
          <div className={styles.headerStat}>
            <span className={styles.headerStatNum}>{fmt(Math.round(totalPob / 1000))}k</span>
            <span className={styles.headerStatLabel}>población 2025</span>
          </div>
          <div className={styles.headerStatDiv} />
          <div className={styles.headerStat}>
            <span className={styles.headerStatNum} style={{ color: BLOQUE_COLORS.fp }}>{bloques.fp}</span>
            <span className={styles.headerStatLabel}>municipios FP</span>
          </div>
        </div>
      </div>

      {/* ── FP · Panorama general ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionDot} style={{ background: BLOQUE_COLORS.fp }} />
          <h2 className={styles.sectionTitle}>Fuerza Patria · Panorama general</h2>
        </div>
        <div className={styles.fpPanorama}>

          {/* KPI: Municipios */}
          <div className={styles.fpKpi}>
            <div className={styles.fpKpiTop}>
              <span className={styles.fpKpiNum}>{bloques.fp}</span>
              <span className={styles.fpKpiBadge}>de {total}</span>
            </div>
            <div className={styles.fpKpiLabel}>municipios gobernados por FP</div>
            <div className={styles.fpKpiSub}>{pct(bloques.fp, total)} del total provincial</div>
            <div className={styles.fpProgressTrack}>
              <div className={styles.fpProgressFill} style={{ width: pct(bloques.fp, total) }} />
            </div>
          </div>

          {/* KPI: Padrón */}
          <div className={styles.fpKpi}>
            <div className={styles.fpKpiTop}>
              <span className={styles.fpKpiNum}>{pct(fpPadron, totalPadron)}</span>
            </div>
            <div className={styles.fpKpiLabel}>del padrón en municipios FP</div>
            <div className={styles.fpKpiSub}>
              {fmt(Math.round(fpPadron / 1000))}k votantes · {fmt(Math.round(fpPob / 1000))}k hab.
            </div>
            <div className={styles.fpProgressTrack}>
              <div className={styles.fpProgressFill} style={{ width: pct(fpPadron, totalPadron) }} />
            </div>
          </div>

          {/* Fortaleza breakdown */}
          <div className={styles.fpStrengthCard}>
            <div className={styles.fpStrengthCardTitle}>Fortaleza de los {fpTotal} intendentes FP</div>
            <div className={styles.fpStrengthRows}>
              {(["fuerte", "competitivo", "debil", "sin_datos"] as const).map((key) => {
                const meta   = FORTALEZA_META[key];
                const count  = fpFortaleza[key] ?? 0;
                return (
                  <div key={key} className={styles.fpStrengthRow}>
                    <span className={styles.fpStrengthDot} style={{ background: meta.color }} />
                    <span className={styles.fpStrengthLabel}>{meta.label}</span>
                    <span className={styles.fpStrengthNum} style={{ color: meta.color }}>{count}</span>
                    <div className={styles.fpStrengthBarTrack}>
                      <div
                        className={styles.fpStrengthBarFill}
                        style={{ width: pct(count, fpTotal), background: meta.color }}
                      />
                    </div>
                    <span className={styles.fpStrengthPct}>{pct(count, fpTotal)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── FP · Concejo Deliberante ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionDot} style={{ background: BLOQUE_COLORS.fp }} />
          <h2 className={styles.sectionTitle}>Fuerza Patria · Control del Concejo Deliberante</h2>
        </div>
        <div className={styles.concejoGrid}>
          {([
            { key: "mayoria",  label: "Mayoría",    sub: "FP controla el concejo",       color: "#16A34A", bg: "#F0FDF4", icon: "▲" },
            { key: "mitad",    label: "Mitad",       sub: "FP tiene exactamente la mitad", color: "#D97706", bg: "#FFFBEB", icon: "◆" },
            { key: "minoria",  label: "Minoría",     sub: "FP es oposición en el concejo", color: "#DC2626", bg: "#FEF2F2", icon: "▼" },
            { key: "sd",       label: "Sin datos",   sub: "Sin información disponible",    color: "#9CA3AF", bg: "#F9FAFB", icon: "·" },
          ] as const).map(({ key, label, sub, color, bg, icon }) => {
            const count = fpConcejo[key] ?? 0;
            return (
              <div key={key} className={styles.concejoCard} style={{ borderTopColor: color, background: bg }}>
                <div className={styles.concejoIcon} style={{ color }}>{icon}</div>
                <div className={styles.concejoNum} style={{ color }}>{count}</div>
                <div className={styles.concejoLabel}>{label}</div>
                <div className={styles.concejoPct}>{pct(count, fpTotal)} de los mun. FP</div>
                <div className={styles.concejoSub}>{sub}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Bloques políticos ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Conducción municipal · Bloque político</h2>
        </div>
        <div className={styles.bloqueGrid}>
          {(["fp", "jxc", "lla", "otro", "sd"] as const).map((b) => {
            const meta         = BLOC_META[b];
            const count        = bloques[b] ?? 0;
            const padronBloque = bloquesPadron[b] ?? 0;
            return (
              <div key={b} className={styles.bloqueCard} style={{ borderTopColor: meta.color, background: meta.bg }}>
                <div className={styles.bloqueCount} style={{ color: meta.color }}>{count}</div>
                <div className={styles.bloqueLabel}>{meta.label}</div>
                <div className={styles.bloquePct}>{pct(count, total)} del total</div>
                <div className={styles.bloqueBar}>
                  <div className={styles.bloqueBarFill} style={{ width: pct(count, total), background: meta.color }} />
                </div>
                {padronBloque > 0 && (
                  <div className={styles.bloquePadron}>
                    {fmt(Math.round(padronBloque / 1000))}k padrón · {pct(padronBloque, totalPadron)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Liderazgo local ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Liderazgo local · Fortaleza del intendente (todos los municipios)</h2>
        </div>
        <div className={styles.fourGrid}>
          {(["fuerte", "competitivo", "debil", "sin_datos"] as const).map((k) => {
            const meta  = FORTALEZA_META[k];
            const count = fortaleza[k] ?? 0;
            return (
              <div key={k} className={styles.metricCard} style={{ borderLeftColor: meta.color, background: meta.bg }}>
                <div className={styles.metricCount} style={{ color: meta.color }}>{count}</div>
                <div className={styles.metricLabel}>{meta.label}</div>
                <div className={styles.metricSub}>{pct(count, total)} del total</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Performance provincial ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Performance de Fuerza Patria · Nivel provincial</h2>
        </div>
        <div className={styles.fiveGrid}>
          {(["fuerte", "competitivo", "debil", "muy_debil", "sin_datos"] as const).map((k) => {
            const meta  = PROV_META[k];
            const count = provincial[k] ?? 0;
            return (
              <div key={k} className={styles.metricCard} style={{ borderLeftColor: meta.color, background: meta.bg }}>
                <div className={styles.metricCount} style={{ color: meta.color }}>{count}</div>
                <div className={styles.metricLabel}>{meta.label}</div>
                <div className={styles.metricSub}>{pct(count, total)}</div>
              </div>
            );
          })}
        </div>
        <div className={styles.fpGanoBadge}>
          <span className={styles.fpGanoNum}>{fpGanoProv}</span>
          <span className={styles.fpGanoText}>
            municipios donde FP superó el 50% en la elección a gobernador 2023
          </span>
        </div>
      </section>

      {/* ── Top FP por padrón ── */}
      {topFP.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionDot} style={{ background: BLOQUE_COLORS.fp }} />
            <h2 className={styles.sectionTitle}>Fuerza Patria · Municipios con mayor padrón</h2>
          </div>
          <div className={styles.topTable}>
            <div className={styles.topHeader}>
              <span>#</span>
              <span>Municipio</span>
              <span>Intendente</span>
              <span>Fortaleza</span>
              <span>Padrón</span>
              <span>2023 %</span>
              <span>Concej. 2025 %</span>
            </div>
            {topFP.map((m, i) => {
              const fScore = calcFortalezaScore(m);
              const fNivel = getFortalezaNivel(fScore);
              return (
                <div key={m.nombre} className={styles.topRow}>
                  <span className={styles.topIdx}>{i + 1}</span>
                  <span className={styles.topNombre}>{m.nombre}</span>
                  <span className={styles.topIntendente}>{m.intendente || "—"}</span>
                  <span><FortalezaBadge nivel={fNivel} /></span>
                  <span className={styles.topNum}>{m.padron ? fmt(m.padron) : "—"}</span>
                  <span className={styles.topNum}>
                    {m.porcentaje_2023 != null ? `${m.porcentaje_2023.toFixed(1)}%` : "—"}
                  </span>
                  <span className={styles.topNum}>
                    {m.porcentaje_concejales_2025 != null ? `${m.porcentaje_concejales_2025.toFixed(1)}%` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
