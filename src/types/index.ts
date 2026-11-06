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

export type PaymentMethod = "usdt" | "usdt_bep20" | "trx" | "payeer" | null;

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
  total: number;
  status: string;
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
