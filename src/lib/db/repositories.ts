import type {
  Action,
  Automation,
  Contact,
  Creator,
  FlowState,
  FlowStateName,
} from "../domain";

export interface NewFlowState {
  creatorId: string;
  contactId: string;
  automationId: string;
  commentId: string;
  state: FlowStateName;
  expiresAt: string;
}

export interface FlowStatePatch {
  state?: FlowStateName;
  nudgeCount?: number;
}

export interface OutboundActionRecord {
  creatorId: string;
  contactId: string | null;
  kind: Action["kind"];
  /** Message text or delivered link. */
  payload: string;
  /** The comment id or IGSID the action targeted. */
  targetId: string;
}

/**
 * Storage-agnostic data access used by the pipeline. The in-memory impl powers
 * tests and the simulator; the Supabase impl powers production. Swapping them is
 * the only change needed to move from local to deployed.
 */
export interface Repositories {
  /** Returns true if this event id is new (and records it); false if a duplicate. */
  recordEventIfNew(eventId: string): Promise<boolean>;

  getCreatorByIgUserId(igUserId: string): Promise<Creator | null>;

  /** Active automations for a creator whose mediaId is null (all posts) or matches. */
  getActiveAutomations(creatorId: string, mediaId: string): Promise<Automation[]>;
  getAutomationById(id: string): Promise<Automation | null>;

  upsertContact(creatorId: string, igsid: string, username: string | null): Promise<Contact>;
  getContact(creatorId: string, igsid: string): Promise<Contact | null>;
  setContactFollows(contactId: string, follows: boolean): Promise<void>;

  createFlowState(input: NewFlowState): Promise<FlowState>;
  /** Latest non-terminal flow state (AWAITING_ENGAGEMENT | AWAITING_FOLLOW) for a contact. */
  getActiveFlowStateForContact(creatorId: string, contactId: string): Promise<FlowState | null>;
  updateFlowState(id: string, patch: FlowStatePatch): Promise<void>;

  recordOutboundAction(action: OutboundActionRecord): Promise<void>;
}
