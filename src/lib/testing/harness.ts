import { randomUUID } from "node:crypto";
import type { Action, Automation, Creator } from "../domain";
import { InMemoryRepositories } from "../db/memory";
import { MockMetaClient } from "../meta/mockClient";
import type { IgWebhookBody } from "../meta/types";
import { makeContext, type PipelineContext } from "../pipeline/context";
import { parseWebhook } from "../pipeline/parse";
import { handleEvent } from "../pipeline/process";

/**
 * A seeded, fully in-memory environment for tests and the simulator: one creator,
 * one automation, mock Meta client, and a `deliver()` that runs a raw webhook body
 * through the exact production path (parseWebhook → handleEvent).
 */

export const CREATOR_IG_ID = "17841400000000000";

export interface Harness {
  repos: InMemoryRepositories;
  meta: MockMetaClient;
  ctx: PipelineContext;
  creator: Creator;
  automation: Automation;
  /** Run a raw webhook body through parse + process; returns the actions taken. */
  deliver(body: IgWebhookBody): Promise<Action[]>;
}

export function buildHarness(automationOverrides?: Partial<Automation>): Harness {
  const repos = new InMemoryRepositories();
  const meta = new MockMetaClient();
  const ctx = makeContext(repos, meta);

  const creator: Creator = {
    id: randomUUID(),
    igUserId: CREATOR_IG_ID,
    igUsername: "demo_creator",
    accessToken: "mock-token",
    tokenExpiresAt: null,
  };
  repos.addCreator(creator);

  const automation: Automation = {
    id: randomUUID(),
    creatorId: creator.id,
    mediaId: null,
    keywords: ["link", "guide"],
    matchType: "contains",
    dmTemplate: "Hey! 👋 Tap below and I'll send over the guide.",
    linkPayload: "Here you go 🎁 https://example.com/the-guide",
    publicReplyEnabled: true,
    publicReplyText: "Just sent you a DM! 💌 Make sure you're following 👀",
    followGateEnabled: true,
    nudgeTemplate: "Almost there! Follow me first, then reply \"done\" to unlock 🔓",
    nudgeMax: 2,
    active: true,
    ...automationOverrides,
  };
  repos.addAutomation(automation);

  async function deliver(body: IgWebhookBody): Promise<Action[]> {
    const events = parseWebhook(body);
    const actions: Action[] = [];
    for (const event of events) {
      actions.push(...(await handleEvent(event, ctx)));
    }
    return actions;
  }

  return { repos, meta, ctx, creator, automation, deliver };
}

// --- raw webhook payload builders (mirror Meta's shapes) ---

export function commentWebhook(args: {
  fromIgsid: string;
  text: string;
  commentId?: string;
  username?: string;
  mediaId?: string;
}): IgWebhookBody {
  return {
    object: "instagram",
    entry: [
      {
        id: CREATOR_IG_ID,
        time: Date.now(),
        changes: [
          {
            field: "comments",
            value: {
              id: args.commentId ?? `comment_${randomUUID()}`,
              text: args.text,
              media: { id: args.mediaId ?? "media_1" },
              from: { id: args.fromIgsid, username: args.username ?? "someone" },
            },
          },
        ],
      },
    ],
  };
}

export function messageWebhook(args: {
  fromIgsid: string;
  text: string;
  mid?: string;
  isEcho?: boolean;
}): IgWebhookBody {
  const ts = Date.now();
  return {
    object: "instagram",
    entry: [
      {
        id: CREATOR_IG_ID,
        time: ts,
        messaging: [
          {
            sender: { id: args.fromIgsid },
            recipient: { id: CREATOR_IG_ID },
            timestamp: ts,
            message: {
              mid: args.mid ?? `mid_${randomUUID()}`,
              text: args.text,
              is_echo: args.isEcho ?? false,
            },
          },
        ],
      },
    ],
  };
}
