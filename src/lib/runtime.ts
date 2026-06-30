import { hasLiveMetaCredentials } from "./config";
import { SupabaseRepositories } from "./db/supabase";
import { LiveMetaClient } from "./meta/liveClient";
import { MockMetaClient } from "./meta/mockClient";
import { makeContext, type PipelineContext } from "./pipeline/context";

/**
 * Build the production pipeline context: Supabase for storage, and the live Meta
 * client when credentials are present (otherwise the mock, so the app still boots
 * before keys arrive). Swapping the whole stack to live = setting env vars.
 */
export function createRuntimeContext(): PipelineContext {
  const repos = new SupabaseRepositories();
  const meta = hasLiveMetaCredentials() ? new LiveMetaClient() : new MockMetaClient();
  return makeContext(repos, meta);
}
