export type CompanyType = "fiacao" | "integrada" | "denim" | "malharia" | "comercial";

export type Region = "NE" | "SE" | "S" | "CO";

export type CompanyStatus = "frio" | "morno" | "quente" | "cliente" | "descartado";

export type CompanyPriority = "alta" | "media" | "baixa";

export type InteractionKind =
  | "nota"
  | "ligacao"
  | "email"
  | "whatsapp"
  | "reuniao"
  | "visita"
  | "proposta"
  | "amostra";

export interface CompanyContact {
  id: string;
  companyId: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  linkedin: string;
  notes: string;
  isPrimary: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyNote {
  id: string;
  companyId: string;
  contactId: string | null;
  kind: InteractionKind;
  body: string;
  happenedAt: string;
  nextFollowupAt: string | null;
  author: string;
  createdAt?: string;
  updatedAt?: string;
}

export const STATUS_LABELS: Record<CompanyStatus, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
  cliente: "Cliente",
  descartado: "Descartado",
};

export const STATUS_COLORS: Record<CompanyStatus, string> = {
  frio: "#6b7280",
  morno: "#d97706",
  quente: "#c1322f",
  cliente: "#2d7a3e",
  descartado: "#9ca3af",
};

export const PRIORITY_LABELS: Record<CompanyPriority, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const PRIORITY_COLORS: Record<CompanyPriority, string> = {
  alta: "#c1322f",
  media: "#d97706",
  baixa: "#6b7280",
};

export const KIND_LABELS: Record<InteractionKind, string> = {
  nota: "Nota",
  ligacao: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  reuniao: "Reunião",
  visita: "Visita técnica",
  proposta: "Proposta",
  amostra: "Amostra/PI",
};

export const KIND_ICONS: Record<InteractionKind, string> = {
  nota: "📝",
  ligacao: "📞",
  email: "✉️",
  whatsapp: "💬",
  reuniao: "🤝",
  visita: "🏭",
  proposta: "📄",
  amostra: "📦",
};

export interface Origin {
  /** UUID do banco; para os defaults ainda em codigo, usamos a propria key. */
  id: string;
  /** Slug estavel (ex.: "sapezal"). Default origins tem keys conhecidas. */
  key: string;
  name: string;
  short: string;
  color: string;
  address: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface Company {
  id: string;
  name: string;
  group: string;
  city: string;
  state: string;
  region: Region;
  lat: number;
  lng: number;
  type: CompanyType;
  desc: string;
  products: string;
  capacity: string;
  bci: boolean;
  site: string;
  contact: string;
  email: string;
  address: string;
  /**
   * Distancias REAIS por origem, indexadas pelo Origin.id (ou key, no fallback estatico).
   * Calculadas e gravadas no momento do cadastro/edicao da empresa.
   * Quando vazio (raro), o card cai no fallback Haversine como aviso visual ("~").
   */
  distancesByOrigin: Record<string, number>;
  /**
   * Duracoes (min, sem transito) por origem. Mesma chave de distancesByOrigin.
   */
  durationsByOrigin?: Record<string, number>;
  status?: CompanyStatus;
  priority?: CompanyPriority;
  lastContactAt?: string | null;
}

export const TYPE_LABELS: Record<CompanyType, string> = {
  fiacao: "Fiação Pura",
  integrada: "Integrada",
  denim: "Denim/Índigo",
  malharia: "Malharia/Confecção",
  comercial: "Comercial / Trading",
};

export const TYPE_COLORS: Record<CompanyType, string> = {
  fiacao: "#1e6091",
  integrada: "#c13299",
  denim: "#b86a1e",
  malharia: "#2d7a3e",
  comercial: "#6b7280",
};

export const REGION_LABELS: Record<Region, string> = {
  NE: "Nordeste",
  SE: "Sudeste",
  S: "Sul",
  CO: "Centro-Oeste",
};

/**
 * Origens default usadas quando o Supabase nao esta configurado, ou como fallback inicial
 * para que o site continue navegavel mesmo antes da migracao do schema.sql.
 * Quando o Supabase esta ativo, [lib/origins.ts] sobrescreve essa lista com a do banco.
 *
 * IMPORTANTE: o "id" aqui usa a propria key (string fixa) porque ainda nao temos UUID.
 * O lib do servidor faz o mapeamento key->id ao carregar do banco.
 */
export const DEFAULT_ORIGINS: Origin[] = [
  {
    id: "sapezal",
    key: "sapezal",
    name: "SAPEZAL",
    short: "Sapezal",
    color: "#d97706",
    address: "Sapezal — MT",
    lat: -13.55,
    lng: -58.765,
    isDefault: true,
    sortOrder: 10,
  },
  {
    id: "sorriso",
    key: "sorriso",
    name: "SORRISO",
    short: "Sorriso",
    color: "#059669",
    address: "Sorriso — MT",
    lat: -12.5432,
    lng: -55.7218,
    isDefault: true,
    sortOrder: 20,
  },
  {
    id: "lem",
    key: "lem",
    name: "LUÍS EDUARDO MAGALHÃES",
    short: "Luís Eduardo Magalhães",
    color: "#7c3aed",
    address: "Luís Eduardo Magalhães — BA",
    lat: -12.0964,
    lng: -45.7897,
    isDefault: true,
    sortOrder: 30,
  },
];

export const STATE_NAMES: Record<string, string> = {
  PB: "Paraíba",
  BA: "Bahia",
  PR: "Paraná",
  SC: "Santa Catarina",
  CE: "Ceará",
  SP: "São Paulo",
  MG: "Minas Gerais",
  PE: "Pernambuco",
  MT: "Mato Grosso",
  RN: "Rio Grande do Norte",
  GO: "Goiás",
  SE: "Sergipe",
  RS: "Rio Grande do Sul",
  AL: "Alagoas",
};
