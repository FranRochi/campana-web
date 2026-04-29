import Link from "next/link";

import styles from "./page.module.css";

const cards = [
  {
    title: "Mapa PBA",
    description: "Lectura territorial, capas politicas y secciones electorales.",
    href: "/dashboard/mapa",
  },
  {
    title: "Buscador de Municipios",
    description: "Consulta rapida de fichas municipales, intendentes y padron.",
    href: "/dashboard/municipios",
  },
  {
    title: "Analisis electoral",
    description: "Historico de resultados y comparacion de desempeno por distrito.",
    href: "/dashboard/elecciones",
  },
];

export default function DashboardHomePage() {
  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.eyebrow}>PBA Campana 2027</div>
        <h1 className={styles.title}>Panel de inicio</h1>
        <p className={styles.copy}>
          Acceso rapido a los tres ejes operativos del sistema: lectura territorial,
          consulta municipal y analisis electoral.
        </p>
      </div>

      <div className={styles.grid}>
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className={styles.card}>
            <div className={styles.cardTitle}>{card.title}</div>
            <div className={styles.cardCopy}>{card.description}</div>
            <div className={styles.cardAction}>Abrir modulo</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
