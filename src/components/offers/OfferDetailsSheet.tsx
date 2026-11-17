import { useState } from "react";
import {
  X, ExternalLink, Clock, Globe, Smartphone, ShieldCheck,
  AlertTriangle, CheckCircle2, Flag, Send
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ASSETS_3D } from "../../lib/assets";
import { PayvoraSpinner } from "../PayvoraSpinner";
import { APP_CONFIG } from "../../config/appConfig";
import type { MarketplaceOffer } from "../../types";

interface OfferDetailsSheetProps {
  offer: MarketplaceOffer | null;
  onClose: () => void;
  onStartOffer: (offer: MarketplaceOffer) => Promise<void>;
  onSubmitDispute: (offerId: string, reason: string) => Promise<void>;
  startingOfferId: string | null;
}

export function OfferDetailsSheet({
  offer,
  onClose,
  onStartOffer,
  onSubmitDispute,
  startingOfferId,
}: OfferDetailsSheetProps) {
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  if (!offer) return null;

  const isStarting = startingOfferId === offer.id;
  const fallbackAsset =
    offer.category === "games"
      ? ASSETS_3D.gameController
      : offer.category === "surveys"
      ? ASSETS_3D.surveyPencil
      : ASSETS_3D.mobileApps;

  const handleDisputeSubmit = async () => {
    if (disputeReason.trim().length < 10) return;
    setSubmittingDispute(true);
    try {
      await onSubmitDispute(offer.id, disputeReason.trim());
      setDisputeReason("");
      setShowDisputeForm(false);
    } finally {
      setSubmittingDispute(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#0b1329] border border-white/10 p-5 space-y-4 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-[#0c162e] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  src={offer.image_url || offer.thumbnail_url || fallbackAsset}
                  alt={offer.title}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = fallbackAsset;
                  }}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                  {offer.provider_name} · {offer.category}
                </span>
                <h2 className="text-lg font-extrabold text-white leading-tight mt-0.5">
                  {offer.title}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 text-slate-400 hover:text-white flex items-center justify-center shrink-0"
              aria-label="Close offer details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Payout Card */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-500/15 via-sky-500/10 to-transparent border border-emerald-500/25 p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-300">
                {offer.is_estimated_reward ? "Estimated User Payout" : "Guaranteed User Reward"}
              </div>
              <div className="text-2xl font-black text-emerald-400 tabular-nums mt-0.5">
                +${offer.user_reward.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400 tabular-nums">
                ≈ {Math.round(offer.user_reward * APP_CONFIG.pointsRatio).toLocaleString()} Points
              </div>
            </div>

            {offer.progress_status !== "available" && (
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Your Status
                </span>
                <div className="text-xs font-extrabold text-sky-300 capitalize mt-0.5">
                  {offer.progress_status}
                </div>
              </div>
            )}
          </div>

          {/* Ineligibility Warning */}
          {!offer.eligible && offer.ineligible_reason && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-300">Not Eligible on This Session</div>
                <p className="mt-0.5 text-rose-200/80">{offer.ineligible_reason}</p>
              </div>
            </div>
          )}

          {/* Description */}
          {offer.description && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                About This Offer
              </h3>
              <p className="text-xs text-slate-200 leading-relaxed">{offer.description}</p>
            </div>
          )}

          {/* Milestone Steps (Game Levels / Multi-Event Rewards) */}
          {offer.steps && offer.steps.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Reward Milestones
              </h3>
              <div className="space-y-1.5">
                {offer.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-[#0c162e] border border-white/5 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                        {step.order || idx + 1}
                      </span>
                      <span className="text-slate-200 font-medium truncate">{step.label}</span>
                    </div>
                    {typeof step.payoutUsd === "number" && step.payoutUsd > 0 && (
                      <span className="text-emerald-400 font-bold tabular-nums shrink-0">
                        +${step.payoutUsd.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requirements & Tracking Notes */}
          <div className="rounded-2xl bg-[#0c162e] border border-white/5 p-3.5 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Requirements & Verification
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {offer.instructions || "Follow the partner instructions completely. Do not use VPNs or ad blockers."}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>
                  {offer.device_types.includes("all")
                    ? "All Devices"
                    : offer.device_types.join(", ").toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>
                  {offer.countries.length > 0
                    ? offer.countries.slice(0, 4).join(", ")
                    : "Global"}
                </span>
              </div>
              {offer.estimated_time && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>~{offer.estimated_time} minutes</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{offer.new_user_only ? "New users only" : "Repeatable"}</span>
              </div>
            </div>
          </div>

          {/* Primary Action Bar */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={!offer.eligible || isStarting || (offer.new_user_only && offer.progress_status === "completed")}
              onClick={() => onStartOffer(offer)}
              className={`w-full min-h-[48px] rounded-2xl text-sm font-extrabold text-white flex items-center justify-center gap-2 transition ${
                !offer.eligible || (offer.new_user_only && offer.progress_status === "completed")
                  ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                  : "btn-cyan-glow hover:brightness-110 active:scale-[0.98]"
              }`}
            >
              {isStarting ? (
                <>
                  <PayvoraSpinner size="xs" />
                  <span>Generating Secure Tracking Link...</span>
                </>
              ) : offer.new_user_only && offer.progress_status === "completed" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Already Completed & Credited</span>
                </>
              ) : (
                <>
                  <span>Start Offer & Earn +${offer.user_reward.toFixed(2)}</span>
                  <ExternalLink className="w-4 h-4" />
                </>
              )}
            </button>

            {offer.progress_status === "started" && !showDisputeForm && (
              <button
                type="button"
                onClick={() => setShowDisputeForm(true)}
                className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-sky-300 flex items-center justify-center gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Completed this offer but missing reward? Report issue</span>
              </button>
            )}

            {showDisputeForm && (
              <div className="rounded-2xl bg-[#0c162e] border border-white/10 p-3 space-y-2.5">
                <div className="text-xs font-bold text-white">Missing Reward Support</div>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  rows={3}
                  placeholder="Describe when you completed the offer and which step you finished (min 10 characters)..."
                  className="w-full rounded-xl bg-[#030712] border border-white/10 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDisputeForm(false)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={disputeReason.trim().length < 10 || submittingDispute}
                    onClick={handleDisputeSubmit}
                    className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingDispute ? "Submitting..." : "Submit Ticket"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
