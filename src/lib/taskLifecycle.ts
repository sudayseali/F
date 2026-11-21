import type { TaskItem } from "../types";

export const MAX_TASK_RESUBMISSION_ATTEMPTS = 3;

const SOCIAL_CATEGORY_KEYWORDS = [
  "social",
  "telegram",
  "channel",
  "group",
  "follow",
  "subscribe",
  "community",
  "twitter",
  "youtube",
  "instagram",
  "tiktok",
  "discord",
  "facebook",
];

const REVIEW_CATEGORY_KEYWORDS = [
  "review",
  "rating",
  "feedback",
  "trustpilot",
  "testimonial",
  "app store",
  "play store",
];

export function matchesTaskCategoryTab(category: string, tab: string): boolean {
  if (!tab || tab === "All") return true;
  const cat = String(category || "").toLowerCase();
  const isSocial = SOCIAL_CATEGORY_KEYWORDS.some((kw) => cat.includes(kw));
  const isReview = REVIEW_CATEGORY_KEYWORDS.some((kw) => cat.includes(kw));

  if (tab === "Social") return isSocial;
  if (tab === "Reviews") return isReview;
  if (tab === "Other") return !isSocial && !isReview;
  return true;
}

export interface SubmittedTaskLookupEntry {
  submission_status?: string;
  attempt_count?: number;
}

/**
 * Filters the "Available" task feed according to standard micro-task marketplace rules:
 *   1. Automatically remove any task with 0 remaining slots (`available <= 0`) or non-active status.
 *   2. Exclude tasks where the user already has a `pending` or `approved` submission.
 *   3. Surface `rejected` tasks back into Available so the user can fix & resubmit them
 *      as long as `attempt_count < 3`, the task is `active`, and slots remain (`available > 0`).
 *   4. Apply category tab & search query filters.
 */
export function filterAvailableTasks(
  jobs: TaskItem[],
  submittedTasks: Set<string> | Map<string, SubmittedTaskLookupEntry>,
  activeCategoryTab: string,
  searchQuery = ""
): TaskItem[] {
  const q = searchQuery.trim().toLowerCase();

  return jobs.filter((job) => {
    if (job.status && job.status !== "active") return false;
    const remainingSlots = Number(job.available || 0);
    if (remainingSlots <= 0) return false;

    if (submittedTasks instanceof Map) {
      const existing = submittedTasks.get(job.id);
      if (existing) {
        if (existing.submission_status !== "rejected") return false;
        if (!canResubmitDeclinedTask("rejected", job.status || "active", remainingSlots, existing.attempt_count)) {
          return false;
        }
      }
    } else if (submittedTasks.has(job.id)) {
      return false;
    }

    if (!matchesTaskCategoryTab(job.category, activeCategoryTab)) return false;

    if (q) {
      const hayTitle = String(job.title || "").toLowerCase();
      const hayCat = String(job.category || "").toLowerCase();
      if (!hayTitle.includes(q) && !hayCat.includes(q)) return false;
    }

    return true;
  });
}

export function canResubmitDeclinedTask(
  submissionStatus: string | null | undefined,
  taskStatus: string | null | undefined,
  remainingSlots: number,
  attemptCount = 1
): boolean {
  if (submissionStatus !== "rejected") return false;
  if (taskStatus !== "active") return false;
  if (remainingSlots <= 0) return false;
  return Number(attemptCount || 1) < MAX_TASK_RESUBMISSION_ATTEMPTS;
}
