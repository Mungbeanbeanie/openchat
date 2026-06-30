import { describe, expect, it } from "vitest";
import {
  buildHarness,
  commentWebhook,
  messageWebhook,
} from "../src/lib/testing/harness";

const FOLLOWER = "ig_follower";
const NON_FOLLOWER = "ig_nonfollower";

const linkDelivered = (h: ReturnType<typeof buildHarness>) =>
  h.meta.callsOf("direct_message").some((c) => c.text === h.automation.linkPayload);

describe("comment-to-DM follower gate", () => {
  it("follower: opens with public + private reply, then delivers the link", async () => {
    const h = buildHarness();
    h.meta.setFollows(FOLLOWER, true);

    await h.deliver(commentWebhook({ fromIgsid: FOLLOWER, text: "LINK please" }));
    // comment-time: public reply + the one private reply, NO link yet, NO profile read
    expect(h.meta.callsOf("public_reply")).toHaveLength(1);
    expect(h.meta.callsOf("private_reply")).toHaveLength(1);
    expect(h.meta.callsOf("get_profile")).toHaveLength(0);
    expect(linkDelivered(h)).toBe(false);

    await h.deliver(messageWebhook({ fromIgsid: FOLLOWER, text: "ready" }));
    // consent: profile read, follower confirmed, link delivered
    expect(h.meta.callsOf("get_profile")).toHaveLength(1);
    expect(linkDelivered(h)).toBe(true);

    const contact = await h.repos.getContact(h.creator.id, FOLLOWER);
    expect(contact?.follows).toBe(true);
  });

  it("non-follower converts: nudged first, then delivered after following", async () => {
    const h = buildHarness();

    await h.deliver(commentWebhook({ fromIgsid: NON_FOLLOWER, text: "send the guide" }));
    await h.deliver(messageWebhook({ fromIgsid: NON_FOLLOWER, text: "hi" }));
    // non-follower: gets the nudge, NOT the link
    expect(h.meta.callsOf("direct_message").map((c) => c.text)).toContain(
      h.automation.nudgeTemplate,
    );
    expect(linkDelivered(h)).toBe(false);

    h.meta.setFollows(NON_FOLLOWER, true);
    await h.deliver(messageWebhook({ fromIgsid: NON_FOLLOWER, text: "done" }));
    expect(linkDelivered(h)).toBe(true);
  });

  it("non-follower who never follows is stopped without the link", async () => {
    const h = buildHarness({ nudgeMax: 1 });

    await h.deliver(commentWebhook({ fromIgsid: NON_FOLLOWER, text: "guide" }));
    await h.deliver(messageWebhook({ fromIgsid: NON_FOLLOWER, text: "hi" })); // nudge 1
    await h.deliver(messageWebhook({ fromIgsid: NON_FOLLOWER, text: "where?" })); // stop

    expect(linkDelivered(h)).toBe(false);
    const flow = await h.repos.getActiveFlowStateForContact(
      h.creator.id,
      (await h.repos.getContact(h.creator.id, NON_FOLLOWER))!.id,
    );
    // STOPPED is terminal, so there is no active flow left
    expect(flow).toBeNull();
  });

  it("ignores comments without a keyword match", async () => {
    const h = buildHarness();
    const actions = await h.deliver(commentWebhook({ fromIgsid: FOLLOWER, text: "love this!!" }));
    expect(actions.every((a) => a.kind === "noop")).toBe(true);
    expect(h.meta.calls).toHaveLength(0);
  });

  it("dedupes duplicate webhook deliveries (Meta retries)", async () => {
    const h = buildHarness();
    const body = commentWebhook({ fromIgsid: FOLLOWER, text: "link", commentId: "comment_fixed" });
    await h.deliver(body);
    await h.deliver(body);
    expect(h.meta.callsOf("private_reply")).toHaveLength(1);
  });

  it("respects exact match type", async () => {
    const h = buildHarness({ matchType: "exact", keywords: ["link"] });
    await h.deliver(commentWebhook({ fromIgsid: FOLLOWER, text: "please send link now" }));
    expect(h.meta.callsOf("private_reply")).toHaveLength(0); // "contains" would match; "exact" does not

    await h.deliver(commentWebhook({ fromIgsid: FOLLOWER, text: "LINK" }));
    expect(h.meta.callsOf("private_reply")).toHaveLength(1);
  });

  it("never reads the profile from a comment alone (the consent constraint)", async () => {
    const h = buildHarness();
    h.meta.setFollows(FOLLOWER, true);
    await h.deliver(commentWebhook({ fromIgsid: FOLLOWER, text: "link" }));
    expect(h.meta.callsOf("get_profile")).toHaveLength(0);
  });

  it("ignores echo messages (sent by the business itself)", async () => {
    const h = buildHarness();
    await h.deliver(commentWebhook({ fromIgsid: FOLLOWER, text: "link" }));
    const before = h.meta.calls.length;
    await h.deliver(messageWebhook({ fromIgsid: FOLLOWER, text: "ignored", isEcho: true }));
    expect(h.meta.calls.length).toBe(before);
  });
});
