/**
 * Raw Instagram webhook payload shapes (object: "instagram").
 *
 * Comments arrive under `entry[].changes[]` with field "comments".
 * Messages arrive under `entry[].messaging[]` (Messenger-style). We parse both,
 * and defensively also accept messages delivered under `changes` field "messages".
 */

export interface IgWebhookBody {
  object: string; // "instagram"
  entry: IgEntry[];
}

export interface IgEntry {
  id: string; // the creator's IG professional account id
  time?: number;
  changes?: IgChange[];
  messaging?: IgMessaging[];
}

export interface IgChange {
  field: string; // "comments" | "live_comments" | "messages" | ...
  value: IgChangeValue;
}

export interface IgChangeValue {
  id?: string; // comment id
  text?: string;
  media?: { id?: string; media_product_type?: string };
  from?: { id?: string; username?: string };
  parent_id?: string;
  // message-style payload (when field === "messages")
  sender?: { id?: string };
  message?: IgMessage;
}

export interface IgMessaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: IgMessage;
}

export interface IgMessage {
  mid?: string;
  text?: string;
  is_echo?: boolean;
}

// ---------------------------------------------------------------------------
// Graph API response shapes
// ---------------------------------------------------------------------------

/** Result of GET /{igsid}?fields=... (the User Profile API). */
export interface IgUserProfileResponse {
  id?: string;
  name?: string;
  username?: string;
  profile_pic?: string;
  follower_count?: number;
  is_user_follow_business?: boolean;
  is_business_follow_user?: boolean;
  is_verified_user?: boolean;
}
