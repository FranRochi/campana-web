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
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Usuario o contrasena incorrectos.");
      setFieldErrors({ username: true, password: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.brandPanel}>
        <div className={styles.gridLines} />

        <div className={styles.brandTop}>
          <div className={styles.brandLogo}>PBA</div>
          <div className={styles.brandName}>
            Campana 2026-2027
            <span>Provincia de Buenos Aires</span>
          </div>
        </div>

        <div className={styles.brandCenter}>
          <h1>
            Sistema de
            <br />
            gestion <em>electoral</em>
          </h1>
          <p>Administra datos, segui el avance territorial y coordina equipos desde un solo lugar.</p>
        </div>

        <div className={styles.brandBottom}>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statNum}>135</div>
              <div className={styles.statLabel}>Municipios</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNum}>2026-2027</div>
              <div className={styles.statLabel}>Campana activa</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNum}>PBA</div>
              <div className={styles.statLabel}>Buenos Aires</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2>Bienvenido</h2>
            <p>Ingresa tus credenciales para acceder al sistema.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="username">Usuario</label>
              <div className={styles.inputWrap}>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    clearFieldError("username");
                  }}
                  className={fieldErrors.username ? styles.inputError : ""}
                  autoFocus
                />
              </div>
              {fieldErrors.username && <span className={styles.fieldError}>Ingresa tu nombre de usuario.</span>}
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Contrasena</label>
              <div className={styles.inputWrap}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("password");
                  }}
                  className={fieldErrors.password ? styles.inputError : ""}
                />
                <button
                  type="button"
                  className={styles.togglePw}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
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
              {fieldErrors.password && <span className={styles.fieldError}>Ingresa tu contrasena.</span>}
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
        </div>
      </div>

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
