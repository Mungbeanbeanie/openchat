import type { Action, Creator } from "../domain.js";
import type { PipelineContext } from "./context.js";

/**
 * Perform a decided action against the Meta client and record it for audit.
 * This is the single place where actions turn into API calls.
 */
export async function perform(
  action: Action,
  ctx: PipelineContext,
  creator: Creator,
  contactId: string | null,
): Promise<void> {
  const accessToken = creator.accessToken ?? "";

  switch (action.kind) {
    case "public_reply":
      await ctx.meta.replyToComment({
        creatorIgId: creator.igUserId,
        commentId: action.commentId,
        text: action.text,
        accessToken,
      });
      await record(ctx, creator.id, contactId, action.kind, action.text, action.commentId);
      break;

    case "private_reply":
      await ctx.meta.sendPrivateReply({
        creatorIgId: creator.igUserId,
        commentId: action.commentId,
        text: action.text,
        accessToken,
      });
      await record(ctx, creator.id, contactId, action.kind, action.text, action.commentId);
      break;

    case "direct_message":
      await ctx.meta.sendDirectMessage({
        creatorIgId: creator.igUserId,
        igsid: action.igsid,
        text: action.text,
        accessToken,
      });
      await record(ctx, creator.id, contactId, action.kind, action.text, action.igsid);
      break;

    case "noop":
      break;
  }
}

function record(
  ctx: PipelineContext,
  creatorId: string,
  contactId: string | null,
  kind: Action["kind"],
  payload: string,
  targetId: string,
): Promise<void> {
  return ctx.repos.recordOutboundAction({ creatorId, contactId, kind, payload, targetId });
}
