"use client";

import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { MunicipioDetalle, MunicipioTablaFila, PaginatedResponse } from "@/types/campaign";

import { Modal } from "./modal";
import styles from "./municipalities-panel.module.css";

const PAGE_SIZE = 15;

function num(value: number | null | undefined) {
  return value != null ? value.toLocaleString("es-AR") : "--";
}

function intendenteNombre(row: MunicipioTablaFila) {
  return row.intendente?.nombre || row.intendente_nombre || "--";
}

function intendentePartido(row: MunicipioTablaFila) {
  return row.intendente?.partido || row.partido || "";
}

function intendenteFrente(row: MunicipioTablaFila) {
  return row.intendente?.frente || row.frente || row.partido || "--";
}

export function MunicipalitiesPanel() {
  const [rows, setRows] = useState<MunicipioTablaFila[]>([]);
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

    apiRequest<PaginatedResponse<MunicipioTablaFila>>(`/municipalities/tabla/?${query.toString()}`, { token })
      .then((response) => {
        setRows(response.results);
        setCount(response.count);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [page, search]);

  async function openMunicipio(item: MunicipioTablaFila) {
    const token = getToken();
    if (!token) return;
    const detail = await apiRequest<MunicipioDetalle>(`/municipalities/${item.nombre_normalizado}/`, { token });
    setSelected(detail);
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const latestElection = useMemo(() => {
    if (!selected?.resultados?.length) return null;
    return [...selected.resultados].sort((a, b) => b.anio - a.anio)[0];
  }, [selected]);

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.eyebrow}>Territorio</div>
          <div className={styles.title}>Municipios</div>
        </div>
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

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Municipio</th>
              <th>Intendente</th>
              <th>Frente</th>
              <th>Sección</th>
              <th>Población</th>
              <th>Padrón</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => openMunicipio(row)}>
                <td>
                  <div className={styles.municipioCell}>{row.nombre}</div>
                </td>
                <td>
                  <div>{intendenteNombre(row)}</div>
                  <div className={styles.subCell}>{intendentePartido(row)}</div>
                </td>
                <td>
                  <span className={styles.pill}>{intendenteFrente(row)}</span>
                </td>
                <td>{row.seccion_electoral_nombre || row.seccion_electoral_numero || "--"}</td>
                <td>{num(row.poblacion_2022)}</td>
                <td>{num(row.padron)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && rows.length === 0 ? <div className={styles.noData}>Sin municipios cargados.</div> : null}
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

      {selected ? (
        <Modal
          title={selected.nombre}
          subtitle={selected.intendente ? `${selected.intendente.nombre} · ${selected.intendente.frente || selected.intendente.partido}` : "Ficha municipal"}
          onClose={() => setSelected(null)}
        >
          <div className={styles.modalBody}>
            <div className={styles.statsGrid}>
              <article className={styles.statBox}>
                <span>Sección electoral</span>
                <strong>{selected.seccion_electoral_nombre || selected.seccion_electoral_numero || "--"}</strong>
              </article>
              <article className={styles.statBox}>
                <span>Población 2022</span>
                <strong>{num(selected.poblacion_2022)}</strong>
              </article>
              <article className={styles.statBox}>
                <span>Población 2025</span>
                <strong>{num(selected.poblacion_2025)}</strong>
              </article>
              <article className={styles.statBox}>
                <span>Padrón</span>
                <strong>{num(selected.padron)}</strong>
              </article>
              <article className={styles.statBox}>
                <span>Partido / frente</span>
                <strong>{selected.intendente ? `${selected.intendente.partido || "--"} / ${selected.intendente.frente || "--"}` : "--"}</strong>
              </article>
            </div>

            {latestElection ? (
              <section className={styles.panel}>
                <h3>Último resultado</h3>
                <div className={styles.resultItem}>
                  <strong>
                    {latestElection.anio} · {latestElection.cargo}
                  </strong>
                  <p>
                    Participación: {latestElection.participacion_porcentaje ?? "--"}% · Padrón: {num(latestElection.padron)}
                  </p>
                </div>
              </section>
            ) : null}

            <section className={styles.panel}>
              <h3>Historial electoral cargado</h3>
              <div className={styles.resultList}>
                {selected.resultados.length ? (
                  selected.resultados
                    .slice()
                    .sort((a, b) => b.anio - a.anio)
                    .map((result) => {
                      const orderedForces = [...result.fuerzas].sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0));
                      const [firstForce, secondForce] = orderedForces;
                      return (
                        <article key={`${result.anio}-${result.cargo}`} className={styles.resultItem}>
                          <strong>
                            {result.anio} · {result.cargo}
                          </strong>
                          <p>
                            1ra fuerza: {firstForce?.nombre || "--"} ({num(firstForce?.votos)} votos)
                          </p>
                          <p>
                            2da fuerza: {secondForce?.nombre || "--"} ({num(secondForce?.votos)} votos)
                          </p>
                        </article>
                      );
                    })
                ) : (
                  <div className={styles.noData}>Sin resultados históricos cargados.</div>
                )}
              </div>
            </section>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
