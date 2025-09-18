/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SPORTRADAR_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}