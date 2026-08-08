/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ACTOR?: string;
  readonly VITE_REALTIME_DATA_MODE?: "api" | "demo";
  readonly VITE_OVERVIEW_MAP_URL?: string;
  readonly VITE_OVERVIEW_MAP_HOST?: string;
  readonly VITE_OVERVIEW_MAP_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
