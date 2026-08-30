/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type KVNamespace = import("@cloudflare/workers-types").KVNamespace;

interface Env {
  /** Shared cache for the live board. Not a session store, despite the history. */
  LIVE_CACHE: KVNamespace;
  /** LiveTennisAPI key. A secret in Cloudflare, .dev.vars locally. Never in git. */
  LIVETENNIS_API_KEY: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;
