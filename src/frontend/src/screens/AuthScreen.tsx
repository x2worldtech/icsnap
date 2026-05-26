import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export default function AuthScreen() {
  const { login, loginStatus } = useInternetIdentity();
  const isLoggingIn = loginStatus === "logging-in";

  return (
    <div className="dark h-full flex flex-col items-center justify-center bg-background px-6">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 20%, oklch(0.55 0.22 293 / 0.15), transparent)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center gap-8 w-full max-w-xs relative"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center purple-glow"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.55 0.22 293), oklch(0.45 0.2 280))",
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="20" cy="20" r="18" stroke="white" strokeWidth="2.5" />
              <circle cx="20" cy="20" r="8" fill="white" />
              <circle cx="30" cy="10" r="4" fill="oklch(0.75 0.18 75)" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            ICSnap
          </h1>
          <p className="text-muted-foreground text-center text-sm leading-relaxed">
            Privates, sicheres Teilen auf dem Internet Computer.
            <br />
            Snaps verschwinden. Deine Privatsphäre bleibt.
          </p>
        </div>

        {/* Features */}
        <div className="flex flex-col gap-3 w-full">
          {[
            { icon: "📸", text: "Fotos direkt aufnehmen & senden" },
            { icon: "🔒", text: "Snaps öffnen sich nur einmal" },
            { icon: "🌐", text: "Dezentral auf dem ICP" },
          ].map((f, i) => (
            <motion.div
              key={f.text}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
              className="flex items-center gap-3 bg-card rounded-xl px-4 py-3 border border-border"
            >
              <span className="text-lg">{f.icon}</span>
              <span className="text-sm text-foreground/80">{f.text}</span>
            </motion.div>
          ))}
        </div>

        {/* Login button */}
        <Button
          data-ocid="auth.primary_button"
          onClick={() => login()}
          disabled={isLoggingIn}
          className="w-full py-6 text-base font-semibold rounded-2xl purple-glow"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.55 0.22 293), oklch(0.48 0.2 280))",
          }}
        >
          {isLoggingIn ? "Verbinde..." : "Mit Internet Identity anmelden"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Kein Passwort. Keine E-Mail. Nur dein ICP-Key.
        </p>
      </motion.div>

      {/* Footer */}
      <p className="absolute bottom-6 text-xs text-muted-foreground">
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
  );
}
