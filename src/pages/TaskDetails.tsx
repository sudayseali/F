import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Users, ShieldAlert, Upload, CheckCircle, X, ExternalLink, Zap } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { supabase, invokeEdgeFunction } from "../lib/supabase";
import { useTelegram } from "../contexts/TelegramContext";
import { tgHaptics, tgBackButton, openTgLink } from "../lib/telegram";
import { PayvoraSpinner, PayvoraLoadingState } from "../components";

interface TaskRecord {
  id: string;
  title: string;
  description: string;
  category?: string;
  reward: number;
  max_completions?: number;
  current_completions?: number;
  pending_submissions?: number;
  remaining_slots?: number;
  target_url?: string | null;
  job_length?: number | null;
  proof_instructions?: string | null;
  verification_type?: "manual_screenshot" | "auto_telegram_join" | string;
  verification_chat_id?: string | null;
  status: string;
}

interface ExistingSubmission {
  id: string;
  status: string;
  submitted_at: string;
  admin_comment?: string | null;
}

const ALLOWED_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp"]);

function isSafeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useTelegram();

  const [task, setTask] = useState<TaskRecord | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<ExistingSubmission | null>(null);
  const [loadingTask, setLoadingTask] = useState(true);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState(user?.username ? `@${user.username}` : "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    tgBackButton.show(() => navigate("/tasks"));
    return () => tgBackButton.hide();
  }, [navigate]);

  useEffect(() => {
    if (user?.username && !username) {
      setUsername(`@${user.username}`);
    }
  }, [user?.username, username]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    let active = true;
    async function loadTaskAndSubmission() {
      if (!id) {
        setLoadingTask(false);
        return;
      }
      setLoadingTask(true);
      try {
        let taskData: TaskRecord | null = null;
        const { data: rpcTask, error: rpcErr } = await supabase
          .rpc("get_task_with_slots", { p_task_id: id })
          .maybeSingle();

        if (!rpcErr && rpcTask) {
          taskData = rpcTask as TaskRecord;
        } else {
          const { data: fallbackData, error: taskErr } = await supabase
            .from("tasks")
            .select("*")
            .eq("id", id)
            .maybeSingle();

          if (taskErr) {
            console.error("Failed to fetch task:", taskErr);
          } else {
            taskData = fallbackData as TaskRecord | null;
          }
        }

        if (!active) return;
        setTask(taskData);

        if (user?.uuid && taskData) {
          const { data: subData } = await supabase
            .from("submissions")
            .select("id, status, submitted_at, admin_comment")
            .eq("task_id", id)
            .eq("user_id", user.uuid)
            .maybeSingle();
          if (active && subData) {
            setExistingSubmission(subData as ExistingSubmission);
          }
        }
      } catch (err) {
        console.error("Task load error:", err);
      } finally {
        if (active) setLoadingTask(false);
      }
    }

    loadTaskAndSubmission();
    return () => {
      active = false;
    };
  }, [id, user?.uuid]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "";
    if (!selectedFile.type.startsWith("image/") || !ALLOWED_IMAGE_EXTS.has(ext)) {
      setError("Please upload a valid image file (PNG, JPG, JPEG, WebP).");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const removeImage = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    tgHaptics.impact("medium");

    if (!user?.uuid) {
      setError("Authentication required. Please reopen Payvora inside Telegram.");
      return;
    }
    if (!task || task.status !== "active") {
      setError("This task is no longer accepting submissions.");
      return;
    }
    if (!file) {
      setError("Please attach a screenshot proof.");
      return;
    }

    setError(null);
    setStatus("submitting");

    try {
      const rawExt = (file.name.split(".").pop() || "png").toLowerCase();
      const fileExt = ALLOWED_IMAGE_EXTS.has(rawExt) ? rawExt : "png";
      // Store inside user's authenticated UUID folder in private bucket (admin views via signed URLs)
      const objectPath = `${user.uuid}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("proofs")
        .upload(objectPath, file);

      if (uploadError) throw uploadError;

      await invokeEdgeFunction("submit_task", {
        task_id: task.id,
        proof_text: objectPath,
        telegram_username: username.trim()
      });

      setTask((prev) => {
        if (!prev) return prev;
        const nextPending = (prev.pending_submissions || 0) + 1;
        const maxC = prev.max_completions || 100;
        const currC = prev.current_completions || 0;
        return {
          ...prev,
          pending_submissions: nextPending,
          remaining_slots: Math.max(0, maxC - currC - nextPending),
        };
      });

      tgHaptics.notification("success");
      setStatus("success");
    } catch (err: any) {
      console.error(err);
      tgHaptics.notification("error");
      setError(err.message || "Submission failed. Please try again.");
      setStatus("idle");
    }
  };

  const handleAutoVerify = async () => {
    tgHaptics.impact("medium");

    if (!user?.uuid) {
      setError("Authentication required. Please reopen Payvora inside Telegram.");
      return;
    }
    if (!task || task.status !== "active") {
      setError("This task is no longer accepting completions.");
      return;
    }

    setError(null);
    setStatus("submitting");

    try {
      await invokeEdgeFunction("submit_task", {
        task_id: task.id,
      });

      setTask((prev) => {
        if (!prev) return prev;
        const nextCompleted = (prev.current_completions || 0) + 1;
        const maxC = prev.max_completions || 100;
        const pendingC = prev.pending_submissions || 0;
        return {
          ...prev,
          current_completions: nextCompleted,
          remaining_slots: Math.max(0, maxC - nextCompleted - pendingC),
        };
      });

      await refreshUser().catch(() => {});
      tgHaptics.notification("success");
      setStatus("success");
    } catch (err: any) {
      console.error(err);
      tgHaptics.notification("error");
      setError(err.message || "Verification failed. Make sure you have joined the channel and try again.");
      setStatus("idle");
    }
  };

  if (loadingTask) {
    return (
      <div className="space-y-4 pb-6">
        <button
          onClick={() => navigate("/tasks")}
          className="flex items-center gap-1.5 text-xs font-bold text-[#38bdf8] active:opacity-70"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tasks</span>
        </button>
        <PayvoraLoadingState message="Loading task details..." size="md" className="py-12" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-4 pb-6">
        <button
          onClick={() => navigate("/tasks")}
          className="flex items-center gap-1.5 text-xs font-bold text-[#38bdf8] active:opacity-70"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tasks</span>
        </button>
        <div className="card-glass-dark p-6 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="text-sm font-bold text-white">Task Unavailable</h3>
          <p className="text-xs text-slate-400">
            This task could not be found or is no longer active.
          </p>
        </div>
      </div>
    );
  }

  const maxSlots = task.max_completions || 100;
  const approvedSlots = task.current_completions || 0;
  const pendingSlots = task.pending_submissions || 0;
  const remainingSlots =
    typeof task.remaining_slots === "number"
      ? Math.max(0, task.remaining_slots)
      : Math.max(0, maxSlots - approvedSlots - pendingSlots);
  const isAutoTelegramJoin = task.verification_type === "auto_telegram_join";
  const derivedChatUrl =
    !task.target_url && task.verification_chat_id?.startsWith("@")
      ? `https://t.me/${task.verification_chat_id.slice(1)}`
      : null;
  const safeTargetUrl = isSafeHttpUrl(task.target_url || derivedChatUrl);

  return (
    <div className="space-y-4 pb-6">
      <button
        onClick={() => {
          tgHaptics.impact("light");
          navigate("/tasks");
        }}
        className="flex items-center gap-1.5 text-xs font-bold text-[#38bdf8] active:opacity-70"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Tasks</span>
      </button>

      {/* Task Info Card */}
      <div className="card-glass-dark p-4.5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-[#38bdf8] bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-full">
                {task.category || "Task"}
              </span>
              {isAutoTelegramJoin && (
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" />
                  <span>Instant Verify</span>
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-white mt-1.5 leading-snug">
              {task.title}
            </h2>
          </div>
          <div className="text-right shrink-0">
            <span className="badge-green-pill text-xs font-extrabold px-2.5 py-1 rounded-full tabular-nums">
              +${Number(task.reward || 0).toFixed(2)}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {task.description}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span className={remainingSlots === 0 ? "text-amber-400 font-semibold" : ""}>
              {remainingSlots}/{maxSlots} Slots Left
            </span>
          </div>
          {pendingSlots > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-300/90">{pendingSlots} in review</span>
            </>
          )}
          <span>·</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>~{task.job_length || 5} min</span>
          </div>
        </div>
      </div>

      {/* Instructions & Submission */}
      <div className="card-glass-dark p-4.5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Instructions
        </h3>

        {task.proof_instructions ? (
          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
            {task.proof_instructions}
          </p>
        ) : isAutoTelegramJoin ? (
          <ol className="space-y-2 text-xs text-slate-200">
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span>Tap &quot;Open Channel / Group&quot; below and join using this Telegram account.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span>Return here and tap &quot;Verify &amp; Claim&quot; for instant automatic verification.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span>Your reward is credited to your wallet immediately — no screenshot required.</span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-2 text-xs text-slate-200">
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-sky-500/20 text-[#38bdf8] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span>Open the task link and follow the requirements carefully.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-sky-500/20 text-[#38bdf8] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span>Take a clear screenshot showing task completion.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-sky-500/20 text-[#38bdf8] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span>Upload your screenshot proof below for verification.</span>
            </li>
          </ol>
        )}

        {safeTargetUrl && (
          <button
            type="button"
            onClick={() => {
              tgHaptics.impact("light");
              openTgLink(safeTargetUrl);
            }}
            className="w-full py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-[#38bdf8] font-bold text-xs text-center border border-sky-500/30 transition active:scale-98 shadow-sm flex items-center justify-center gap-1.5"
          >
            <span>{isAutoTelegramJoin ? "Open Channel / Group" : "Open Task Link"}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}

        {existingSubmission ? (
          <div
            className={`rounded-2xl p-4 text-center space-y-1.5 border ${
              existingSubmission.status === "approved"
                ? "bg-emerald-500/10 border-emerald-500/30"
                : existingSubmission.status === "pending"
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-rose-500/10 border-rose-500/30"
            }`}
          >
            <CheckCircle
              className={`w-7 h-7 mx-auto ${
                existingSubmission.status === "approved"
                  ? "text-emerald-400"
                  : existingSubmission.status === "pending"
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            />
            <h4 className="text-sm font-bold text-white capitalize">
              {existingSubmission.status === "approved"
                ? `Completed · +$${Number(task.reward || 0).toFixed(2)} Earned`
                : existingSubmission.status === "pending"
                ? `Pending Review · +$${Number(task.reward || 0).toFixed(2)}`
                : "Submission Declined"}
            </h4>
            <p className="text-xs text-slate-300">
              Submitted on {new Date(existingSubmission.submitted_at).toLocaleDateString()}.
              {existingSubmission.admin_comment ? ` Note: ${existingSubmission.admin_comment}` : ""}
            </p>
          </div>
        ) : status === "success" ? (
          <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <h4 className="text-sm font-bold text-white mb-0.5">
              {isAutoTelegramJoin ? "Verified & Credited!" : "Proof Submitted!"}
            </h4>
            <p className="text-xs text-slate-300">
              {isAutoTelegramJoin
                ? `+$${Number(task.reward || 0).toFixed(2)} has been added directly to your wallet balance.`
                : "Your proof has been received. Reward will be added to your balance once approved."}
            </p>
          </div>
        ) : task.status !== "active" || remainingSlots <= 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center text-xs text-amber-200">
            {pendingSlots > 0 && remainingSlots <= 0
              ? `All remaining slots (${pendingSlots}) are currently reserved by submissions under review.`
              : "All available slots for this task have been filled."}
          </div>
        ) : isAutoTelegramJoin ? (
          <div className="space-y-3 pt-2 border-t border-white/5">
            {error && (
              <div className="bg-rose-500/15 text-rose-300 px-3 py-2 text-xs rounded-xl border border-rose-500/30 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              disabled={status === "submitting"}
              onClick={handleAutoVerify}
              className="w-full py-3 btn-cyan-glow text-white text-center rounded-xl font-extrabold text-xs transition active:scale-98 disabled:opacity-50 shadow-lg shadow-sky-500/25 flex items-center justify-center gap-1.5"
            >
              {status === "submitting" ? (
                <>
                  <PayvoraSpinner size="sm" />
                  <span>Verifying Membership...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Verify &amp; Claim +${Number(task.reward || 0).toFixed(2)}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-white/5">
            {error && (
              <div className="bg-rose-500/15 text-rose-300 px-3 py-2 text-xs rounded-xl border border-rose-500/30 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Your Telegram Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@username"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0c162e] text-xs text-white focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Screenshot Proof
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                id="screenshot-upload"
                ref={fileInputRef}
                onChange={handleFileChange}
              />

              {previewUrl ? (
                <div className="relative border border-white/10 rounded-2xl overflow-hidden bg-[#0c162e] aspect-video flex items-center justify-center">
                  <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full active:scale-95"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="screenshot-upload"
                  className="border border-dashed border-white/15 rounded-2xl p-5 flex flex-col items-center justify-center text-slate-400 hover:border-sky-400 hover:text-sky-300 transition cursor-pointer active:scale-98 bg-[#0c162e]/50"
                >
                  <Upload className="w-6 h-6 mb-1.5 text-sky-400" />
                  <span className="text-xs font-semibold text-white">Tap to select screenshot</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP up to 5MB</span>
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full py-3 btn-cyan-glow text-white text-center rounded-xl font-extrabold text-xs transition active:scale-98 disabled:opacity-50 shadow-lg shadow-sky-500/25 flex items-center justify-center gap-1.5 mt-2"
            >
              {status === "submitting" ? (
                <>
                  <PayvoraSpinner size="sm" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Verification</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
