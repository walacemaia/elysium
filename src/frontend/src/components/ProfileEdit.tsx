import { Label } from "@/components/ui/label";
import { CheckCircle, Copy, Save, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useGetCallerUserProfile,
  useSaveCallerUserProfile,
} from "../hooks/useQueries";

interface ProfileEditProps {
  onClose: () => void;
}

export default function ProfileEdit({ onClose }: ProfileEditProps) {
  const [name, setName] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const { identity } = useInternetIdentity();
  const { data: userProfile, isLoading } = useGetCallerUserProfile();
  const saveProfile = useSaveCallerUserProfile();

  const principalId = identity?.getPrincipal().toString() ?? "";

  useEffect(() => {
    if (userProfile) setName(userProfile.name);
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !identity) return;
    try {
      await saveProfile.mutateAsync({
        name: name.trim(),
        principalId,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1800);
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
    }
  };

  const handleCopy = () => {
    if (principalId) {
      navigator.clipboard.writeText(principalId).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const hasChanges = userProfile ? name.trim() !== userProfile.name : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="glass-modal w-full min-h-full sm:min-h-0 sm:max-w-sm sm:rounded-2xl animate-fade-in flex flex-col"
        data-ocid="profile_edit.dialog"
        aria-labelledby="profile-edit-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/40 flex-shrink-0">
          <h2
            id="profile-edit-title"
            className="text-base font-semibold text-foreground"
          >
            Editar Perfil
          </h2>
          <button
            type="button"
            data-ocid="profile_edit.close_button"
            onClick={onClose}
            className="glass-button-ghost p-2 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 flex-1 overflow-y-auto dialog-body">
          {isLoading ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <span className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary" />
              <p className="text-sm text-muted-foreground">
                Carregando perfil...
              </p>
            </div>
          ) : (
            <>
              {/* Success banner */}
              {showSuccess && (
                <div
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-5 success-message"
                  style={{
                    background: "oklch(62% 0.18 150 / 0.1)",
                    border: "1px solid oklch(62% 0.18 150 / 0.3)",
                  }}
                  data-ocid="profile_edit.success_state"
                >
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  <p
                    className="text-sm font-medium"
                    style={{ color: "oklch(62% 0.18 150)" }}
                  >
                    Perfil atualizado com sucesso!
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name field */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-name"
                    className="text-sm font-medium text-foreground"
                  >
                    Nome
                  </Label>
                  <input
                    type="text"
                    id="edit-name"
                    data-ocid="profile_edit.input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="glass-input w-full h-10 px-3 text-sm"
                    required
                  />
                </div>

                {/* Principal ID read-only */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">
                    Seu Principal ID
                  </Label>
                  <div className="glass-card rounded-lg px-3 py-2.5 flex items-center gap-2">
                    <span
                      className="flex-1 text-xs font-mono text-muted-foreground break-all leading-relaxed"
                      aria-label="Principal ID"
                    >
                      {principalId || "Não disponível"}
                    </span>
                    {principalId && (
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors p-1 rounded"
                        aria-label="Copiar Principal ID"
                        title="Copiar"
                      >
                        {copied ? (
                          <CheckCircle
                            className="h-3.5 w-3.5"
                            style={{ color: "oklch(62% 0.18 150)" }}
                          />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Identificador único na rede. Compartilhe para receber acesso
                    a cofres.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    data-ocid="profile_edit.cancel_button"
                    onClick={onClose}
                    disabled={saveProfile.isPending}
                    className="glass-button-ghost flex-1 h-10 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    data-ocid="profile_edit.save_button"
                    disabled={
                      !hasChanges || !name.trim() || saveProfile.isPending
                    }
                    className="glass-button-primary flex-1 h-10 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                  >
                    {saveProfile.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white" />
                        Salvando...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Save className="h-4 w-4" />
                        Salvar
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
