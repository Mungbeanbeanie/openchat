import { randomUUID } from "node:crypto";
import type { Automation, Contact, Creator, FlowState } from "../domain.js";
import type {
  FlowStatePatch,
  NewFlowState,
  OutboundActionRecord,
  Repositories,
} from "./repositories.js";

const ACTIVE_STATES = new Set(["AWAITING_ENGAGEMENT", "AWAITING_FOLLOW"]);

/**
 * In-memory Repositories for tests and the simulator. Seed it with creators and
 * automations, then run the pipeline against it — no database required.
 */
export class InMemoryRepositories implements Repositories {
  private creators = new Map<string, Creator>();
  private automations = new Map<string, Automation>();
  private contacts = new Map<string, Contact>();
  private flowStates = new Map<string, FlowState>();
  private seenEvents = new Set<string>();

  public outbound: OutboundActionRecord[] = [];

  // --- seeding helpers (test/simulator only) ---

  addCreator(creator: Creator): void {
    this.creators.set(creator.id, creator);
  }

  addAutomation(automation: Automation): void {
    this.automations.set(automation.id, automation);
  }

  // --- Repositories impl ---

  async recordEventIfNew(eventId: string): Promise<boolean> {
    if (this.seenEvents.has(eventId)) return false;
    this.seenEvents.add(eventId);
    return true;
  }

  async getCreatorByIgUserId(igUserId: string): Promise<Creator | null> {
    for (const c of this.creators.values()) {
      if (c.igUserId === igUserId) return c;
    }
    return null;
  }

  async getActiveAutomations(creatorId: string, mediaId: string): Promise<Automation[]> {
    return [...this.automations.values()].filter(
      (a) =>
        a.creatorId === creatorId &&
        a.active &&
        (a.mediaId === null || a.mediaId === mediaId),
    );
  }

  async getAutomationById(id: string): Promise<Automation | null> {
    return this.automations.get(id) ?? null;
  }

  async upsertContact(
    creatorId: string,
    igsid: string,
    username: string | null,
  ): Promise<Contact> {
    const existing = await this.getContact(creatorId, igsid);
    if (existing) {
      if (username && existing.username !== username) {
        existing.username = username;
      }
      return existing;
    }
    const contact: Contact = {
      id: randomUUID(),
      creatorId,
      igsid,
      username,
      follows: null,
      firstSeen: new Date().toISOString(),
    };
    this.contacts.set(contact.id, contact);
    return contact;
  }

  async getContact(creatorId: string, igsid: string): Promise<Contact | null> {
    for (const c of this.contacts.values()) {
      if (c.creatorId === creatorId && c.igsid === igsid) return c;
    }
    return null;
  }

  async setContactFollows(contactId: string, follows: boolean): Promise<void> {
    const contact = this.contacts.get(contactId);
    if (contact) contact.follows = follows;
  }

  async createFlowState(input: NewFlowState): Promise<FlowState> {
    const flow: FlowState = {
      id: randomUUID(),
      ...input,
      nudgeCount: 0,
      updatedAt: new Date().toISOString(),
    };
    this.flowStates.set(flow.id, flow);
    return flow;
  }

  async getActiveFlowStateForContact(
    creatorId: string,
    contactId: string,
  ): Promise<FlowState | null> {
    const candidates = [...this.flowStates.values()]
      .filter(
        (f) =>
          f.creatorId === creatorId &&
          f.contactId === contactId &&
          ACTIVE_STATES.has(f.state),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return candidates[0] ?? null;
  }

  async updateFlowState(id: string, patch: FlowStatePatch): Promise<void> {
    const flow = this.flowStates.get(id);
    if (!flow) return;
    if (patch.state !== undefined) flow.state = patch.state;
    if (patch.nudgeCount !== undefined) flow.nudgeCount = patch.nudgeCount;
    flow.updatedAt = new Date().toISOString();
  }

  async recordOutboundAction(action: OutboundActionRecord): Promise<void> {
    this.outbound.push(action);
  }
}
