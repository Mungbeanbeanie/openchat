/**
 * Core domain types shared across the pipeline, repositories, and Meta client.
 *
 * These are storage-agnostic and provider-agnostic on purpose: the same shapes
 * flow through the in-memory repos (tests/simulator) and the Supabase repos
 * (production), and through both the MockMetaClient and the LiveMetaClient.
 */

export type Uuid = string;

/** An Instagram professional account connected by a creator. */
export interface Creator {
  id: Uuid;
  /** The creator's Instagram professional account id (the "business"). */
  igUserId: string;
  igUsername: string;
  /** Long-lived access token. Null until OAuth is completed. */
  accessToken: string | null;
  /** ISO timestamp when the token expires. */
  tokenExpiresAt: string | null;
}

export type MatchType = "exact" | "contains";

/** A comment-to-DM rule for a creator. */
export interface Automation {
  id: Uuid;
  creatorId: Uuid;
  /** Specific post this rule applies to. Null = applies to all of the creator's posts. */
  mediaId: string | null;
  /** Trigger keywords (compared case-insensitively). */
  keywords: string[];
  matchType: MatchType;
  /** Opening private-reply DM sent at comment-time (the CTA to engage). */
  dmTemplate: string;
  /** The link/asset delivered to confirmed followers. */
  linkPayload: string;
  /** Whether to also post a public reply on the comment. */
  publicReplyEnabled: boolean;
  publicReplyText: string | null;
  /** When true, the link is only delivered to confirmed followers. */
  followGateEnabled: boolean;
  /** Message asking a non-follower to follow and reply again. */
  nudgeTemplate: string;
  /** Max number of follow re-checks before the flow stops. */
  nudgeMax: number;
  active: boolean;
}

/** A person who interacted with one of the creator's posts. */
export interface Contact {
  id: Uuid;
  creatorId: Uuid;
  /** Instagram-scoped id of the commenter / messager. */
  igsid: string;
  username: string | null;
  /** Whether they follow the creator. Null until known (only readable post-consent). */
  follows: boolean | null;
  /** ISO timestamp. */
  firstSeen: string;
}

export type FlowStateName =
  | "AWAITING_ENGAGEMENT" // private reply sent; waiting for the user to message back (consent)
  | "AWAITING_FOLLOW" // confirmed non-follower; nudged to follow
  | "DELIVERED" // link sent to a confirmed follower
  | "STOPPED"; // gave up (nudge cap hit, or window expired)

/** The per-(contact, automation) conversation state machine. */
export interface FlowState {
  id: Uuid;
  creatorId: Uuid;
  contactId: Uuid;
  automationId: Uuid;
  /** The originating comment id (the private-reply recipient). */
  commentId: string;
  state: FlowStateName;
  /** How many follow nudges we've sent so far. */
  nudgeCount: number;
  /** ISO timestamp: the 7-day private-reply window deadline. */
  expiresAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Normalized webhook events (output of the parser, input to the pipeline)
// ---------------------------------------------------------------------------

export interface CommentEvent {
  type: "comment";
  /** The recipient creator's IG professional account id (webhook entry id). */
  creatorIgId: string;
  commentId: string;
  mediaId: string;
  /** Instagram-scoped id of the commenter. */
  fromIgsid: string;
  fromUsername: string | null;
  text: string;
  /** Stable id used for idempotent dedupe of Meta's webhook retries. */
  eventId: string;
  timestamp: number;
}

export interface MessageEvent {
  type: "message";
  creatorIgId: string;
  /** Instagram-scoped id of the message sender. */
  fromIgsid: string;
  text: string | null;
  /** True when the message was sent by the business itself (skip these). */
  isEcho: boolean;
  eventId: string;
  timestamp: number;
}

export type NormalizedEvent = CommentEvent | MessageEvent;

// ---------------------------------------------------------------------------
// Actions (output of the pipeline brain, input to the executor)
// ---------------------------------------------------------------------------

export type Action =
  | { kind: "public_reply"; commentId: string; text: string }
  | { kind: "private_reply"; commentId: string; text: string }
  | { kind: "direct_message"; igsid: string; text: string }
  | { kind: "noop"; reason: string };
