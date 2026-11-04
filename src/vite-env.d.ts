/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TARUVI_BASE_URL: string
  /** Optional: the SDK authenticates with the user's session token, not this key. */
  readonly VITE_TARUVI_API_KEY?: string
  readonly VITE_TARUVI_APP_SLUG: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
