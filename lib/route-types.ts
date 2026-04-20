// Tipos client-safe relacionados a rotas (sem dependencia server-only).
// Serve para componentes que precisam tipar dados retornados pelas
// server actions sem importar o modulo server.

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  maneuver?: string;
};
