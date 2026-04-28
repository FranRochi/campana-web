"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { apiRequest } from "@/lib/api";
import { clearSession, getToken, getUser, type SessionUser } from "@/lib/auth";
import type { CampaignModule } from "@/types/campaign";

import styles from "./dashboard-shell.module.css";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.6" y2="16.6" />
    </svg>
  );
}

function BarsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V9" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20v-11" />
    </svg>
  );
}

const NAV_ICONS: Record<string, ReactNode> = {
  inicio: <HomeIcon />,
  "mapa-pba": <MapIcon />,
  "buscador-municipios": <SearchIcon />,
  "analisis-electoral": <BarsIcon />,
};

const DEFAULT_MODULES: CampaignModule[] = [
  {
    key: "inicio",
    title: "Inicio",
    description: "Resumen general del sistema.",
    route: "/dashboard",
  },
  {
    key: "mapa-pba",
    title: "Mapa PBA",
    description: "Visualizacion territorial de municipios.",
    route: "/dashboard/mapa",
  },
  {
    key: "buscador-municipios",
    title: "Buscador de Municipios",
    description: "Consulta territorial y ficha municipal.",
    route: "/dashboard/municipios",
  },
  {
    key: "analisis-electoral",
    title: "Analisis electoral",
    description: "Resultados electorales por municipio.",
    route: "/dashboard/elecciones",
  },
];

function getFirstName(user: SessionUser | null) {
  if (!user) return "Operador";
  const candidate = (user.full_name || user.username || "Operador").trim();
  return candidate.split(/\s+/)[0] || candidate;
}

function getAvatarCandidates(user: SessionUser | null) {
  if (!user) return [];
  const username = user.username?.trim();
  const firstName = getFirstName(user);
  return [username, firstName]
    .filter(Boolean)
    .flatMap((value) => [`/${value}.jpg`, `/usuarios/${value}.jpg`, `/static/img/${value}.jpg`]);
}

function UserAvatar({ user }: { user: SessionUser | null }) {
  const [index, setIndex] = useState(0);
  const candidates = useMemo(() => getAvatarCandidates(user), [user]);

  useEffect(() => {
    setIndex(0);
  }, [candidates]);

  const initials = useMemo(() => {
    const base = user?.full_name || user?.username || "PBA";
    return base
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "PBA";
  }, [user]);

  const src = candidates[index];

  if (!src) {
    return <div className={styles.avatarFallback}>{initials}</div>;
  }

  return (
    <img
      src={src}
      alt={user?.full_name || user?.username || "Usuario"}
      className={styles.avatar}
      onError={() => {
        if (index < candidates.length - 1) setIndex((current) => current + 1);
        else setIndex(candidates.length);
      }}
    />
  );
}

type ModulesResponse = { modules: CampaignModule[] };

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [modules, setModules] = useState<CampaignModule[]>(DEFAULT_MODULES);
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
          if (!merged.find((item) => item.route === module.route)) {
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
        <div className={styles.sidebarTop}>
          <div className={styles.userCard}>
            <div className={styles.avatarWrap}>
              <UserAvatar user={user} />
            </div>
            <div className={styles.userGreeting}>Bienvenido, {getFirstName(user)}</div>
          </div>

          <nav className={styles.nav}>
            {modules.map((module) => (
              <Link
                key={module.key}
                href={module.route}
                className={pathname === module.route ? styles.active : styles.link}
              >
                <span className={styles.navIcon}>{NAV_ICONS[module.key] ?? <MapIcon />}</span>
                <span className={styles.navLabel}>{module.title}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.footer}>
          <div className={styles.systemBrand}>
            <div className={styles.systemMark}>PBA</div>
            <div className={styles.systemText}>CAMPAÑA 2027</div>
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

      <nav className={styles.bottomNav}>
        {modules.map((module) => (
          <Link
            key={module.key}
            href={module.route}
            className={`${styles.navTab} ${pathname === module.route ? styles.navTabActive : ""}`}
          >
            <span className={styles.navTabIcon}>{NAV_ICONS[module.key] ?? <MapIcon />}</span>
            <span className={styles.navTabLabel}>{module.title}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
