/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the ThePaddockView data API (used by the future httpSource).
   * Example: https://api.thepaddockview.com/v1
   * Leave unset to fall back to the same-origin "/api/v1".
   */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
