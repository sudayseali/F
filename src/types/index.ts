// ==========================================
// PAYVORA TELEGRAM MINI APP - TYPE DEFINITIONS
// ==========================================

export interface TelegramUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  uuid?: string;
  balance?: number;
}

export type PaymentMethod = "usdt" | "usdt_bep20" | "trx" | null;

export interface PayoutMethodInfo {
  id: PaymentMethod;
  name: string;
  symbol: string;
  network?: string;
  iconImg?: string;
  min: number;
  placeholder: string;
  desc: string;
}

export interface Provider {
  id: string;
  name: string;
  category: string;
  rewardType: string;
  icon3D?: string;
  icon?: any;
  iconBg: string;
  iconColor: string;
  badge: string;
  badgeType: "hot" | "games" | "blue" | "green";
  description: string;
  payoutRange: string;
}

export interface TaskItem {
  id: string;
  category: string;
  title: string;
  pay: string;
  timeToComplete: string;
  available: number;
  pendingCount?: number;
  total: number;
  status: string;
  verificationType?: "manual_screenshot" | "auto_telegram_join";
}

export interface UserTaskSubmissionItem {
  submission_id: string;
  task_id: string;
  task_title: string;
  task_category: string;
  task_reward: number;
  task_status: string;
  submission_status: "pending" | "approved" | "rejected";
  earned_amount: number;
  admin_comment?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
  attempt_count?: number;
}

export interface TransactionItem {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  status?: string;
  created_at: string;
}

export interface ReferralItem {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  total_commission_earned?: number;
  created_at: string;
  referred?: {
    first_name?: string;
    username?: string;
  };
}

export interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: "info" | "error" | "success";
  actionText?: string;
  onAction?: () => void;
}

export type OfferCategory = "games" | "apps" | "surveys" | "registration" | "trial" | "other";
export type OfferProgressStatus = "available" | "started" | "pending" | "completed" | "reversed" | "failed";

export interface OfferStepItem {
  label: string;
  payoutUsd?: number;
  order: number;
}

export interface MarketplaceOffer {
  id: string;
  provider_key: string;
  provider_name: string;
  external_offer_id: string;
  title: string;
  description: string;
  instructions: string;
  steps: OfferStepItem[];
  category: OfferCategory;
  image_url: string | null;
  thumbnail_url: string | null;
  user_reward: number;
  currency: string;
  is_estimated_reward: boolean;
  estimated_time: number | null;
  countries: string[];
  excluded_countries: string[];
  device_types: string[];
  new_user_only: boolean;
  tracking_type: "s2s" | "sdk" | "survey" | "hosted";
  is_featured: boolean;
  starts_at: string | null;
  expires_at: string | null;
  synced_at: string;
  progress_status: OfferProgressStatus;
  reward_earned: number;
  eligible: boolean;
  ineligible_reason: string | null;
}

export interface PartnerWallInfo {
  provider_key: string;
  display_name: string;
  integration_type: "api_and_postback" | "hosted_wall" | "hybrid" | "survey_api";
  status: "active" | "paused" | "pending_approval" | "disabled";
  supports_custom_listing: boolean;
  supports_hosted_wall: boolean;
  configured_for_wall: boolean;
  categories: string[];
  note: string | null;
}

export interface OfferUserSummary {
  startedCount: number;
  pendingCount: number;
  completedCount: number;
  totalEarned: number;
}

export interface OfferHistoryProgressItem {
  id: string;
  offer_id: string;
  click_id: string | null;
  progress_status: OfferProgressStatus;
  reward_amount: number;
  status_note: string | null;
  started_at: string;
  completed_at: string | null;
  last_updated_at: string;
  offer?: {
    id: string;
    title: string;
    category: string;
    user_reward: number;
    thumbnail_url: string | null;
    provider?: {
      provider_key: string;
      display_name: string;
    } | null;
  } | null;
}

export interface OfferDisputeItem {
  id: string;
  offer_id: string | null;
  reason: string;
  status: "open" | "investigating" | "resolved" | "rejected";
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  offer?: { title?: string } | null;
}

