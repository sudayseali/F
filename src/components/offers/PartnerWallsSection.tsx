import { ChevronRight, ShieldCheck, Clock } from "lucide-react";
import { ASSETS_3D } from "../../lib/assets";
import { PayvoraSpinner } from "../PayvoraSpinner";
import type { PartnerWallInfo } from "../../types";

const PROVIDER_ICON_MAP: Record<string, string> = {
  cpx: ASSETS_3D.surveyPencil,
  ayet: ASSETS_3D.gameController,
  torox: ASSETS_3D.trophy,
  lootably: ASSETS_3D.shieldVerified,
  adgate: ASSETS_3D.mobileApps,
  adgem: ASSETS_3D.rocket,
  adscend: ASSETS_3D.giftBox,
  tapjoy: ASSETS_3D.starCoin,
};

interface PartnerWallsSectionProps {
  walls: PartnerWallInfo[];
  launchingProvider: string | null;
  onLaunchWall: (wall: PartnerWallInfo) => void;
}

export function PartnerWallsSection({
  walls,
  launchingProvider,
  onLaunchWall,
}: PartnerWallsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="px-1">
        <h3 className="text-sm font-bold text-white">Partner Offerwalls</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Full hosted partner walls for surveys and exclusive campaigns that run inside an external provider wall.
        </p>
      </div>

      <div className="space-y-2.5">
        {walls.map((wall) => {
          const isPendingApproval = wall.status === "pending_approval";
          const isLaunching = launchingProvider === wall.provider_key;
          const iconSrc = PROVIDER_ICON_MAP[wall.provider_key] || ASSETS_3D.giftBox;
          const isInteractive = wall.status === "active" && wall.configured_for_wall;

          return (
            <button
              key={wall.provider_key}
              type="button"
              disabled={isLaunching}
              onClick={() => onLaunchWall(wall)}
              className={`w-full text-left card-glass-dark p-3.5 flex items-center gap-3.5 transition-all min-h-[72px] ${
                isPendingApproval ? "opacity-75" : "hover:border-sky-500/40 active:scale-[0.99]"
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                {isLaunching ? (
                  <PayvoraSpinner size="sm" />
                ) : (
                  <img
                    src={iconSrc}
                    alt={wall.display_name}
                    className="w-8 h-8 object-contain"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white truncate">
                    {wall.display_name}
                  </h4>
                  {isPendingApproval ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
                      <Clock className="w-3 h-3" />
                      <span>Pending Approval</span>
                    </span>
                  ) : isInteractive ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Verified</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400">
                      Setup Required
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {wall.note ||
                    (wall.categories.length > 0
                      ? `Hosted campaigns: ${wall.categories.join(", ")}`
                      : "Hosted partner offerwall & verified S2S postbacks")}
                </p>
              </div>

              <div className="w-8 h-8 rounded-xl bg-white/5 text-slate-400 flex items-center justify-center shrink-0">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
