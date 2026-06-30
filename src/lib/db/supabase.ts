import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";
import type { Automation, Contact, Creator, FlowState } from "../domain";
import type {
  FlowStatePatch,
  NewFlowState,
  OutboundActionRecord,
  Repositories,
} from "./repositories";

const ACTIVE_STATES = ["AWAITING_ENGAGEMENT", "AWAITING_FOLLOW"];

export function createSupabaseClient(): SupabaseClient {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// --- row <-> domain mappers ---

/* eslint-disable @typescript-eslint/no-explicit-any */
const toCreator = (r: any): Creator => ({
  id: r.id,
  igUserId: r.ig_user_id,
  igUsername: r.ig_username,
  accessToken: r.access_token,
  tokenExpiresAt: r.token_expires_at,
});

const toAutomation = (r: any): Automation => ({
  id: r.id,
  creatorId: r.creator_id,
  mediaId: r.media_id,
  keywords: r.keywords ?? [],
  matchType: r.match_type,
  dmTemplate: r.dm_template,
  linkPayload: r.link_payload,
  publicReplyEnabled: r.public_reply_enabled,
  publicReplyText: r.public_reply_text,
  followGateEnabled: r.follow_gate_enabled,
  nudgeTemplate: r.nudge_template,
  nudgeMax: r.nudge_max,
  active: r.active,
});

const toContact = (r: any): Contact => ({
  id: r.id,
  creatorId: r.creator_id,
  igsid: r.igsid,
  username: r.username,
  follows: r.follows,
  firstSeen: r.first_seen,
});

const toFlowState = (r: any): FlowState => ({
  id: r.id,
  creatorId: r.creator_id,
  contactId: r.contact_id,
  automationId: r.automation_id,
  commentId: r.comment_id,
  state: r.state,
  nudgeCount: r.nudge_count,
  expiresAt: r.expires_at,
  updatedAt: r.updated_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export class SupabaseRepositories implements Repositories {
  constructor(private readonly db: SupabaseClient = createSupabaseClient()) {}

  async recordEventIfNew(eventId: string): Promise<boolean> {
    const { error } = await this.db.from("inbound_events").insert({ event_id: eventId });
    if (!error) return true;
    // 23505 = unique_violation → we've already processed this event.
    if (error.code === "23505") return false;
    throw error;
  }

  async getCreatorByIgUserId(igUserId: string): Promise<Creator | null> {
    const { data, error } = await this.db
      .from("creators")
      .select("*")
      .eq("ig_user_id", igUserId)
      .maybeSingle();
    if (error) throw error;
    return data ? toCreator(data) : null;
  }

  async getActiveAutomations(creatorId: string, mediaId: string): Promise<Automation[]> {
    const { data, error } = await this.db
      .from("automations")
      .select("*")
      .eq("creator_id", creatorId)
      .eq("active", true)
      .or(`media_id.is.null,media_id.eq.${mediaId}`);
    if (error) throw error;
    return (data ?? []).map(toAutomation);
  }

  async getAutomationById(id: string): Promise<Automation | null> {
    const { data, error } = await this.db
      .from("automations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toAutomation(data) : null;
  }

  async upsertContact(
    creatorId: string,
    igsid: string,
    username: string | null,
  ): Promise<Contact> {
    const { data, error } = await this.db
      .from("contacts")
      .upsert(
        { creator_id: creatorId, igsid, username },
        { onConflict: "creator_id,igsid" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return toContact(data);
  }

  async getContact(creatorId: string, igsid: string): Promise<Contact | null> {
    const { data, error } = await this.db
      .from("contacts")
      .select("*")
      .eq("creator_id", creatorId)
      .eq("igsid", igsid)
      .maybeSingle();
    if (error) throw error;
    return data ? toContact(data) : null;
  }

  async setContactFollows(contactId: string, follows: boolean): Promise<void> {
    const { error } = await this.db.from("contacts").update({ follows }).eq("id", contactId);
    if (error) throw error;
  }

  async createFlowState(input: NewFlowState): Promise<FlowState> {
    const { data, error } = await this.db
      .from("flow_state")
      .insert({
        creator_id: input.creatorId,
        contact_id: input.contactId,
        automation_id: input.automationId,
        comment_id: input.commentId,
        state: input.state,
        expires_at: input.expiresAt,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toFlowState(data);
  }

  async getActiveFlowStateForContact(
    creatorId: string,
    contactId: string,
  ): Promise<FlowState | null> {
    const { data, error } = await this.db
      .from("flow_state")
      .select("*")
      .eq("creator_id", creatorId)
      .eq("contact_id", contactId)
      .in("state", ACTIVE_STATES)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toFlowState(data) : null;
  }

  async updateFlowState(id: string, patch: FlowStatePatch): Promise<void> {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.state !== undefined) update.state = patch.state;
    if (patch.nudgeCount !== undefined) update.nudge_count = patch.nudgeCount;
    const { error } = await this.db.from("flow_state").update(update).eq("id", id);
    if (error) throw error;
  }

  async recordOutboundAction(action: OutboundActionRecord): Promise<void> {
    const { error } = await this.db.from("outbound_actions").insert({
      creator_id: action.creatorId,
      contact_id: action.contactId,
      kind: action.kind,
      payload: action.payload,
      target_id: action.targetId,
    });
    if (error) throw error;
  }
}
