import { type NextRequest } from "next/server";
import { hasLiveMetaCredentials, hasSupabase } from "@/lib/config";
import { createSupabaseClient } from "@/lib/db/supabase";
import { connectAccount } from "@/lib/meta/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth redirect target. Instagram sends `?code=...` here after a creator
 * authorizes the app. We exchange it for a long-lived token and store the creator.
 * Stubbed-friendly: returns a clear message until credentials are configured.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const params = req.nextUrl.searchParams;
  const error = params.get("error_description") ?? params.get("error");
  if (error) return text(`Authorization failed: ${error}`, 400);

  const code = params.get("code");
  if (!code) return text("Missing ?code", 400);

  if (!hasLiveMetaCredentials()) {
    return text(
      "OAuth received a code, but META_APP_ID / META_APP_SECRET are not configured yet.",
      200,
    );
  }

  try {
    const account = await connectAccount(code);

    if (hasSupabase()) {
      const db = createSupabaseClient();
      const expiresAt =
        account.expiresIn > 0
          ? new Date(Date.now() + account.expiresIn * 1000).toISOString()
          : null;
      const { error: dbError } = await db.from("creators").upsert(
        {
          ig_user_id: account.igUserId,
          ig_username: account.username,
          access_token: account.accessToken,
          token_expires_at: expiresAt,
        },
        { onConflict: "ig_user_id" },
      );
      if (dbError) throw dbError;
    }

    return text(`Connected @${account.username} (IG id ${account.igUserId}). You can close this tab.`, 200);
  } catch (err) {
    console.error("[oauth] callback failed", err);
    return text(`Connection failed: ${(err as Error).message}`, 500);
  }
}

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
}
