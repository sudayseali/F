import { CheckCircle2, Clock, XCircle, AlertTriangle, PlayCircle, MessageSquare } from "lucide-react";
import type { OfferDisputeItem, OfferHistoryProgressItem } from "../../types";

interface OfferHistoryViewProps {
  progressItems: OfferHistoryProgressItem[];
  disputes: OfferDisputeItem[];
  legacyLogs: Array<{
    id: string;
    provider: string;
    external_transaction_id: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
  loading: boolean;
  onReportMissing: (offerId: string, clickId?: string | null) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
    case "credited":
    case "resolved":
      return { label: status === "credited" ? "Completed" : status, icon: CheckCircle2, cls: "text-emerald-400" };
    case "pending":
    case "investigating":
    case "open":
      return { label: status, icon: Clock, cls: "text-amber-300" };
    case "reversed":
      return { label: "Reversed", icon: AlertTriangle, cls: "text-rose-400" };
    case "failed":
    case "rejected":
      return { label: status, icon: XCircle, cls: "text-rose-400" };
    default:
      return { label: "Started", icon: PlayCircle, cls: "text-sky-300" };
  }
}

export function OfferHistoryView({
  progressItems,
  disputes,
  legacyLogs,
  loading,
  onReportMissing,
}: OfferHistoryViewProps) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  const hasAny = progressItems.length > 0 || legacyLogs.length > 0 || disputes.length > 0;

  if (!hasAny) {
    return (
      <div className="card-glass-dark p-6 text-center space-y-2">
        <Clock className="w-8 h-8 text-slate-500 mx-auto" />
        <h3 className="text-sm font-bold text-white">No Offer Activity Yet</h3>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Start an offer or survey from the marketplace to track clicks, pending credits, and completed payouts here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {progressItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Offer Progress & Completions
          </h3>
          {progressItems.map((item) => {
            const meta = getStatusBadge(item.progress_status);
            const Icon = meta.icon;
            const title = item.offer?.title || "Partner Offer";
            const provider = item.offer?.provider?.display_name || "Partner";
            const displayAmount =
              item.progress_status === "completed" && item.reward_amount > 0
                ? item.reward_amount
                : item.offer?.user_reward || 0;

            return (
              <div
                key={item.id}
                className="card-glass-dark p-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-4 h-4 shrink-0 ${meta.cls}`} />
                    <h4 className="text-sm font-bold text-white truncate">{title}</h4>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {provider} · {new Date(item.last_updated_at).toLocaleDateString()}
                    {item.status_note ? ` · ${item.status_note}` : ""}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-black text-emerald-400 tabular-nums">
                    {item.progress_status === "reversed" ? "-" : "+"}${Number(displayAmount).toFixed(2)}
                  </div>
                  <div className={`text-[10px] font-bold capitalize ${meta.cls}`}>{meta.label}</div>
                  {item.progress_status === "started" && (
                    <button
                      type="button"
                      onClick={() => onReportMissing(item.offer_id, item.click_id)}
                      className="text-[10px] font-bold text-sky-400 hover:underline mt-0.5"
                    >
                      Missing Reward?
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {legacyLogs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Partner Wall Postbacks
          </h3>
          {legacyLogs.map((log) => {
            const meta = getStatusBadge(log.status);
            const Icon = meta.icon;
            return (
              <div
                key={log.id}
                className="card-glass-dark p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-4 h-4 shrink-0 ${meta.cls}`} />
                    <span className="text-xs font-bold text-white uppercase">
                      {log.provider}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate">
                      #{log.external_transaction_id}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-emerald-400 tabular-nums">
                    {log.status === "reversed" ? "-" : "+"}${Number(log.amount).toFixed(2)}
                  </div>
                  <div className={`text-[10px] font-bold capitalize ${meta.cls}`}>{meta.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {disputes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Reward Support Tickets
          </h3>
          {disputes.map((d) => {
            const meta = getStatusBadge(d.status);
            return (
              <div key={d.id} className="card-glass-dark p-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate">{d.offer?.title || "Offer Support Ticket"}</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${meta.cls}`}>{d.status}</span>
                </div>
                <p className="text-[11px] text-slate-400">{d.reason}</p>
                {d.admin_note && (
                  <p className="text-[11px] text-sky-300 pt-1 border-t border-white/5">
                    Reply: {d.admin_note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
