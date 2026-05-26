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
      toast.success("Willkommen bei ICSnap!");
    } catch {
      toast.error("Nutzername bereits vergeben oder ungültig");
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
            Nutzername wählen
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <p className="text-sm text-muted-foreground text-center">
            Wähle einen Nutzernamen, damit andere dich finden können.
          </p>
          <Input
            data-ocid="register.input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="z.B. snapstar42"
            className="bg-background border-border text-foreground text-center rounded-xl"
            autoFocus
          />
          <Button
            data-ocid="register.submit_button"
            onClick={handleSubmit}
            disabled={!username.trim() || register.isPending}
            className="w-full rounded-2xl py-5 font-semibold"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.55 0.22 293), oklch(0.48 0.2 280))",
            }}
          >
            {register.isPending ? "Erstelle Profil..." : "Loslegen 🚀"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
