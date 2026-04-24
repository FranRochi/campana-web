"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

import styles from "./login-form.module.css";

type LoginResponse = {
  token: string;
  user: SessionUser;
};

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ username: false, password: false });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function fillDemo() {
    setUsername("admin");
    setPassword("admin1234");
    setFieldErrors({ username: false, password: false });
    setError("");
  }

  function clearFieldError(field: "username" | "password") {
    setFieldErrors((prev) => ({ ...prev, [field]: false }));
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newErrors = { username: !username.trim(), password: !password };
    setFieldErrors(newErrors);
    if (newErrors.username || newErrors.password) return;

    setError("");
    setLoading(true);

    try {
      const data = await apiRequest<LoginResponse>("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      saveSession(data.token, data.user);
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/mapa"), 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Usuario o contraseña incorrectos.");
      setFieldErrors({ username: true, password: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.layout}>
      {/* LEFT BRAND PANEL */}
      <div className={styles.brandPanel}>
        <div className={styles.gridLines} />

        <div className={styles.brandTop}>
          <div className={styles.brandLogo}>PBA</div>
          <div className={styles.brandName}>
            Campaña 2025
            <span>Provincia de Buenos Aires</span>
          </div>
        </div>

        <div className={styles.brandCenter}>
          <h1>
            Sistema de<br />gestión <em>electoral</em>
          </h1>
          <p>Administrá datos, seguí el avance territorial y coordiná equipos desde un solo lugar.</p>
        </div>

        <div className={styles.brandBottom}>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statNum}>135</div>
              <div className={styles.statLabel}>Municipios</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNum}>2025</div>
              <div className={styles.statLabel}>Campaña activa</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNum}>PBA</div>
              <div className={styles.statLabel}>Buenos Aires</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT FORM PANEL */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2>Bienvenido</h2>
            <p>Ingresá tus credenciales para acceder al sistema.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="username">Usuario</label>
              <div className={styles.inputWrap}>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="tu_usuario"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); clearFieldError("username"); }}
                  className={fieldErrors.username ? styles.inputError : ""}
                  autoFocus
                />
              </div>
              {fieldErrors.username && <span className={styles.fieldError}>Ingresá tu nombre de usuario.</span>}
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Contraseña</label>
              <div className={styles.inputWrap}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                  className={fieldErrors.password ? styles.inputError : ""}
                />
                <button
                  type="button"
                  className={styles.togglePw}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && <span className={styles.fieldError}>Ingresá tu contraseña.</span>}
            </div>

            {error ? <p className={styles.generalError}>{error}</p> : null}

            <button type="submit" className={styles.btnSubmit} disabled={loading}>
              {loading ? (
                <svg className={styles.spinner} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                </svg>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>

          <div className={styles.demoHint}>
            <div className={styles.demoHintIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className={styles.demoHintText}>
              Demo: <strong>admin</strong> / <strong>admin1234</strong> &nbsp;·&nbsp;
              <button type="button" onClick={fillDemo}>Completar automáticamente</button>
            </div>
          </div>
        </div>
      </div>

      {/* SUCCESS OVERLAY */}
      <div className={`${styles.successOverlay} ${success ? styles.successShow : ""}`}>
        <div className={styles.successIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className={styles.successText}>Acceso concedido</div>
      </div>
    </div>
  );
}
