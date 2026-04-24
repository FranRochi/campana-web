# Campana Web

Frontend standalone en Next.js para la campana.

## Arranque

```bash
cd C:\Users\Francisco\Desktop\campaña-web
npm install
npm run dev -- --hostname 0.0.0.0 --port 3000
```

## Backend esperado

Por defecto consume:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

Eso ya esta configurado en `.env.local`.

## Estructura

- `src/`: app, componentes, tipos y utilidades.
- `public/`: assets publicos.
- `.env.local`: URL del backend.

## Flujo recomendado

1. Levantar backend y base desde `C:\Users\Francisco\Desktop\campaña`
2. Levantar frontend desde `C:\Users\Francisco\Desktop\campaña-web`

Con eso el front corre en modo desarrollo real y los cambios se ven al guardar, sin rebuild manual.
