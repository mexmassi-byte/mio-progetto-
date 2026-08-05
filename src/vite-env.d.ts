/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Data source: 'api' (real F1 data, default), 'mock', or 'http'. */
  readonly VITE_DATA_SOURCE?: 'api' | 'mock' | 'http'
  /** Override the Jolpica-F1 base URL (optional). */
  readonly VITE_JOLPICA_BASE_URL?: string
  /** Override the OpenF1 base URL (optional). */
  readonly VITE_OPENF1_BASE_URL?: string
  /**
   * Base URL of the ThePaddockView data API (used by the future httpSource).
   * Example: https://api.thepaddockview.com/v1
   * Leave unset to fall back to the same-origin "/api/v1".
   */
  readonly VITE_API_BASE_URL?: string
  /** 'hash' routes in the URL fragment, for hosts without SPA rewrites. */
  readonly VITE_ROUTER?: 'hash' | 'history'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
