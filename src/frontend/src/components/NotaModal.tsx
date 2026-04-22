import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Eye, Info, Lock, LockOpen, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DecryptedNota } from "../hooks/useQueries";
import { useEditarNota } from "../hooks/useQueries";

interface NotaModalProps {
  nota: DecryptedNota;
  cofreId: bigint;
  isReadOnly?: boolean;
  onClose: () => void;
  onNotaUpdated?: () => void;
}

export default function NotaModal({
  nota,
  cofreId,
  isReadOnly = false,
  onClose,
  onNotaUpdated,
}: NotaModalProps) {
  const [titulo, setTitulo] = useState(nota.titulo);
  const [conteudo, setConteudo] = useState(nota.conteudo);
  const titleRef = useRef<HTMLInputElement>(null);
  const editarNota = useEditarNota();

  useEffect(() => {
    setTitulo(nota.titulo);
    setConteudo(nota.conteudo);
  }, [nota]);

  // Focus title on open if editable
  useEffect(() => {
    if (!isReadOnly && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isReadOnly]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1_000_000);
    return date.toLocaleString("pt-BR");
  };

  const hasChanges =
    titulo.trim() !== nota.titulo || conteudo.trim() !== nota.conteudo;

  const handleSave = async () => {
    if (!titulo.trim() || !conteudo.trim() || !hasChanges) return;
    try {
      await editarNota.mutateAsync({
        idCofre: cofreId,
        idNota: nota.id,
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
      });
      onNotaUpdated?.();
      onClose();
    } catch {
      // Error handled via toast in useQueries
    }
  };

  const handleCancel = () => {
    setTitulo(nota.titulo);
    setConteudo(nota.conteudo);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4 z-[60]"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      data-ocid="nota.dialog"
    >
      <div className="glass-modal w-full min-h-full sm:min-h-0 sm:max-w-2xl sm:max-h-[88vh] sm:rounded-2xl flex flex-col animate-fade-in overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-start gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-border/40 shrink-0">
          <div className="flex-1 min-w-0">
            {isReadOnly ? (
              <h2 className="text-lg font-semibold text-foreground leading-snug break-words">
                {nota.titulo}
              </h2>
            ) : (
              <input
                ref={titleRef}
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título da nota"
                className="glass-input w-full text-lg font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none px-3 py-1.5"
                data-ocid="nota.title_input"
                disabled={editarNota.isPending}
              />
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            {isReadOnly && (
              <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground border border-border/40 glass-card">
                <Eye className="h-3 w-3" />
                Somente leitura
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              data-ocid="nota.close_button"
              aria-label="Fechar nota"
              className="glass-button-ghost p-2 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto glass-scrollbar dialog-body px-4 sm:px-5 py-3 sm:py-4 flex flex-col gap-3 sm:gap-4 min-h-0">
          {/* Encryption badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {nota.isEncrypted ? (
              <span
                className="badge-encrypted inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                title="Nota criptografada com vetkeys"
                data-ocid="nota.encrypted_badge"
              >
                <Lock className="h-3 w-3" />
                Criptografada
              </span>
            ) : (
              <span
                className="badge-plaintext inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                title="Nota em texto não criptografado"
                data-ocid="nota.plaintext_badge"
              >
                <LockOpen className="h-3 w-3" />
                Texto puro
              </span>
            )}
          </div>

          {/* Plaintext alert */}
          {!nota.isEncrypted && (
            <Alert className="glass-card border-warning/20 py-3">
              <Info className="h-4 w-4 text-warning shrink-0" />
              <AlertDescription className="text-warning/90 text-sm ml-2">
                Esta nota está em texto não criptografado.
              </AlertDescription>
            </Alert>
          )}

          {/* Content */}
          {isReadOnly ? (
            <div className="glass rounded-xl p-4 border border-border/30 flex-1 min-h-[160px]">
              <p className="whitespace-pre-wrap text-foreground leading-relaxed text-sm sm:text-base">
                {nota.conteudo}
              </p>
            </div>
          ) : (
            <textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Conteúdo da nota..."
              disabled={editarNota.isPending}
              data-ocid="nota.content_textarea"
              rows={10}
              className="glass-input text-foreground placeholder:text-muted-foreground resize-none min-h-[200px] flex-1 leading-relaxed text-sm sm:text-[15px] w-full px-3 py-3 focus:outline-none"
              style={{ lineHeight: "1.6" }}
            />
          )}

          {/* Timestamps */}
          <div className="pt-2 border-t border-border/30 flex flex-wrap gap-x-6 gap-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono text-[11px] sm:text-xs">
                Criada em: {formatDate(nota.dataCriacao)}
              </span>
            </div>
            {nota.dataModificacao !== nota.dataCriacao && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono text-[11px] sm:text-xs">
                  Modificada em: {formatDate(nota.dataModificacao)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-border/40 flex gap-3 justify-end shrink-0">
          {isReadOnly ? (
            <button
              type="button"
              onClick={onClose}
              data-ocid="nota.close_button"
              className="glass-button-ghost min-w-[96px] px-5 py-2"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancel}
                data-ocid="nota.cancel_button"
                disabled={editarNota.isPending}
                className="glass-button-ghost px-5 py-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                data-ocid="nota.save_button"
                disabled={
                  !hasChanges ||
                  !titulo.trim() ||
                  !conteudo.trim() ||
                  editarNota.isPending
                }
                className="glass-button-primary min-w-[140px] px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                {editarNota.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white" />
                    Salvando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="h-3.5 w-3.5" />
                    Salvar alterações
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
