// ============================================================================
// Daily Trials Checklist — six fixed, independently toggleable daily-reset
// checklists (labeled "DC 1"–"DC 6" by default, renameable by the user).
// Identified by fixed ids rather than an extra type field, so any generic
// checklist code (rename, task CRUD, weekday recurrence) just works on them
// unchanged.
// ============================================================================

export const TRIAL_SLOT_COUNT = 6;
export const TRIAL_SLOT_IDS: string[] = Array.from({ length: TRIAL_SLOT_COUNT }, (_, i) => `trial-slot-${i + 1}`);

export function isTrialChecklistId(id: string): boolean {
  return id.startsWith("trial-slot-");
}

export function trialSlotNumber(id: string): number {
  return Number(id.replace("trial-slot-", "")) || 0;
}
