export type Intendente = {
  nombre: string;
  partido: string;
  frente: string;
  color: string;
  justificativo_fortaleza?: string | null;
};

export type FuerzaElectoral = {
  nombre: string;
  votos: number | null;
  porcentaje: string | null;
};

export type ResultadoElectoral = {
  anio: number;
  nivel: "municipal" | "provincial" | "nacional";
  cargo: string;
  padron: number | null;
  mesas: number | null;
  participacion_porcentaje: string | null;
  votos_positivos: number | null;
  votos_blanco: number | null;
  votos_totales: number | null;
  fuerzas: FuerzaElectoral[];
};

export type Municipio = {
  id: number;
  nombre: string;
  nombre_normalizado: string;
  seccion_electoral_numero: number | null;
  seccion_electoral_nombre: string;
  poblacion_2022: number | null;
  poblacion_2025: number | null;
  padron: number | null;
  intendente: Intendente | null;
  intendente_nombre?: string | null;
  partido?: string | null;
  frente?: string | null;
  color?: string | null;
};

export type MunicipioDetalle = Municipio & {
  resultados: ResultadoElectoral[];
};

export type MunicipioTablaFila = Municipio;

export type MunicipioEleccionFila = {
  id: number;
  nombre: string;
  nombre_normalizado: string;
  ultimo_resultado: ResultadoElectoral | null;
};

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type CampaignModule = {
  key: string;
  title: string;
  description: string;
  route: string;
};

export type Ponderacion = {
  variable: string;
  peso: number;
  disponible: boolean;
};

export type FiltroConfig = {
  key: string;
  titulo: string;
  texto: string;
  ponderaciones: Ponderacion[];
};

export type GeoJsonFeature = {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: {
    nam: string;
    nombre_normalizado: string;
    fill: string;
    municipio?: {
      nombre: string;
      intendente: string;
      partido: string;
      frente: string;
      color: string;
      seccion_electoral_numero: number | null;
      seccion_electoral_nombre: string;
      poblacion_2022: number | null;
      poblacion_2025: number | null;
      padron: number | null;
      // Fortaleza política del intendente
      porcentaje_2023?: number | null;
      control_concejo?: "mayoria" | "mitad" | "minoria" | null;
      electo?: boolean | null;
      interino?: boolean | null;
      reelecto?: boolean | null;
      cantidad_mandatos?: number | null;
      porcentaje_concejales_2025?: number | null;
      tendencia_2023_2025?: number | null;
      tendencia?: "creciente" | "estable" | "decreciente" | null;
      relevancia_provincial?: number | null;
      // Fortaleza provincial (% FP/UxP en elecciones provinciales)
      porcentaje_gobernador_2023?: number | null;
      porcentaje_provincial_2025?: number | null;
    } | null;
  };
};

export type PbaGeoJson = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};
