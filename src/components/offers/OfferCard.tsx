import { ChevronRight, Clock, AlertCircle, CheckCircle2, Flame } from "lucide-react";
import { useState } from "react";
import { ASSETS_3D } from "../../lib/assets";
import type { MarketplaceOffer, OfferCategory } from "../../types";

function getCategoryFallbackIcon(category: OfferCategory): string {
  switch (category) {
    case "games":
      return ASSETS_3D.gameController;
    case "surveys":
      return ASSETS_3D.surveyPencil;
    case "apps":
      return ASSETS_3D.mobileApps;
    case "trial":
      return ASSETS_3D.trophy;
    case "registration":
      return ASSETS_3D.rocket;
    default:
      return ASSETS_3D.giftBox;
  }
}

function formatCategoryLabel(category: OfferCategory): string {
  switch (category) {
    case "games":
      return "Games";
    case "surveys":
      return "Surveys";
    case "apps":
      return "Apps";
    case "registration":
      return "Sign Up";
    case "trial":
      return "Trial";
    default:
      return "Offer";
  }
}

interface OfferCardProps {
  offer: MarketplaceOffer;
  onSelect: (offer: MarketplaceOffer) => void;
  variant?: "featured" | "list";
}

export function OfferCard({ offer, onSelect, variant = "list" }: OfferCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const fallbackAsset = getCategoryFallbackIcon(offer.category);
  const artwork = !imgFailed && (offer.thumbnail_url || offer.image_url)
    ? (offer.thumbnail_url || offer.image_url)!
    : fallbackAsset;

  const deviceSummary = offer.device_types.includes("all")
    ? "All Devices"
    : offer.device_types.map((d) => (d === "ios" ? "iOS" : d === "android" ? "Android" : "Desktop")).join("/");

  const metaSegments = [
    offer.provider_name,
    formatCategoryLabel(offer.category),
    offer.estimated_time ? `${offer.estimated_time} min` : null,
    deviceSummary,
  ].filter(Boolean);

  if (variant === "featured") {
    return (
      <button
        type="button"
        onClick={() => onSelect(offer)}
        className={`min-w-[230px] max-w-[250px] shrink-0 text-left card-glow-blue p-3.5 rounded-2xl flex flex-col justify-between transition-all active:scale-[0.98] ${
          !offer.eligible ? "opacity-65" : "hover:border-sky-400/50"
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
              <img
                src={artwork}
                alt={offer.title}
                onError={() => setImgFailed(true)}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex items-center gap-1 text-[10px] font-extrabold text-amber-300">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Featured</span>
            </div>
          </div>

          <h4 className="text-sm font-bold text-white line-clamp-1">
            {offer.title}
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
            {metaSegments.slice(0, 3).join(" · ")}
          </p>
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
          <div className="text-sm font-black text-emerald-400 tabular-nums">
            {offer.is_estimated_reward ? "Est. " : "+"}${offer.user_reward.toFixed(2)}
          </div>
          <span className="text-[11px] font-bold text-sky-300 flex items-center gap-0.5">
            <span>View</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(offer)}
      className={`w-full text-left card-glass-dark p-3.5 flex items-center gap-3.5 transition-all active:scale-[0.99] min-h-[76px] ${
        !offer.eligible ? "opacity-65" : "hover:border-sky-500/40"
      }`}
    >
      <div className="w-12 h-12 rounded-xl bg-[#0c162e] border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
        <img
          src={artwork}
          alt={offer.title}
          onError={() => setImgFailed(true)}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white truncate">
            {offer.title}
          </h3>
          {offer.progress_status === "completed" && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          {offer.progress_status === "pending" && (
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          )}
        </div>

        <p className="text-[11px] text-slate-400 truncate mt-0.5">
          {offer.description || offer.instructions}
        </p>

        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-400 truncate">
          {!offer.eligible && offer.ineligible_reason ? (
            <span className="inline-flex items-center gap-1 text-rose-400 font-semibold truncate">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{offer.ineligible_reason}</span>
            </span>
          ) : (
            <span className="truncate">{metaSegments.join(" · ")}</span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right flex flex-col items-end justify-center gap-1">
        <div className="text-sm font-black text-emerald-400 tabular-nums">
          {offer.is_estimated_reward ? "~" : "+"}${offer.user_reward.toFixed(2)}
        </div>
        {offer.progress_status !== "available" ? (
          <span
            className={`text-[10px] font-bold capitalize ${
              offer.progress_status === "completed"
                ? "text-emerald-400"
                : offer.progress_status === "pending"
                ? "text-amber-300"
                : offer.progress_status === "reversed"
                ? "text-rose-400"
                : "text-sky-300"
            }`}
          >
            {offer.progress_status}
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-slate-500 flex items-center">
            Open <ChevronRight className="w-3 h-3 ml-0.5" />
          </span>
        )}
      </div>
    </button>
  );
}
