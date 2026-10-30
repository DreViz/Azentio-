export const CONTRIB_TYPES = ["market_observation", "emerging_trend", "product_gap", "operational_challenge", "successful_practice", "improvement_suggestion"] as const;
export const EVIDENCE = ["anecdotal", "internal_data", "customer_feedback", "regulatory", "third_party"] as const;
export const CONFIDENCE = ["low", "medium", "high"] as const;
export const VISIBILITY = ["private", "org", "proposed_shared"] as const;
export const IDEA_STATUS = ["Proposed", "Under review", "Planned", "In progress", "Released", "Not proceeding"] as const;
export const human = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const VISIBILITY_TEXT: Record<string, { label: string; who: string }> = {
  private: { label: "Private to me", who: "Only you. Nobody at Azentio or your organisation can see it." },
  org: { label: "My organisation", who: "Active members of your organisation's workspace. Never other clients, never Azentio moderators." },
  proposed_shared: { label: "Propose to the learning community", who: "After you submit: Azentio learning moderators review it. Only a reviewed, de-identified copy is ever shown to other participants." },
};

export const STATE_TONE: Record<string, string> = {
  draft: "slate", submitted: "blue", returned: "amber", published: "green", rejected: "red", withdrawn: "slate", superseded: "slate",
  unpublished: "amber", Proposed: "slate", "Under review": "blue", Planned: "purple", "In progress": "cyan", Released: "green", "Not proceeding": "red",
};
