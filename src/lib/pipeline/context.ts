import type { MetaClient } from "../meta/client.js";
import type { Repositories } from "../db/repositories.js";

/** Everything the pipeline needs, injected so it can run against mocks or live deps. */
export interface PipelineContext {
  repos: Repositories;
  meta: MetaClient;
  /** Injectable clock (defaults to real time) for deterministic tests. */
  now: () => Date;
}

export function makeContext(
  repos: Repositories,
  meta: MetaClient,
  now: () => Date = () => new Date(),
): PipelineContext {
  return { repos, meta, now };
}
