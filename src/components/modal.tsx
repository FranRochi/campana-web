"use client";

import { type ReactNode } from "react";

import styles from "./modal.module.css";

type ModalTab = { label: string; value: string };

type Props = {
  title: string;
  eyebrow?: string;
  subtitle?: ReactNode;
  accentColor?: string;
  tabs?: ModalTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ title, eyebrow, subtitle, accentColor, tabs, activeTab, onTabChange, onClose, children }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <section className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          {accentColor && <div className={styles.accentBand} style={{ background: accentColor }} />}
          <div className={styles.headerBand}>
            <button className={styles.close} onClick={onClose} type="button" aria-label="Cerrar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {eyebrow && <div className={styles.eyebrow} style={{ color: accentColor }}>{eyebrow}</div>}
            <h2 className={styles.title}>{title}</h2>
            {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
          </div>
          {tabs && tabs.length > 0 && (
            <div className={styles.tabs}>
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`${styles.tab} ${activeTab === tab.value ? styles.tabActive : ""}`}
                  onClick={() => onTabChange?.(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={styles.body}>{children}</div>
      </section>
    </div>
  );
}
