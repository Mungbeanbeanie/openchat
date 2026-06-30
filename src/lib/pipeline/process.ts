import type { Action, CommentEvent, MessageEvent, NormalizedEvent } from "../domain";
import type { PipelineContext } from "./context";
import { perform } from "./execute";
import { matchAutomation } from "./match";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Entry point for a single normalized event. Dedupes first (Meta retries), then
 * dispatches to the comment or message handler. Returns the actions taken — used
 * by tests and the simulator to assert/print the flow.
 */
export async function handleEvent(
  event: NormalizedEvent,
  ctx: PipelineContext,
): Promise<Action[]> {
  const isNew = await ctx.repos.recordEventIfNew(event.eventId);
  if (!isNew) return [{ kind: "noop", reason: "duplicate event" }];

  return event.type === "comment"
    ? handleComment(event, ctx)
    : handleMessage(event, ctx);
}

/**
 * Comment-time: we cannot know follow status yet (no consent), so we always
 * open the conversation — optional public reply + the one allowed private reply.
 */
async function handleComment(event: CommentEvent, ctx: PipelineContext): Promise<Action[]> {
  const creator = await ctx.repos.getCreatorByIgUserId(event.creatorIgId);
  if (!creator) return [noop("unknown creator")];

  const automations = await ctx.repos.getActiveAutomations(creator.id, event.mediaId);
  const automation = matchAutomation(automations, event.text);
  if (!automation) return [noop("no keyword match")];

  const contact = await ctx.repos.upsertContact(creator.id, event.fromIgsid, event.fromUsername);

  const actions: Action[] = [];
  if (automation.publicReplyEnabled && automation.publicReplyText) {
    actions.push({
      kind: "public_reply",
      commentId: event.commentId,
      text: automation.publicReplyText,
    });
  }
  actions.push({ kind: "private_reply", commentId: event.commentId, text: automation.dmTemplate });

  await ctx.repos.createFlowState({
    creatorId: creator.id,
    contactId: contact.id,
    automationId: automation.id,
    commentId: event.commentId,
    state: "AWAITING_ENGAGEMENT",
    expiresAt: new Date(ctx.now().getTime() + SEVEN_DAYS_MS).toISOString(),
  });

  for (const action of actions) {
    await perform(action, ctx, creator, contact.id);
  }
  return actions;
}

/**
 * Message-time: the user has now consented, so we read the follower gate. The
 * link is delivered ONLY on a confirmed follow; non-followers are nudged up to
 * `nudgeMax` times, then the flow stops.
 */
async function handleMessage(event: MessageEvent, ctx: PipelineContext): Promise<Action[]> {
  if (event.isEcho) return [noop("echo (sent by us)")];

  const creator = await ctx.repos.getCreatorByIgUserId(event.creatorIgId);
  if (!creator) return [noop("unknown creator")];

  const contact = await ctx.repos.getContact(creator.id, event.fromIgsid);
  if (!contact) return [noop("no contact (organic DM)")];

  const flow = await ctx.repos.getActiveFlowStateForContact(creator.id, contact.id);
  if (!flow) return [noop("no active flow")];

  const automation = await ctx.repos.getAutomationById(flow.automationId);
  if (!automation) return [noop("automation missing")];

  // Consent point: read the follower gate. Never deliver without a confirmed follow,
  // so any read failure is treated as "not a follower".
  let follows = false;
  try {
    const profile = await ctx.meta.getUserProfile({
      igsid: event.fromIgsid,
      accessToken: creator.accessToken ?? "",
    });
    follows = profile.isUserFollowBusiness === true;
  } catch {
    follows = false;
  }
  await ctx.repos.setContactFollows(contact.id, follows);

  // Follower (or gate disabled) → deliver the link.
  if (follows || !automation.followGateEnabled) {
    const action: Action = {
      kind: "direct_message",
      igsid: event.fromIgsid,
      text: automation.linkPayload,
    };
    await ctx.repos.updateFlowState(flow.id, { state: "DELIVERED" });
    await perform(action, ctx, creator, contact.id);
    return [action];
  }

  // Non-follower: nudge to follow, then re-check on the next reply, up to the cap.
  if (flow.nudgeCount >= automation.nudgeMax) {
    await ctx.repos.updateFlowState(flow.id, { state: "STOPPED" });
    return [noop("nudge cap reached; no link for non-follower")];
  }

  const action: Action = {
    kind: "direct_message",
    igsid: event.fromIgsid,
    text: automation.nudgeTemplate,
  };
  await ctx.repos.updateFlowState(flow.id, {
    state: "AWAITING_FOLLOW",
    nudgeCount: flow.nudgeCount + 1,
  });
  await perform(action, ctx, creator, contact.id);
  return [action];
}

function noop(reason: string): Action {
  return { kind: "noop", reason };
}
