/**
 * Local end-to-end simulator — runs the full comment-to-DM pipeline against the
 * in-memory repos + mock Meta client, with NO API keys.
 *
 *   npm run simulate                 # run every scenario
 *   npm run simulate -- follower     # run one scenario
 *
 * Scenarios: follower | non-follower | non-follower-stop | no-match | dedupe
 */
import {
  buildHarness,
  commentWebhook,
  messageWebhook,
  type Harness,
} from "../src/lib/testing/harness";
import type { MockCall } from "../src/lib/meta/mockClient";

const FOLLOWER = "ig_follower_1";
const NON_FOLLOWER = "ig_nonfollower_1";

function show(call: MockCall): string {
  switch (call.kind) {
    case "public_reply":
      return `   💬 public reply on ${call.commentId}: "${call.text}"`;
    case "private_reply":
      return `   ✉️  private reply (DM) to comment ${call.commentId}: "${call.text}"`;
    case "direct_message":
      return `   📩 DM to ${call.igsid}: "${call.text}"`;
    case "get_profile":
      return `   🔎 read profile of ${call.igsid} (follower gate)`;
  }
}

function printTrace(h: Harness): void {
  for (const call of h.meta.calls) console.log(show(call));
  const delivered = h.meta.callsOf("direct_message").some((c) => c.text.includes("example.com"));
  console.log(delivered ? "   ✅ LINK DELIVERED" : "   🚫 link NOT delivered");
}

async function scenarioFollower(): Promise<void> {
  console.log("\n=== Scenario: follower comments the keyword ===");
  const h = buildHarness();
  h.meta.setFollows(FOLLOWER, true);
  await h.deliver(commentWebhook({ fromIgsid: FOLLOWER, text: "LINK please!", username: "fan" }));
  await h.deliver(messageWebhook({ fromIgsid: FOLLOWER, text: "ready!" }));
  printTrace(h);
}

async function scenarioNonFollowerConvert(): Promise<void> {
  console.log("\n=== Scenario: non-follower converts (follows, then re-checks) ===");
  const h = buildHarness();
  // default: unknown user is treated as a non-follower
  await h.deliver(commentWebhook({ fromIgsid: NON_FOLLOWER, text: "send the guide", username: "newbie" }));
  await h.deliver(messageWebhook({ fromIgsid: NON_FOLLOWER, text: "hi!" })); // → nudge
  h.meta.setFollows(NON_FOLLOWER, true); // user follows
  await h.deliver(messageWebhook({ fromIgsid: NON_FOLLOWER, text: "done" })); // → delivered
  printTrace(h);
}

async function scenarioNonFollowerStop(): Promise<void> {
  console.log("\n=== Scenario: non-follower never follows (gate stops them) ===");
  const h = buildHarness({ nudgeMax: 1 });
  await h.deliver(commentWebhook({ fromIgsid: NON_FOLLOWER, text: "guide", username: "ghost" }));
  await h.deliver(messageWebhook({ fromIgsid: NON_FOLLOWER, text: "hi" })); // → nudge (1)
  await h.deliver(messageWebhook({ fromIgsid: NON_FOLLOWER, text: "where?" })); // → stop
  printTrace(h);
}

async function scenarioNoMatch(): Promise<void> {
  console.log("\n=== Scenario: comment with no keyword is ignored ===");
  const h = buildHarness();
  const actions = await h.deliver(commentWebhook({ fromIgsid: FOLLOWER, text: "love this!!" }));
  console.log(`   actions: ${actions.map((a) => a.kind).join(", ")}`);
  printTrace(h);
}

async function scenarioDedupe(): Promise<void> {
  console.log("\n=== Scenario: duplicate webhook delivery is deduped ===");
  const h = buildHarness();
  const body = commentWebhook({ fromIgsid: FOLLOWER, text: "link", commentId: "comment_fixed" });
  await h.deliver(body);
  await h.deliver(body); // same comment id → deduped
  const privateReplies = h.meta.callsOf("private_reply").length;
  console.log(`   private replies sent: ${privateReplies} (expected 1)`);
}

const SCENARIOS: Record<string, () => Promise<void>> = {
  follower: scenarioFollower,
  "non-follower": scenarioNonFollowerConvert,
  "non-follower-stop": scenarioNonFollowerStop,
  "no-match": scenarioNoMatch,
  dedupe: scenarioDedupe,
};

async function main(): Promise<void> {
  const which = process.argv[2];
  if (which && !SCENARIOS[which]) {
    console.error(`Unknown scenario "${which}". Options: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }
  const toRun = which ? [SCENARIOS[which]] : Object.values(SCENARIOS);
  for (const run of toRun) await run();
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
