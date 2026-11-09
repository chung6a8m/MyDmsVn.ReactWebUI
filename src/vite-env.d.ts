/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MYDMSVN_WEB6_CANDIDATE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
