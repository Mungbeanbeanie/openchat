/**
 * Environment-driven configuration.
 *
 * Every Meta/Supabase secret is OPTIONAL so the pipeline, tests, and simulator
 * run with zero credentials. `hasLiveMetaCredentials()` / `hasSupabase()` gate
 * whether the live adapters can be used.
 */

export interface AppConfig {
  meta: {
    appId?: string;
    appSecret?: string;
    /** Token we echo back during the webhook verification handshake. */
    verifyToken?: string;
    /** Graph API version, e.g. "v23.0". Override via META_GRAPH_VERSION. */
    graphApiVersion: string;
    graphBaseUrl: string;
    /** OAuth redirect registered in the Meta app. */
    oauthRedirectUri?: string;
  };
  supabase: {
    url?: string;
    serviceRoleKey?: string;
  };
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

const graphApiVersion = env("META_GRAPH_VERSION") ?? "v23.0";

export const config: AppConfig = {
  meta: {
    appId: env("META_APP_ID"),
    appSecret: env("META_APP_SECRET"),
    verifyToken: env("META_VERIFY_TOKEN"),
    graphApiVersion,
    graphBaseUrl: `https://graph.instagram.com/${graphApiVersion}`,
    oauthRedirectUri: env("META_OAUTH_REDIRECT_URI"),
  },
  supabase: {
    url: env("SUPABASE_URL"),
    serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  },
};

/** True when we can talk to the real Instagram Graph API. */
export function hasLiveMetaCredentials(cfg: AppConfig = config): boolean {
  return Boolean(cfg.meta.appSecret);
}

/** True when a real Supabase project is configured. */
export function hasSupabase(cfg: AppConfig = config): boolean {
  return Boolean(cfg.supabase.url && cfg.supabase.serviceRoleKey);
}
