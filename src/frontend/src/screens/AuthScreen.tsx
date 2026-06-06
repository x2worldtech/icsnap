import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Camera, Globe, Lock } from "lucide-react";
import { motion } from "motion/react";

const FEATURES = [
  { icon: Camera, text: "Capture and send photos in seconds" },
  { icon: Lock, text: "Snaps can only be opened once" },
  { icon: Globe, text: "Runs fully on the Internet Computer" },
];

export default function AuthScreen() {
  const { login, loginStatus } = useInternetIdentity();
  const isLoggingIn = loginStatus === "logging-in";

  return (
    <div className="dark relative h-full flex flex-col bg-background px-6 overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, oklch(var(--primary) / 0.18), transparent 65%)",
        }}
      />

      <div className="relative flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-4 mb-12"
        >
          <div className="w-[4.5rem] h-[4.5rem] rounded-[1.4rem] flex items-center justify-center gradient-avatar brand-glow">
            <svg width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <circle cx="20" cy="20" r="18" stroke="white" strokeWidth="2.5" />
              <circle cx="20" cy="20" r="8" fill="white" />
            </svg>
          </div>
          <h1 className="text-[2.75rem] leading-none font-extrabold tracking-tight brand-text">
            ICSnap
          </h1>
          <p className="text-muted-foreground text-center text-[0.9375rem] leading-relaxed max-w-[16rem]">
            Private, disappearing snaps on the Internet Computer.
          </p>
        </motion.div>

        {/* Features */}
        <div className="flex flex-col gap-5 w-full mb-2 px-2">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.1, duration: 0.4 }}
                className="flex items-center gap-4"
              >
                <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-[0.9375rem] text-foreground">{f.text}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="relative w-full max-w-sm mx-auto pb-10 flex flex-col items-center gap-4">
        <Button
          data-ocid="auth.primary_button"
          onClick={() => login()}
          disabled={isLoggingIn}
          className="w-full h-14 text-[1.0625rem] font-semibold rounded-2xl bg-primary text-primary-foreground brand-glow hover:opacity-95 transition-opacity"
        >
          {isLoggingIn ? "Connecting…" : "Continue with Internet Identity"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          No password, no email — just your Internet Identity.
        </p>
        <p className="text-[0.6875rem] text-muted-foreground/70 text-center pt-2">
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
