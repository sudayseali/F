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

/**
 * Filters the "Available" task feed according to standard micro-task marketplace rules:
 *   1. Exclude any task the current user has already submitted (`pending`, `approved`, or `rejected`)
 *      so submitted tasks move cleanly to Pending / Completed / Declined tabs instead of lingering in Available.
 *   2. Exclude tasks with 0 remaining slots (`available <= 0`).
 *   3. Exclude non-active tasks (`paused` / `completed` / `archived`).
 *   4. Apply category tab & search query filters.
 */
export function filterAvailableTasks(
  jobs: TaskItem[],
  submittedTaskIds: Set<string> | Map<string, unknown>,
  activeCategoryTab: string,
  searchQuery = ""
): TaskItem[] {
  const q = searchQuery.trim().toLowerCase();

  return jobs.filter((job) => {
    if (submittedTaskIds.has(job.id)) return false;
    if (job.status && job.status !== "active") return false;
    if (Number(job.available || 0) <= 0) return false;
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
