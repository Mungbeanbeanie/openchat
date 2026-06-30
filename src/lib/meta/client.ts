/**
 * Provider-agnostic Meta client interface.
 *
 * Everything that touches the Instagram Graph API goes through this interface so
 * the pipeline can run against MockMetaClient (tests/simulator, no keys) or
 * LiveMetaClient (real API) with no other code changes.
 */

export interface UserProfile {
  id: string;
  username?: string;
  name?: string;
  followerCount?: number;
  /** Whether the user follows the creator's account. The follower gate. */
  isUserFollowBusiness?: boolean;
  isBusinessFollowUser?: boolean;
  isVerifiedUser?: boolean;
}

export interface SendPrivateReplyArgs {
  creatorIgId: string;
  commentId: string;
  text: string;
  accessToken: string;
}

export interface SendDirectMessageArgs {
  creatorIgId: string;
  igsid: string;
  text: string;
  accessToken: string;
}

export interface ReplyToCommentArgs {
  creatorIgId: string;
  commentId: string;
  text: string;
  accessToken: string;
}

export interface GetUserProfileArgs {
  igsid: string;
  accessToken: string;
  /** Defaults to the full follower-gate field set. */
  fields?: string[];
}

export interface MetaClient {
  /**
   * Send the single allowed private reply DM to a comment. Works without prior
   * consent, but only within 7 days of the comment.
   */
  sendPrivateReply(args: SendPrivateReplyArgs): Promise<void>;

  /**
   * Send a normal DM to a user by IGSID. Only valid after the user has messaged
   * the account (consent) and within the messaging window.
   */
  sendDirectMessage(args: SendDirectMessageArgs): Promise<void>;

  /** Post a public reply on a comment. */
  replyToComment(args: ReplyToCommentArgs): Promise<void>;

  /**
   * Read a user's profile (incl. `is_user_follow_business`). Requires the user
   * to have given consent by messaging / tapping a CTA first.
   */
  getUserProfile(args: GetUserProfileArgs): Promise<UserProfile>;
}

/** Default fields requested from the User Profile API. */
export const DEFAULT_PROFILE_FIELDS = [
  "name",
  "username",
  "follower_count",
  "is_user_follow_business",
  "is_business_follow_user",
  "is_verified_user",
];
