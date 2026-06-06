import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { useRegister } from "../hooks/useQueries";

export default function RegisterModal() {
  const [username, setUsername] = useState("");
  const register = useRegister();

  const handleSubmit = async () => {
    if (!username.trim()) return;
    try {
      await register.mutateAsync(username.trim());
      toast.success("Welcome to ICSnap!");
    } catch {
      toast.error("Username already taken or invalid");
    }
  };

  return (
    <Dialog open>
      <DialogContent
        data-ocid="register.dialog"
        className="bg-card border-border text-foreground max-w-sm rounded-3xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            Choose a username
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <p className="text-sm text-muted-foreground text-center">
            Pick a username so others can find you.
          </p>
          <Input
            data-ocid="register.input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="e.g. snapstar42"
            className="bg-background border-border text-foreground text-center rounded-xl"
            autoFocus
          />
          <Button
            data-ocid="register.submit_button"
            onClick={handleSubmit}
            disabled={!username.trim() || register.isPending}
            className="w-full rounded-2xl py-5 font-semibold bg-primary text-primary-foreground brand-glow hover:opacity-95 transition-opacity"
          >
            {register.isPending ? "Creating profile…" : "Get started"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
