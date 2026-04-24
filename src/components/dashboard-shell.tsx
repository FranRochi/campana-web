"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { apiRequest } from "@/lib/api";
import { clearSession, getToken, getUser, type SessionUser } from "@/lib/auth";
import type { CampaignModule } from "@/types/campaign";

import styles from "./dashboard-shell.module.css";

const NAV_ICONS: Record<string, ReactNode> = {
  "mapa-pba": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  municipios: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  elecciones: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
};

type ModulesResponse = { modules: CampaignModule[] };

const DEFAULT_MODULES: CampaignModule[] = [
  {
    key: "mapa-pba",
    title: "Mapa PBA",
    description: "Visualización territorial de municipios.",
    route: "/dashboard/mapa",
  },
  {
    key: "municipios",
    title: "Municipios",
    description: "Tabla municipal con padrón y ficha política.",
    route: "/dashboard/municipios",
  },
  {
    key: "elecciones",
    title: "Elecciones",
    description: "Resultados electorales por municipio.",
    route: "/dashboard/elecciones",
  },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [modules, setModules] = useState<CampaignModule[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const token = getToken();
    const storedUser = getUser();
    setUser(storedUser);
    setModules(DEFAULT_MODULES);

    if (!token || !storedUser) {
      router.replace("/login");
      return;
    }

    apiRequest<ModulesResponse>("/maps/modules/", { token })
      .then((response) => {
        const merged = [...DEFAULT_MODULES];
        for (const module of response.modules) {
          if (!merged.find((item) => item.key === module.key)) {
            merged.push(module);
          }
        }
        setModules(merged);
      })
      .catch(() => {
        setModules(DEFAULT_MODULES);
      });
  }, [router]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <span>PBA</span>
          </div>
          <div className={styles.brandText}>
            <strong>Campaña 2025</strong>
            <small>Provincia de Bs. As.</small>
          </div>
        </div>

        <nav className={styles.nav}>
          {modules.map((module) => (
            <Link
              key={module.key}
              href={module.route}
              className={pathname === module.route ? styles.active : styles.link}
            >
              <span className={styles.navIcon}>{NAV_ICONS[module.key]}</span>
              {module.title}
            </Link>
          ))}
        </nav>

        <div className={styles.footer}>
          <div className={styles.footerUser}>
            <strong>{user?.full_name ?? "Operador"}</strong>
            <span>{user?.username ?? ""}</span>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={() => {
              clearSession();
              router.replace("/login");
            }}
            type="button"
          >
            Salir
          </button>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
