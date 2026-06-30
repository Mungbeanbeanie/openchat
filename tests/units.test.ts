import { describe, expect, it } from "vitest";
import { parseWebhook } from "../src/lib/pipeline/parse";
import { matchAutomation } from "../src/lib/pipeline/match";
import { computeSignature, verifySignature } from "../src/lib/meta/signature";
import type { Automation } from "../src/lib/domain";

describe("parseWebhook", () => {
  it("parses a comment change into a comment event", () => {
    const events = parseWebhook({
      object: "instagram",
      entry: [
        {
          id: "creator_1",
          time: 100,
          changes: [
            {
              field: "comments",
              value: {
                id: "c1",
                text: "LINK",
                media: { id: "m1" },
                from: { id: "u1", username: "fan" },
              },
            },
          ],
        },
      ],
    });
    expect(events).toEqual([
      {
        type: "comment",
        creatorIgId: "creator_1",
        commentId: "c1",
        mediaId: "m1",
        fromIgsid: "u1",
        fromUsername: "fan",
        text: "LINK",
        eventId: "comment:c1",
        timestamp: 100,
      },
    ]);
  });

  it("parses a messaging entry into a message event and flags echoes", () => {
    const [event] = parseWebhook({
      object: "instagram",
      entry: [
        {
          id: "creator_1",
          messaging: [
            { sender: { id: "u1" }, timestamp: 5, message: { mid: "mid1", text: "hi", is_echo: true } },
          ],
        },
      ],
    });
    expect(event).toMatchObject({ type: "message", fromIgsid: "u1", isEcho: true, eventId: "message:mid1" });
  });

  it("ignores malformed entries", () => {
    expect(parseWebhook({ object: "instagram", entry: [{ id: "x" }] })).toEqual([]);
  });
});

describe("matchAutomation", () => {
  const base: Omit<Automation, "keywords" | "matchType"> = {
    id: "a",
    creatorId: "c",
    mediaId: null,
    dmTemplate: "",
    linkPayload: "",
    publicReplyEnabled: false,
    publicReplyText: null,
    followGateEnabled: true,
    nudgeTemplate: "",
    nudgeMax: 2,
    active: true,
  };
  const auto = (over: Partial<Automation>): Automation => ({ ...base, keywords: [], matchType: "contains", ...over });

  it("matches case-insensitively with contains", () => {
    expect(matchAutomation([auto({ keywords: ["link"] })], "GIVE ME THE LINK")?.id).toBe("a");
  });

  it("exact requires the whole comment to equal the keyword", () => {
    const a = auto({ keywords: ["link"], matchType: "exact" });
    expect(matchAutomation([a], "link")).not.toBeNull();
    expect(matchAutomation([a], "the link")).toBeNull();
  });

  it("returns null when nothing matches or text is empty", () => {
    expect(matchAutomation([auto({ keywords: ["guide"] })], "nope")).toBeNull();
    expect(matchAutomation([auto({ keywords: ["guide"] })], "   ")).toBeNull();
  });
});

describe("webhook signature", () => {
  const secret = "app-secret";

  it("verifies a correctly signed body", () => {
    const body = '{"object":"instagram"}';
    expect(verifySignature(body, computeSignature(body, secret), secret)).toBe(true);
  });

  it("rejects a tampered body or missing header", () => {
    const body = '{"object":"instagram"}';
    const sig = computeSignature(body, secret);
    expect(verifySignature('{"object":"x"}', sig, secret)).toBe(false);
    expect(verifySignature(body, null, secret)).toBe(false);
  });
});
