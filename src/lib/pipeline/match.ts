import type { Automation } from "../domain";

/**
 * Find the first automation whose keyword matches the comment text.
 * Matching is case-insensitive; `exact` compares the whole trimmed comment,
 * `contains` looks for the keyword anywhere in the text.
 */
export function matchAutomation(automations: Automation[], text: string): Automation | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  for (const automation of automations) {
    for (const keyword of automation.keywords) {
      const k = keyword.trim().toLowerCase();
      if (!k) continue;
      const hit = automation.matchType === "exact" ? normalized === k : normalized.includes(k);
      if (hit) return automation;
    }
  }
  return null;
}
