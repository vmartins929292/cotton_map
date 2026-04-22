// Tipos compartilhados entre os route handlers de /api/places e os
// client components que consomem esses endpoints.

export type PlaceSuggestion = {
  placeId: string;
  primary: string;
  secondary: string;
  full: string;
};

export type PlaceDetails = {
  placeId: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  displayName: string;
  /** Componentes estruturados extraidos de addressComponents (best-effort). */
  street: string;
  number: string;
  neighborhood: string;
  cep: string;
  city: string;
  /** UF de 2 letras (ex.: "MT", "BA"). */
  state: string;
};
