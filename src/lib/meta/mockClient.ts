import type {
  GetUserProfileArgs,
  MetaClient,
  ReplyToCommentArgs,
  SendDirectMessageArgs,
  SendPrivateReplyArgs,
  UserProfile,
} from "./client.js";

export type MockCall =
  | { kind: "private_reply"; commentId: string; text: string }
  | { kind: "direct_message"; igsid: string; text: string }
  | { kind: "public_reply"; commentId: string; text: string }
  | { kind: "get_profile"; igsid: string };

/**
 * In-memory MetaClient for tests and the local simulator.
 *
 * - Records every call in `calls` so flows can be asserted.
 * - `getUserProfile` returns scripted profiles set via `setFollows` / `setProfile`.
 *   Default follow status is `false` (treat unknown users as non-followers), and
 *   you can flip it mid-flow to simulate someone following and replying again.
 */
export class MockMetaClient implements MetaClient {
  public calls: MockCall[] = [];
  private profiles = new Map<string, UserProfile>();

  /** Set whether a given user follows the creator. */
  setFollows(igsid: string, follows: boolean): void {
    const existing = this.profiles.get(igsid) ?? { id: igsid };
    this.profiles.set(igsid, { ...existing, isUserFollowBusiness: follows });
  }

  setProfile(igsid: string, profile: Partial<UserProfile>): void {
    const existing = this.profiles.get(igsid) ?? { id: igsid };
    this.profiles.set(igsid, { ...existing, ...profile, id: igsid });
  }

  /** Convenience: every recorded call of a given kind. */
  callsOf<K extends MockCall["kind"]>(kind: K): Extract<MockCall, { kind: K }>[] {
    return this.calls.filter((c): c is Extract<MockCall, { kind: K }> => c.kind === kind);
  }

  reset(): void {
    this.calls = [];
  }

  async sendPrivateReply(args: SendPrivateReplyArgs): Promise<void> {
    this.calls.push({ kind: "private_reply", commentId: args.commentId, text: args.text });
  }

  async sendDirectMessage(args: SendDirectMessageArgs): Promise<void> {
    this.calls.push({ kind: "direct_message", igsid: args.igsid, text: args.text });
  }

  async replyToComment(args: ReplyToCommentArgs): Promise<void> {
    this.calls.push({ kind: "public_reply", commentId: args.commentId, text: args.text });
  }

  async getUserProfile(args: GetUserProfileArgs): Promise<UserProfile> {
    this.calls.push({ kind: "get_profile", igsid: args.igsid });
    const profile = this.profiles.get(args.igsid);
    return profile ?? { id: args.igsid, isUserFollowBusiness: false };
  }
}
