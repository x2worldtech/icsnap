import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Pencil, ShieldCheck, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  RetentionPolicy,
  useGetCallerUserProfile,
  useSaveProfile,
  useUpdateRetention,
} from "../hooks/useQueries";

export default function ProfileScreen() {
  const { identity, clear } = useInternetIdentity();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetCallerUserProfile();
  const updateRetention = useUpdateRetention();
  const saveProfile = useSaveProfile();

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");

  const principal = identity?.getPrincipal().toString() ?? "";
  const isForever = profile?.retention === RetentionPolicy.forever;

  const handleRetentionToggle = async (checked: boolean) => {
    const policy = checked
      ? RetentionPolicy.forever
      : RetentionPolicy.deleteAfter24h;
    try {
      await updateRetention.mutateAsync(policy);
      toast.success(
        checked
          ? "Messages are now kept forever"
          : "Messages will be deleted after 24 hours",
      );
    } catch {
      toast.error("Couldn't save setting");
    }
  };

  const handleEditUsername = () => {
    setUsernameInput(profile?.username ?? "");
    setEditingUsername(true);
  };

  const handleSaveUsername = async () => {
    if (!usernameInput.trim() || !profile) return;
    try {
      await saveProfile.mutateAsync({
        username: usernameInput.trim(),
        retention: profile.retention,
      });
      setEditingUsername(false);
      toast.success("Username updated");
    } catch {
      toast.error("Couldn't save");
    }
  };

  const handleCopyPrincipal = async () => {
    if (!principal) return;
    try {
      await navigator.clipboard.writeText(principal);
      toast.success("Principal ID copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const handleLogout = async () => {
    await clear();
    queryClient.clear();
  };

  const username = profile?.username ?? "";
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="px-5 pt-14 pb-2">
        <h1 className="text-[1.75rem] font-extrabold tracking-tight text-foreground">
          Profile
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-28 flex flex-col gap-6">
        {/* Identity */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 pt-6 pb-2"
        >
          <Avatar className="w-24 h-24 brand-glow">
            <AvatarFallback className="gradient-avatar text-white text-3xl font-bold">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>

          {editingUsername ? (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <Input
                data-ocid="profile.input"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveUsername()}
                className="flex-1 text-center bg-card border-border text-foreground rounded-xl"
                autoFocus
              />
              <button
                type="button"
                data-ocid="profile.save_button"
                onClick={handleSaveUsername}
                disabled={saveProfile.isPending}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-primary-foreground shrink-0"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                data-ocid="profile.cancel_button"
                onClick={() => setEditingUsername(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary shrink-0"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-ocid="profile.edit_button"
              onClick={handleEditUsername}
              className="flex items-center gap-2 group"
            >
              <span className="text-2xl font-bold text-foreground">
                {username || "Set a username"}
              </span>
              <Pencil className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          )}
        </motion.div>

        {/* Privacy */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Privacy
            </h2>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label className="text-foreground font-medium">
                  Keep messages forever
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isForever
                    ? "Messages are stored permanently"
                    : "Messages are deleted after 24 hours"}
                </p>
              </div>
              <Switch
                data-ocid="profile.switch"
                checked={isForever}
                onCheckedChange={handleRetentionToggle}
                disabled={updateRetention.isPending || isLoading}
              />
            </div>
          </div>
        </section>

        {/* Account */}
        <section className="flex flex-col gap-3">
          <div className="px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account
            </h2>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 flex flex-col gap-3">
            <span className="text-sm font-medium text-foreground">
              Principal ID
            </span>
            <div className="flex items-center gap-3">
              <code className="flex-1 min-w-0 text-xs font-mono text-muted-foreground break-all leading-relaxed">
                {principal || "—"}
              </code>
              <button
                type="button"
                onClick={handleCopyPrincipal}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-secondary hover:bg-muted transition-colors shrink-0"
                aria-label="Copy Principal ID"
              >
                <Copy className="w-4 h-4 text-foreground" />
              </button>
            </div>
          </div>
        </section>

        {/* Sign out */}
        <Button
          data-ocid="profile.delete_button"
          variant="ghost"
          onClick={handleLogout}
          className="w-full h-12 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive font-medium"
        >
          Sign out
        </Button>

        <p className="text-[0.6875rem] text-muted-foreground/70 text-center pt-1">
          © {new Date().getFullYear()} ICSnap · Built on{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
