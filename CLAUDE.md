# campaña-web — Frontend

Next.js 16 + React 19 + TypeScript. Dashboard electoral para la Provincia de Buenos Aires, Campaña 2027.
Todos los textos e interfaces están en español (es-AR).

## Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Estilos**: CSS Modules (sin Tailwind, sin UI lib externa)
- **Mapas**: Leaflet + react-leaflet
- **Auth**: Token-based (DRF TokenAuthentication); token guardado en `localStorage`
- **API**: DRF backend en `localhost:8000`; todas las llamadas pasan por `src/lib/api.ts`
- **Fuente de datos principal**: `/api/maps/pba/` devuelve GeoJSON con todos los municipios

## Estructura de rutas

```
/login                      → src/app/login/page.tsx
/dashboard                  → src/app/dashboard/page.tsx        ← INICIO (panel de comando)
/dashboard/mapa             → src/app/dashboard/mapa/page.tsx
/dashboard/municipios       → src/app/dashboard/municipios/page.tsx
/dashboard/elecciones       → src/app/dashboard/elecciones/page.tsx
/dashboard/inicio/          → src/app/dashboard/inicio/page.tsx  (no está en nav, legado)
```

El layout del dashboard está en `src/app/dashboard/layout.tsx` → wrappea con `<DashboardShell>`.
La navegación lateral y bottom nav se generan desde `DEFAULT_MODULES` en `dashboard-shell.tsx`.

## Archivos clave

| Archivo | Rol |
|---|---|
| `src/lib/api.ts` | `apiRequest<T>(path, {token})` — wrapper fetch al backend |
| `src/lib/auth.ts` | `getToken()`, `getUser()`, `clearSession()` — sesión en localStorage |
| `src/lib/bloque.ts` | `getMunicipioBloque(frente, partido)` → `"fp" \| "jxc" \| "lla" \| "otro" \| "sd"` |
| `src/lib/fortaleza.ts` | `calcFortalezaScore(m)` → número 0–100; `getFortalezaNivel()` → `"fuerte" \| "competitivo" \| "debil"` |
| `src/types/campaign.ts` | Todos los tipos TS: `GeoJsonFeature`, `PbaGeoJson`, `Municipio`, etc. |
| `src/components/dashboard-shell.tsx` | Shell con sidebar, bottom nav, avatar de usuario |

## Tipo central: GeoJsonFeature

`properties.municipio` contiene todos los datos de un municipio en el mapa:

```ts
{
  nombre, intendente, partido, frente, color,
  seccion_electoral_numero, seccion_electoral_nombre,
  poblacion_2022, poblacion_2025, padron,
  // Fortaleza local
  porcentaje_2023, control_concejo, electo, interino, reelecto,
  cantidad_mandatos, porcentaje_concejales_2025, tendencia_2023_2025,
  // Fortaleza provincial
  porcentaje_gobernador_2023, porcentaje_provincial_2025,
}
```

## Sistema de clasificación política

**Bloques** (`bloque.ts`): FP (Fuerza Patria/Peronismo) · JXC (PRO/UCR) · LLA (La Libertad Avanza) · Otro · SD

**Fortaleza local** (`fortaleza.ts`): score 0–100 ponderando % 2023, control del concejo, mandatos, tendencia, % concejales 2025.
- Fuerte ≥ 70 · Competitivo 45–69 · Débil < 45

**Fortaleza provincial**: ponderación de % gobernador 2023 + % provincial 2025.
- Consolidado ≥ 65 · Favorable 45–64 · Desfavorable 28–44 · Crítico < 28

## Colores de diseño

```
Fondo página:    #eef3f8
Texto primario:  #162d4b
Texto secundario:#697b90
Azul FP:         #62b5e5
Amarillo JXC:    #ffb81c
Violeta LLA:     #753bbd
Rosa Otro:       #F28BB3
```

## Convenciones

- Estilos siempre en CSS Modules (`*.module.css` co-ubicado con la página/componente)
- No usar Tailwind ni clases globales de utilidad
- Componentes "use client" cuando usan hooks o datos del API
- Números en español: `n.toLocaleString("es-AR")`
- Evitar imports de barrel; importar directo desde el archivo
