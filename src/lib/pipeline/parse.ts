import type { NormalizedEvent } from "../domain.js";
import type { IgWebhookBody } from "../meta/types.js";

/**
 * Normalize a raw Instagram webhook body into typed events.
 * Comments arrive under `entry.changes` (field "comments"); messages under
 * `entry.messaging`. We also defensively read messages from `changes`.
 */
export function parseWebhook(body: IgWebhookBody): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  if (!body || !Array.isArray(body.entry)) return events;

  for (const entry of body.entry) {
    const creatorIgId = entry.id;
    const entryTime = entry.time ?? Date.now();

    for (const change of entry.changes ?? []) {
      if (change.field === "comments" || change.field === "live_comments") {
        const v = change.value;
        if (!v?.id || !v.from?.id) continue;
        events.push({
          type: "comment",
          creatorIgId,
          commentId: v.id,
          mediaId: v.media?.id ?? "",
          fromIgsid: v.from.id,
          fromUsername: v.from.username ?? null,
          text: v.text ?? "",
          eventId: `comment:${v.id}`,
          timestamp: entryTime,
        });
      } else if (change.field === "messages") {
        const v = change.value;
        const sender = v.sender?.id ?? v.from?.id;
        if (!sender || !v.message) continue;
        events.push(messageEvent(creatorIgId, sender, v.message, entryTime));
      }
    }

    for (const m of entry.messaging ?? []) {
      const sender = m.sender?.id;
      if (!sender || !m.message) continue;
      events.push(messageEvent(creatorIgId, sender, m.message, m.timestamp ?? entryTime));
    }
  }

  return events;
}

function messageEvent(
  creatorIgId: string,
  sender: string,
  message: { mid?: string; text?: string; is_echo?: boolean },
  timestamp: number,
): NormalizedEvent {
  return {
    type: "message",
    creatorIgId,
    fromIgsid: sender,
    text: message.text ?? null,
    isEcho: message.is_echo ?? false,
    eventId: `message:${message.mid ?? `${sender}:${timestamp}`}`,
    timestamp,
  };
}
