"use client";

import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { MunicipioDetalle, MunicipioEleccionFila, PaginatedResponse, ResultadoElectoral } from "@/types/campaign";

import { Modal } from "./modal";
import styles from "./elections-panel.module.css";

const PAGE_SIZE = 15;
const CARGO_PRIORITY = ["Intendente", "Concejales", "Gobernador", "Presidente", "Diputados Provinciales", "Senadores Provinciales"];

const BLOCS = [
  {
    key: "PJ",
    label: "PJ / UP / Fuerza Patria",
    color: "#5BB8FF",
    match: (name: string) => {
      const n = name.toUpperCase();
      return (
        n === "PJ" ||
        n.includes("PARTIDO JUSTICIALISTA") ||
        n.includes("FUERZA PATRIA") ||
        n.includes("UNION POR LA PATRIA") ||
        n.includes("FRENTE PARA LA VICTORIA") ||
        n.includes("FRENTE DE TODOS") ||
        n.includes("UNIDAD CIUDADANA") ||
        n.includes("PERONISMO") ||
        n.includes("FRENTE RENOVADOR")
      );
    },
  },
  {
    key: "LLA",
    label: "La Libertad Avanza",
    color: "#8B5CF6",
    match: (name: string) => {
      const n = name.toUpperCase();
      return n.includes("LA LIBERTAD AVANZA") || n.includes("LIBERTAD AVANZA");
    },
  },
  {
    key: "PRO",
    label: "PRO / Cambiemos / JxC",
    color: "#F2C94C",
    match: (name: string) => {
      const n = name.toUpperCase();
      return n.includes("JUNTOS") || n.includes("CAMBIEMOS") || n.includes("PROPUESTA REPUBLICANA") || (n.includes("PRO") && !n.includes("PROGRESO"));
    },
  },
] as const;

function forceColor(name: string): string {
  for (const bloc of BLOCS) {
    if (bloc.match(name)) return bloc.color;
  }
  if ((name || "").toUpperCase().includes("IZQUIERDA") || (name || "").toUpperCase().includes("FIT")) return "#EF4444";

  const palette = ["#34C759", "#FF9500", "#5AC8FA", "#FF2D55", "#AF52DE", "#64D2FF", "#30B0C7", "#FFD60A"];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
}

function num(value: number | null | undefined) {
  return value != null ? value.toLocaleString("es-AR") : "--";
}

function cargoRank(cargo: string) {
  const index = CARGO_PRIORITY.indexOf(cargo);
  return index === -1 ? 999 : index;
}

function getBlocVotes(result: ResultadoElectoral, bloc: (typeof BLOCS)[number]): number {
  return result.fuerzas.filter((force) => bloc.match(force.nombre)).reduce((sum, force) => sum + (force.votos ?? 0), 0);
}

function EvolutionChart({ resultados, cargo }: { resultados: ResultadoElectoral[]; cargo: string }) {
  const sorted = [...resultados].sort((a, b) => a.anio - b.anio);

  if (!sorted.length) {
    return <div className={styles.noData}>Sin serie histórica cargada para {cargo} en este municipio.</div>;
  }

  const years = sorted.map((result) => result.anio);
  const maxVotes = Math.max(1, ...sorted.flatMap((result) => BLOCS.map((bloc) => getBlocVotes(result, bloc))));
  const width = 760;
  const height = 320;
  const paddingX = 60;
  const paddingTop = 18;
  const paddingBottom = 42;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;

  function xAt(index: number) {
    if (sorted.length <= 1) return width / 2;
    return paddingX + (plotWidth * index) / (sorted.length - 1);
  }

  function yAt(votes: number) {
    return paddingTop + plotHeight - (votes / maxVotes) * plotHeight;
  }

  const activeBlocs = BLOCS.filter((bloc) => sorted.some((result) => getBlocVotes(result, bloc) > 0));
  const blocsToRender = activeBlocs.length ? activeBlocs : BLOCS;

  return (
    <div className={styles.timelineSection}>
      <div className={styles.chartBlock}>
        <div className={styles.chartBlockHeader}>
          <div>
            <div className={styles.chartBlockTitle}>Evolución temporal</div>
            <div className={styles.chartBlockSub}>Serie histórica 2007–2023 · {cargo}</div>
          </div>
          <div className={styles.chartLegend}>
            {blocsToRender.map((bloc) => (
              <div key={bloc.key} className={styles.chartLegendItem}>
                <span className={styles.chartLegendDot} style={{ background: bloc.color }} />
                {bloc.label}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.timelineChart}>
          <svg viewBox={`0 0 ${width} ${height}`} className={styles.timelineSvg} role="img" aria-label={`Evolución de votos para ${cargo}`}>
            {blocsToRender.map((bloc) => {
              const dataPoints = sorted.map((result, index) => ({
                x: xAt(index),
                y: yAt(getBlocVotes(result, bloc)),
              }));
              if (sorted.length <= 1 || bloc.key !== "PJ") return null;
              const bottomY = paddingTop + plotHeight;
              const areaPath = [
                `M ${dataPoints[0].x} ${dataPoints[0].y}`,
                ...dataPoints.slice(1).map((pt) => `L ${pt.x} ${pt.y}`),
                `L ${dataPoints[dataPoints.length - 1].x} ${bottomY}`,
                `L ${dataPoints[0].x} ${bottomY}`,
                "Z",
              ].join(" ");
              return (
                <path
                  key={`${bloc.key}-area`}
                  d={areaPath}
                  fill={bloc.color}
                  fillOpacity="0.08"
                />
              );
            })}

            {[0, 0.25, 0.5, 0.75, 1].map((step) => {
              const y = paddingTop + plotHeight - plotHeight * step;
              const votes = Math.round(maxVotes * step);
              return (
                <g key={step}>
                  <line x1={paddingX} x2={width - paddingX} y1={y} y2={y} className={styles.gridLine} />
                  <text x={paddingX - 8} y={y + 4} textAnchor="end" className={styles.axisLabel}>
                    {votes >= 1000 ? `${Math.round(votes / 1000)}k` : votes}
                  </text>
                </g>
              );
            })}

            {years.map((year, index) => {
              const x = xAt(index);
              return (
                <g key={`${cargo}-${year}`}>
                  <text x={x} y={height - 12} textAnchor="middle" className={styles.axisLabel}>
                    {year}
                  </text>
                </g>
              );
            })}

            {blocsToRender.map((bloc) => {
              const dataPoints = sorted.map((result, index) => ({
                x: xAt(index),
                y: yAt(getBlocVotes(result, bloc)),
                votes: getBlocVotes(result, bloc),
                anio: result.anio,
              }));
              const points = dataPoints.map((point) => `${point.x},${point.y}`).join(" ");

              return (
                <g key={bloc.key}>
                  {sorted.length > 1 ? (
                    <polyline points={points} fill="none" stroke={bloc.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  ) : null}
                  {dataPoints.map((point) => (
                    <g key={`${bloc.key}-${point.anio}`}>
                      <circle cx={point.x} cy={point.y} r="5" fill={bloc.color} stroke="white" strokeWidth="2" />
                      <title>{`${bloc.label} · ${point.anio}: ${point.votes.toLocaleString("es-AR")} votos`}</title>
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className={styles.historicoTitle}>Resultados por año</div>
      <div className={styles.historicoList}>
        {sorted.map((result) => {
          const leader = [...result.fuerzas].sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0))[0];
          const leaderColor = leader ? forceColor(leader.nombre) : "#ccc";
          return (
            <div key={`${result.anio}-${result.cargo}`} className={styles.historicoCard}>
              <div className={styles.hcYear}>
                <div className={styles.hcYearNum}>{result.anio}</div>
                <div className={styles.hcCargo}>{result.cargo}</div>
              </div>
              <div className={styles.hcCenter}>
                <div className={styles.hcFuerza}>
                  <span className={styles.hcBloqueDot} style={{ background: leaderColor }} />
                  {leader?.nombre || "Sin dato"}
                </div>
                <div className={styles.hcVotos}>{num(leader?.votos)} votos</div>
              </div>
              <div className={styles.hcRight}>
                <div className={styles.hcPartLabel}>Participación</div>
                <div className={styles.hcPartValue}>{result.participacion_porcentaje ? `${parseFloat(result.participacion_porcentaje).toFixed(1)}%` : "--"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LatestSummary({ result }: { result: ResultadoElectoral }) {
  const sortedForces = [...result.fuerzas].sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0));
  const [firstForce, secondForce] = sortedForces;
  const firstPct = parseFloat(firstForce?.porcentaje ?? "0");
  const secondPct = parseFloat(secondForce?.porcentaje ?? "0");

  return (
    <div className={styles.statsRow}>
      <div className={`${styles.statBox} ${styles.statBoxHighlight}`}>
        <div className={styles.statLabel}>Último corte</div>
        <div className={styles.statValueLarge}>{result.anio}</div>
        <div className={styles.statSub}>{result.cargo}</div>
      </div>
      <div className={styles.statBox}>
        <div className={styles.statLabel}>1ra fuerza</div>
        <div className={styles.statValue}>{firstForce?.nombre || "--"}</div>
        <div className={styles.statSub}>{firstForce ? `${num(firstForce.votos)} votos` : ""}</div>
      </div>
      <div className={styles.statBox}>
        <div className={styles.statLabel}>2da fuerza</div>
        <div className={styles.statValue}>{secondForce?.nombre || "--"}</div>
        <div className={styles.statSub}>{secondForce ? `${secondPct.toFixed(1)}% · ${num(secondForce.votos)} votos` : ""}</div>
      </div>
      <div className={styles.statBox}>
        <div className={styles.statLabel}>Participación</div>
        <div className={styles.statValueLarge}>
          {result.participacion_porcentaje ? `${parseFloat(result.participacion_porcentaje).toFixed(1)}%` : "--"}
        </div>
        <div className={styles.statSub}>{result.padron ? `Padrón ${num(result.padron)}` : ""}</div>
      </div>
    </div>
  );
}

function getBloqueAccentColor(municipio: MunicipioDetalle): string {
  const frente = (municipio.intendente?.frente || municipio.intendente?.partido || "").toUpperCase();
  if (frente.includes("FUERZA PATRIA") || frente.includes("UNION POR LA PATRIA") || frente.includes("FRENTE") || frente.includes("PERONISMO") || frente.includes("PJ")) return "#4F8FC0";
  if (frente.includes("LIBERTAD AVANZA")) return "#E8749A";
  if (frente.includes("JUNTOS") || frente.includes("CAMBIEMOS") || frente.includes("PRO") || frente.includes("UCR")) return "#F0A030";
  return "#9B6BD4";
}

function EleccionesModal({ municipio, onClose }: { municipio: MunicipioDetalle; onClose: () => void }) {
  const grouped = useMemo(() => {
    const byCargo = new Map<string, ResultadoElectoral[]>();

    for (const result of municipio.resultados ?? []) {
      const list = byCargo.get(result.cargo) ?? [];
      list.push(result);
      byCargo.set(result.cargo, list);
    }

    return Array.from(byCargo.entries())
      .sort((a, b) => cargoRank(a[0]) - cargoRank(b[0]))
      .map(([cargo, results]) => ({
        cargo,
        results: results.sort((a, b) => a.anio - b.anio),
      }));
  }, [municipio.resultados]);

  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    setActiveTab(grouped[0]?.cargo ?? "");
  }, [municipio.nombre_normalizado, grouped]);

  const activeGroup = grouped.find((g) => g.cargo === activeTab) ?? grouped[0] ?? null;
  const latest = useMemo(() => {
    if (!activeGroup?.results.length) return null;
    return [...activeGroup.results].sort((a, b) => b.anio - a.anio)[0];
  }, [activeGroup]);

  const accentColor = getBloqueAccentColor(municipio);
  const dotColor = accentColor;
  const seccionLabel = municipio.seccion_electoral_nombre ? `Sección ${municipio.seccion_electoral_numero ?? ""} ${municipio.seccion_electoral_nombre}`.trim() : "Municipio";

  const subtitleNode = municipio.intendente ? (
    <>
      <span className={styles.intendenteTag}>
        <span className={styles.intendenteTagDot} style={{ background: dotColor }} />
        {municipio.intendente.nombre}
      </span>
      {municipio.intendente.partido && (
        <>
          <span className={styles.subtitleSep}>·</span>
          <span>{municipio.intendente.partido}</span>
        </>
      )}
    </>
  ) : undefined;

  return (
    <Modal
      title={municipio.nombre}
      eyebrow={`${seccionLabel} · Municipio`}
      subtitle={subtitleNode}
      accentColor={accentColor}
      tabs={grouped.map((g) => ({ label: g.cargo, value: g.cargo }))}
      activeTab={activeTab || grouped[0]?.cargo}
      onTabChange={setActiveTab}
      onClose={onClose}
    >
      <div className={styles.modalBody}>
        {!grouped.length ? (
          <div className={styles.noData}>Sin resultados electorales cargados.</div>
        ) : (
          <>
            {latest ? <LatestSummary result={latest} /> : null}
            {activeGroup ? <EvolutionChart resultados={activeGroup.results} cargo={activeGroup.cargo} /> : null}
          </>
        )}
      </div>
    </Modal>
  );
}

export function ElectionsPanel() {
  const [rows, setRows] = useState<MunicipioEleccionFila[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState<MunicipioDetalle | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (search.trim()) query.set("search", search.trim());
    apiRequest<PaginatedResponse<MunicipioEleccionFila>>(`/municipalities/elecciones-tabla/?${query.toString()}`, {
      token,
    })
      .then((response) => {
        setRows(response.results);
        setCount(response.count);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [page, search]);

  async function openMunicipio(item: MunicipioEleccionFila) {
    const token = getToken();
    if (!token) return;
    const detail = await apiRequest<MunicipioDetalle>(`/municipalities/${item.nombre_normalizado}/`, { token });
    setSelected(detail);
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <div className={styles.eyebrow}>Resultados</div>
          <div className={styles.title}>Elecciones</div>
        </div>
        <div className={styles.searchBox}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className={styles.search}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar municipio..."
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Municipio</th>
              <th>Año / cargo</th>
              <th>1ra fuerza</th>
              <th>2da fuerza</th>
              <th className={styles.right}>Diferencia</th>
              <th className={styles.right}>Participación</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const fuerzas = row.ultimo_resultado?.fuerzas ?? [];
              const sorted = [...fuerzas].sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0));
              const firstForce = sorted[0];
              const secondForce = sorted[1];
              const result = row.ultimo_resultado;
              const firstPct = parseFloat(firstForce?.porcentaje ?? "0");
              const secondPct = parseFloat(secondForce?.porcentaje ?? "0");

              // Diferencia desde la perspectiva de Fuerza Patria
              const isFP = (name: string) => {
                const n = name.toUpperCase();
                return n.includes("FUERZA PATRIA") || n.includes("UNION POR LA PATRIA") || n.includes("FRENTE DE TODOS") || n.includes("FRENTE PARA LA VICTORIA");
              };
              const fpForce = sorted.find((f) => isFP(f.nombre));
              const rivalForce = sorted.find((f) => !isFP(f.nombre));
              let diffText = "--";
              let diffClass = "";
              if (fpForce && rivalForce) {
                const d = parseFloat(fpForce.porcentaje ?? "0") - parseFloat(rivalForce.porcentaje ?? "0");
                diffText = d > 0 ? `+${d.toFixed(1)} pt` : `${d.toFixed(1)} pt`;
                diffClass = Math.abs(d) < 2 ? styles.diffTie : d > 0 ? styles.diffPos : styles.diffNeg;
              } else if (firstForce && secondForce) {
                const d = firstPct - secondPct;
                diffText = `+${d.toFixed(1)} pt`;
                diffClass = styles.diffTie;
              }

              return (
                <tr key={row.id} onClick={() => openMunicipio(row)}>
                  <td>
                    <div className={styles.municipioCell}>
                      <strong>{row.nombre}</strong>
                      {result && <span>{result.anio} · {result.cargo}</span>}
                    </div>
                  </td>
                  <td>
                    {result ? (
                      <div>
                        <span className={styles.anioTag}>{result.anio}</span>
                        <div className={styles.subCell}>{result.cargo}</div>
                      </div>
                    ) : (
                      "--"
                    )}
                  </td>
                  <td>
                    {firstForce ? (
                      <div className={styles.forcePill}>
                        <span className={styles.forceDot} style={{ background: forceColor(firstForce.nombre) }} />
                        <span className={styles.forceName}>{firstForce.nombre}</span>
                        <span className={styles.forcePct}>{firstPct.toFixed(1)}%</span>
                      </div>
                    ) : (
                      "--"
                    )}
                  </td>
                  <td>
                    {secondForce ? (
                      <div className={styles.forcePill}>
                        <span className={styles.forceDot} style={{ background: forceColor(secondForce.nombre) }} />
                        <span className={styles.forceName}>{secondForce.nombre}</span>
                        <span className={styles.forcePct}>{secondPct.toFixed(1)}%</span>
                      </div>
                    ) : (
                      "--"
                    )}
                  </td>
                  <td className={styles.right}>
                    <span className={`${styles.diff} ${diffClass}`}>{diffText}</span>
                  </td>
                  <td className={styles.right}>{result?.participacion_porcentaje ? `${parseFloat(result.participacion_porcentaje).toFixed(1)}%` : "--"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && rows.length === 0 ? <div className={styles.noData}>Sin resultados.</div> : null}
      </div>

      <div className={styles.pagination}>
        <span className={styles.pageInfo}>
          {count} municipios · página {page} de {totalPages}
        </span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">
            ← Anterior
          </button>
          <button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} type="button">
            Siguiente →
          </button>
        </div>
      </div>

      {selected ? <EleccionesModal municipio={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
