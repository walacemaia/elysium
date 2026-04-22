import { Label } from "@/components/ui/label";
import { Vault } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useSaveCallerUserProfile } from "../hooks/useQueries";

export default function ProfileSetup() {
  const [name, setName] = useState("");
  const { identity } = useInternetIdentity();
  const saveProfile = useSaveCallerUserProfile();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && identity) {
      saveProfile.mutate({
        name: name.trim(),
        principalId: identity.getPrincipal().toString(),
      });
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12">
      <div className="glass-modal w-full max-w-sm p-8 animate-fade-in">
        {/* Logo mark */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="flex items-center justify-center h-16 w-16 rounded-2xl mb-5 animate-pulse-glow"
            style={{
              background: "oklch(62% 0.18 230 / 0.12)",
              border: "1px solid oklch(62% 0.18 230 / 0.3)",
            }}
          >
            <Vault
              className="h-8 w-8"
              style={{ color: "oklch(62% 0.18 230)" }}
            />
          </div>

          <h1
            className="text-2xl font-bold mb-1"
            style={{
              background:
                "linear-gradient(135deg, oklch(72% 0.15 210), oklch(62% 0.18 230))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Elysium
          </h1>

          <h2 className="text-base font-semibold text-foreground mt-3 mb-1">
            Configure seu perfil
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            Como você gostaria de ser identificado nos cofres?
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label
              htmlFor="profile-name"
              className="text-sm font-medium text-foreground"
            >
              Seu nome
            </Label>
            <input
              type="text"
              id="profile-name"
              data-ocid="profile_setup.input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass-input w-full h-10 px-3 text-sm"
              placeholder="Digite seu nome"
              autoComplete="name"
              required
            />
          </div>

          <button
            type="submit"
            data-ocid="profile_setup.submit_button"
            disabled={!name.trim() || saveProfile.isPending || !identity}
            className="glass-button-primary w-full h-10 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {saveProfile.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                Salvando...
              </span>
            ) : (
              "Continuar"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
