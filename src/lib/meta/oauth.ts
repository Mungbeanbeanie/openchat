import { config } from "../config";

/**
 * Instagram Login OAuth (no Facebook Page required).
 * Flow: authorization code → short-lived token → long-lived (60-day) token → /me.
 * Fully written but only usable once META_APP_ID / META_APP_SECRET are set.
 */

export interface ConnectedAccount {
  igUserId: string;
  username: string;
  accessToken: string;
  /** Seconds until the long-lived token expires. */
  expiresIn: number;
}

function requireCreds(): { appId: string; appSecret: string; redirectUri: string } {
  const { appId, appSecret, oauthRedirectUri } = config.meta;
  if (!appId || !appSecret || !oauthRedirectUri) {
    throw new Error(
      "OAuth not configured (need META_APP_ID, META_APP_SECRET, META_OAUTH_REDIRECT_URI).",
    );
  }
  return { appId, appSecret, redirectUri: oauthRedirectUri };
}

/** Exchange an authorization code for a short-lived token + user id. */
async function exchangeCode(code: string): Promise<{ accessToken: string; userId: string }> {
  const { appId, appSecret, redirectUri } = requireCreds();
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body,
  });
  const json = (await res.json()) as { access_token?: string; user_id?: string | number; error_message?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Code exchange failed: ${json.error_message ?? res.status}`);
  }
  return { accessToken: json.access_token, userId: String(json.user_id) };
}

/** Upgrade a short-lived token to a long-lived (≈60 day) token. */
async function getLongLivedToken(
  shortToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const { appSecret } = requireCreds();
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortToken);
  const res = await fetch(url);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) {
    throw new Error(`Long-lived token exchange failed: ${res.status}`);
  }
  return { accessToken: json.access_token, expiresIn: json.expires_in ?? 0 };
}

async function getMe(token: string): Promise<{ id: string; username: string }> {
  const url = new URL(`${config.meta.graphBaseUrl}/me`);
  url.searchParams.set("fields", "user_id,username");
  url.searchParams.set("access_token", token);
  const res = await fetch(url);
  const json = (await res.json()) as { user_id?: string; id?: string; username?: string };
  if (!res.ok) throw new Error(`/me failed: ${res.status}`);
  return { id: String(json.user_id ?? json.id ?? ""), username: json.username ?? "" };
}

/** Full OAuth callback handling: code → connected account ready to persist. */
export async function connectAccount(code: string): Promise<ConnectedAccount> {
  const short = await exchangeCode(code);
  const long = await getLongLivedToken(short.accessToken);
  const me = await getMe(long.accessToken);
  return {
    igUserId: me.id || short.userId,
    username: me.username,
    accessToken: long.accessToken,
    expiresIn: long.expiresIn,
  };
}
