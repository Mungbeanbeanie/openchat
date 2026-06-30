import { config } from "../config.js";
import {
  DEFAULT_PROFILE_FIELDS,
  type GetUserProfileArgs,
  type MetaClient,
  type ReplyToCommentArgs,
  type SendDirectMessageArgs,
  type SendPrivateReplyArgs,
  type UserProfile,
} from "./client.js";
import type { IgUserProfileResponse } from "./types.js";

/**
 * Real Instagram Graph API client (Instagram API with Instagram Login).
 * Base: https://graph.instagram.com/{version}
 *
 * This is fully written but only exercised once META_* env vars are set. The
 * pipeline swaps from MockMetaClient to this by changing one wiring line.
 */
export class LiveMetaClient implements MetaClient {
  constructor(private readonly baseUrl: string = config.meta.graphBaseUrl) {}

  async sendPrivateReply(args: SendPrivateReplyArgs): Promise<void> {
    // Private reply: target the COMMENT, not the user id.
    await this.post(`/${args.creatorIgId}/messages`, args.accessToken, {
      recipient: { comment_id: args.commentId },
      message: { text: args.text },
    });
  }

  async sendDirectMessage(args: SendDirectMessageArgs): Promise<void> {
    await this.post(`/${args.creatorIgId}/messages`, args.accessToken, {
      recipient: { id: args.igsid },
      message: { text: args.text },
    });
  }

  async replyToComment(args: ReplyToCommentArgs): Promise<void> {
    await this.post(`/${args.commentId}/replies`, args.accessToken, {
      message: args.text,
    });
  }

  async getUserProfile(args: GetUserProfileArgs): Promise<UserProfile> {
    const fields = (args.fields ?? DEFAULT_PROFILE_FIELDS).join(",");
    const json = await this.get<IgUserProfileResponse>(
      `/${args.igsid}?fields=${encodeURIComponent(fields)}`,
      args.accessToken,
    );
    return {
      id: json.id ?? args.igsid,
      name: json.name,
      username: json.username,
      followerCount: json.follower_count,
      isUserFollowBusiness: json.is_user_follow_business,
      isBusinessFollowUser: json.is_business_follow_user,
      isVerifiedUser: json.is_verified_user,
    };
  }

  // -------------------------------------------------------------------------

  private async post(path: string, accessToken: string, body: unknown): Promise<unknown> {
    const res = await fetch(this.url(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    return this.handle(res, "POST", path);
  }

  private async get<T>(path: string, accessToken: string): Promise<T> {
    const res = await fetch(this.url(path), {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return (await this.handle(res, "GET", path)) as T;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private async handle(res: Response, method: string, path: string): Promise<unknown> {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Graph API ${method} ${path} failed (${res.status}): ${text}`);
    }
    return text ? JSON.parse(text) : {};
  }
}
