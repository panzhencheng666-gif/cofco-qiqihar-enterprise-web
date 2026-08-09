/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_REALTIME_DATA_MODE?: "api" | "fixtures";
  readonly VITE_OVERVIEW_MAP_URL?: string;
  readonly VITE_OVERVIEW_MAP_HOST?: string;
  readonly VITE_OVERVIEW_MAP_PORT?: string;
  readonly VITE_LOGIN_URL?: string;
  readonly VITE_LOGOUT_URL?: string;
  readonly VITE_IDENTITY_MANAGEMENT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
