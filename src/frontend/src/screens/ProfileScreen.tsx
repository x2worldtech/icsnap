import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Edit2, LogOut, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  RetentionPolicy,
  useGetCallerUserProfile,
  useSaveProfile,
  useUpdateRetention,
} from "../hooks/useQueries";

export default function ProfileScreen() {
  const { clear } = useInternetIdentity();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetCallerUserProfile();
  const updateRetention = useUpdateRetention();
  const saveProfile = useSaveProfile();

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");

  const isForever = profile?.retention === RetentionPolicy.forever;

  const handleRetentionToggle = async (checked: boolean) => {
    const policy = checked
      ? RetentionPolicy.forever
      : RetentionPolicy.deleteAfter24h;
    try {
      await updateRetention.mutateAsync(policy);
      toast.success(
        checked
          ? "Nachrichten werden dauerhaft gespeichert"
          : "Nachrichten werden nach 24h gelöscht",
      );
    } catch {
      toast.error("Einstellung konnte nicht gespeichert werden");
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
      toast.success("Nutzername aktualisiert");
    } catch {
      toast.error("Fehler beim Speichern");
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
      <header className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Profil</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-4">
        {/* Avatar + username */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 py-6"
        >
          <Avatar className="w-24 h-24 purple-glow">
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
                className="flex-1 text-center bg-card border-border text-foreground"
                autoFocus
              />
              <button
                type="button"
                data-ocid="profile.save_button"
                onClick={handleSaveUsername}
                disabled={saveProfile.isPending}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "oklch(0.55 0.22 293)" }}
              >
                <Check className="w-4 h-4 text-white" />
              </button>
              <button
                type="button"
                data-ocid="profile.cancel_button"
                onClick={() => setEditingUsername(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-muted"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-foreground">
                {username || "Kein Name"}
              </span>
              <button
                type="button"
                data-ocid="profile.edit_button"
                onClick={handleEditUsername}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-card"
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </motion.div>

        {/* Settings card */}
        <div className="bg-card rounded-2xl border border-border p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Datenschutz
          </h2>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label className="text-foreground font-medium">
                Nachrichten behalten
              </Label>
              <p className="text-xs text-muted-foreground">
                {isForever
                  ? "Deine Nachrichten werden dauerhaft gespeichert"
                  : "Deine Nachrichten werden nach 24h gelöscht"}
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

        {/* Principal ID */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">
            Deine Principal ID
          </h2>
          <p className="text-xs text-foreground/60 font-mono break-all">
            Zur Anzeige einloggen und im Chat-Header nachsehen
          </p>
        </div>

        {/* Logout */}
        <Button
          data-ocid="profile.delete_button"
          variant="outline"
          onClick={handleLogout}
          className="w-full rounded-2xl border-destructive text-destructive hover:bg-destructive/10 mt-2"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Abmelden
        </Button>

        {/* Footer */}
        <p className="text-xs text-muted-foreground text-center pt-4">
          © {new Date().getFullYear()}. Gebaut mit ❤️ via{" "}
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
