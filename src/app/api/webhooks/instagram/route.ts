import { after, type NextRequest } from "next/server";
import { config, hasLiveMetaCredentials, hasSupabase } from "@/lib/config";
import { verifySignature } from "@/lib/meta/signature";
import type { IgWebhookBody } from "@/lib/meta/types";
import { parseWebhook } from "@/lib/pipeline/parse";
import { handleEvent } from "@/lib/pipeline/process";
import { createRuntimeContext } from "@/lib/runtime";

export const runtime = "nodejs"; // crypto + Supabase need the Node runtime
export const dynamic = "force-dynamic";

/**
 * Webhook verification handshake. Meta calls this with hub.* query params when
 * you register the callback URL.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token && token === config.meta.verifyToken) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Event delivery. We verify the signature, dedupe, ACK with 200 immediately,
 * then process the events after the response via `after()`.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const raw = await req.text();

  // Verify the payload signature when an app secret is configured.
  if (hasLiveMetaCredentials()) {
    const sig = req.headers.get("x-hub-signature-256");
    if (!verifySignature(raw, sig, config.meta.appSecret!)) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let body: IgWebhookBody;
  try {
    body = JSON.parse(raw) as IgWebhookBody;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const events = parseWebhook(body);

  // ACK fast; do the work after the response is sent. Requires Supabase to persist
  // flow state — without it we can only acknowledge.
  if (events.length > 0 && hasSupabase()) {
    after(async () => {
      const ctx = createRuntimeContext();
      for (const event of events) {
        try {
          await handleEvent(event, ctx);
        } catch (err) {
          console.error("[webhook] failed to process event", event.eventId, err);
        }
      }
    });
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
