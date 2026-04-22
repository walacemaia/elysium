import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Principal } from "@dfinity/principal";
import { AlertCircle, Plus, Shield, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { useCriarCofre, useListarContatos } from "../hooks/useQueries";

interface CriarCofreModalProps {
  onClose: () => void;
}

export default function CriarCofreModal({ onClose }: CriarCofreModalProps) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [usuariosAutorizados, setUsuariosAutorizados] = useState<string[]>([]);
  const [periodoInatividade, setPeriodoInatividade] = useState("7");
  const [desativarPeriodo, setDesativarPeriodo] = useState(false);
  const [unidadeTempo, setUnidadeTempo] = useState<
    "minutos" | "horas" | "dias"
  >("dias");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const criarCofre = useCriarCofre();
  const { data: contatos = [] } = useListarContatos();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      toast.error("Nome do cofre é obrigatório");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const usuariosValidos: Principal[] = [];
      for (const user of usuariosAutorizados) {
        if (user.trim() && user !== "__empty__") {
          try {
            usuariosValidos.push(Principal.fromText(user.trim()));
          } catch {
            toast.error(`Principal ID inválido: ${user.slice(0, 20)}...`);
            setIsSubmitting(false);
            return;
          }
        }
      }

      let segundos: bigint = BigInt(0);
      if (!desativarPeriodo) {
        const periodo = Number.parseInt(periodoInatividade);
        if (Number.isNaN(periodo) || periodo <= 0) {
          toast.error("Período de inatividade deve ser um número positivo");
          setIsSubmitting(false);
          return;
        }
        if (unidadeTempo === "dias") segundos = BigInt(periodo * 24 * 60 * 60);
        else if (unidadeTempo === "horas") segundos = BigInt(periodo * 60 * 60);
        else segundos = BigInt(periodo * 60);
      }

      await criarCofre.mutateAsync({
        nome: nome.trim(),
        descricao: descricao.trim(),
        regras: {
          usuariosAutorizados: usuariosValidos,
          periodoInatividade: segundos,
        },
      });

      toast.success("Cofre criado com sucesso!");
      onClose();
    } catch (error: unknown) {
      const err = error as { message?: string };
      let msg = "Erro ao criar cofre. Tente novamente.";
      if (err?.message) {
        if (err.message.includes("Actor not available"))
          msg = "Conexão com o backend perdida.";
        else if (err.message.includes("Apenas usuários autenticados"))
          msg = "Você precisa estar logado.";
        else if (err.message.includes("Principal"))
          msg = "Um ou mais IDs de usuário são inválidos.";
        else msg = `Erro: ${err.message}`;
      }
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const adicionarUsuario = () =>
    setUsuariosAutorizados([...usuariosAutorizados, "__empty__"]);
  const removerUsuario = (index: number) =>
    setUsuariosAutorizados(usuariosAutorizados.filter((_, i) => i !== index));
  const atualizarUsuario = (index: number, valor: string) => {
    const nova = [...usuariosAutorizados];
    nova[index] = valor;
    setUsuariosAutorizados(nova);
  };

  const isFormValid =
    nome.trim().length > 0 &&
    (desativarPeriodo ||
      (!Number.isNaN(Number.parseInt(periodoInatividade)) &&
        Number.parseInt(periodoInatividade) > 0));

  const selectedPrincipals = usuariosAutorizados.filter(
    (u) => u && u !== "__empty__",
  );

  const handleBackdropClick = () => {
    if (!isSubmitting) onClose();
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !isSubmitting) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in"
      data-ocid="criar-cofre.modal"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
    >
      <dialog
        open
        aria-label="Criar Novo Cofre"
        className="glass-modal relative w-full min-h-full sm:min-h-0 sm:max-w-[540px] sm:rounded-2xl shadow-2xl glass-scrollbar animate-slide-up p-0 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-border/40 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center bg-primary/15 border border-primary/25">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-[20px] font-semibold text-foreground leading-tight truncate">
              Criar Novo Cofre
            </h2>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-shrink-0 ml-3 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            data-ocid="criar-cofre.close_button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable form body ───────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="px-4 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-5 flex-1 overflow-y-auto glass-scrollbar dialog-body"
        >
          {/* Nome */}
          <div className="space-y-1.5">
            <label
              htmlFor="criar-nome"
              className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
            >
              Nome do Cofre <span className="text-primary">*</span>
            </label>
            <Input
              id="criar-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Documentos Pessoais"
              required
              disabled={isSubmitting}
              className="glass-input w-full text-sm"
              data-ocid="criar-cofre.nome.input"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label
              htmlFor="criar-descricao"
              className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
            >
              Descrição
            </label>
            <Textarea
              id="criar-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Descreva o conteúdo deste cofre..."
              disabled={isSubmitting}
              className="glass-input w-full text-sm resize-none"
              data-ocid="criar-cofre.descricao.textarea"
            />
          </div>

          {/* Usuários Autorizados */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Usuários Autorizados
            </p>

            {contatos.length === 0 ? (
              <Alert className="glass-card border-warning/30">
                <AlertCircle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-foreground/80 text-sm ml-2">
                  Você não tem contatos registrados. Adicione contatos na aba
                  "Contatos" para autorizar o acesso ao cofre.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {/* Confirmed user chips */}
                {selectedPrincipals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPrincipals.map((pid) => {
                      const contato = contatos.find(
                        (c) => c.principalId.toString() === pid,
                      );
                      const label = contato
                        ? contato.nome
                        : `${pid.slice(0, 8)}…`;
                      return (
                        <span
                          key={pid}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-medium text-foreground"
                          style={{
                            background: "oklch(var(--primary) / 0.12)",
                            border: "1px solid oklch(var(--primary) / 0.25)",
                          }}
                        >
                          {label}
                          <button
                            type="button"
                            aria-label={`Remover ${label}`}
                            onClick={() => {
                              const idx = usuariosAutorizados.indexOf(pid);
                              if (idx !== -1) removerUsuario(idx);
                            }}
                            className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Pending empty slots */}
                {usuariosAutorizados.map((usuario, index) => {
                  if (usuario !== "__empty__") return null;
                  const slotKey = `slot-${index}`;
                  return (
                    <div key={slotKey} className="flex gap-2">
                      <Select
                        value={undefined}
                        onValueChange={(value) =>
                          atualizarUsuario(index, value)
                        }
                        disabled={isSubmitting}
                      >
                        <SelectTrigger
                          className="flex-1 glass-input text-sm"
                          data-ocid={`criar-cofre.usuario.select.${index + 1}`}
                        >
                          <SelectValue placeholder="Selecione um contato" />
                        </SelectTrigger>
                        <SelectContent className="glass-modal border-border/50">
                          {contatos
                            .filter(
                              (c) =>
                                !selectedPrincipals.includes(
                                  c.principalId.toString(),
                                ),
                            )
                            .map((c) => (
                              <SelectItem
                                key={c.principalId.toString()}
                                value={c.principalId.toString()}
                                className="text-foreground hover:bg-primary/10 focus:bg-primary/20"
                              >
                                <div className="flex justify-between items-center w-full min-w-0 gap-2">
                                  <span className="font-medium truncate">
                                    {c.nome}
                                  </span>
                                  <span className="text-xs text-muted-foreground font-technical flex-shrink-0">
                                    {c.principalId.toString().slice(0, 8)}…
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        aria-label="Remover slot"
                        onClick={() => removerUsuario(index)}
                        disabled={isSubmitting}
                        className="h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={adicionarUsuario}
                  disabled={
                    usuariosAutorizados.filter((u) => u === "__empty__")
                      .length > 0 ||
                    selectedPrincipals.length >= contatos.length ||
                    isSubmitting
                  }
                  className="flex items-center gap-1.5 text-[13px] font-medium text-primary/80 hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  data-ocid="criar-cofre.add_usuario_button"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar usuário
                </button>
              </div>
            )}
          </div>

          {/* Período de Inatividade */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Período de Inatividade
              </span>
              <button
                type="button"
                onClick={() => setDesativarPeriodo(!desativarPeriodo)}
                className="text-[12px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                data-ocid="criar-cofre.periodo.toggle"
              >
                {desativarPeriodo ? "Ativar" : "Desativar"}
              </button>
            </div>

            {!desativarPeriodo ? (
              <>
                <div className="flex gap-2">
                  <Input
                    id="criar-periodo"
                    type="number"
                    value={periodoInatividade}
                    onChange={(e) => setPeriodoInatividade(e.target.value)}
                    min="1"
                    className="flex-1 glass-input text-sm"
                    required
                    disabled={isSubmitting}
                    data-ocid="criar-cofre.periodo.input"
                  />
                  <Select
                    value={unidadeTempo}
                    onValueChange={(v: "minutos" | "horas" | "dias") =>
                      setUnidadeTempo(v)
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      className="w-[120px] glass-input text-sm"
                      data-ocid="criar-cofre.periodo.select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-modal border-border/50">
                      <SelectItem
                        value="minutos"
                        className="text-foreground hover:bg-primary/10 focus:bg-primary/20"
                      >
                        Minutos
                      </SelectItem>
                      <SelectItem
                        value="horas"
                        className="text-foreground hover:bg-primary/10 focus:bg-primary/20"
                      >
                        Horas
                      </SelectItem>
                      <SelectItem
                        value="dias"
                        className="text-foreground hover:bg-primary/10 focus:bg-primary/20"
                      >
                        Dias
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Após este período sem acesso, usuários autorizados poderão
                  acessar o cofre.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground/60 italic">
                Período desativado — apenas o proprietário terá acesso.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 sm:pt-3 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto glass-button-ghost text-sm font-medium"
              data-ocid="criar-cofre.cancel_button"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="w-full sm:w-auto glass-button-primary text-sm font-semibold disabled:opacity-50"
              data-ocid="criar-cofre.submit_button"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Criando…
                </span>
              ) : (
                "Criar Cofre"
              )}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
