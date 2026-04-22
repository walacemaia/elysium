import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  CheckCircle,
  Edit2,
  Lock,
  Plus,
  Shield,
  UserMinus,
  X,
} from "lucide-react";
import React, { useState } from "react";
import type { Cofre } from "../backend.d";
import {
  useEditarCofre,
  useListarContatos,
  useObterUltimoAcesso,
  useRevogarAutorizacao,
} from "../hooks/useQueries";

interface EditCofreModalProps {
  cofre: Cofre;
  onClose: () => void;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDateTime(ts: bigint): string {
  const date = new Date(Number(ts) / 1_000_000);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deriveTempo(segundos: number): {
  valor: string;
  unidade: "minutos" | "horas" | "dias";
} {
  const dias = segundos / (24 * 60 * 60);
  const horas = segundos / (60 * 60);
  const minutos = segundos / 60;
  if (dias >= 1 && dias === Math.floor(dias))
    return { valor: String(Math.floor(dias)), unidade: "dias" };
  if (horas >= 1 && horas === Math.floor(horas))
    return { valor: String(Math.floor(horas)), unidade: "horas" };
  return { valor: String(Math.floor(minutos)), unidade: "minutos" };
}

// ─── component ──────────────────────────────────────────────────────────────

export default function EditCofreModal({
  cofre,
  onClose,
}: EditCofreModalProps) {
  const inicial = deriveTempo(Number(cofre.regrasAcesso.periodoInatividade));

  const [nome, setNome] = useState(cofre.nome);
  const [descricao, setDescricao] = useState(cofre.descricao);
  const [usuariosAutorizados, setUsuariosAutorizados] = useState<string[]>(
    cofre.regrasAcesso.usuariosAutorizados.map((p) => p.toString()),
  );
  const [periodoInatividade, setPeriodoInatividade] = useState(inicial.valor);
  const [unidadeTempo, setUnidadeTempo] = useState<
    "minutos" | "horas" | "dias"
  >(inicial.unidade);
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [userToRevoke, setUserToRevoke] = useState<string>("");

  const editarCofre = useEditarCofre();
  const revogarAutorizacao = useRevogarAutorizacao();
  const { data: contatos = [] } = useListarContatos();
  const { data: ultimoAcesso = BigInt(0) } = useObterUltimoAcesso(
    cofre.proprietario,
  );

  // ── sync period when cofre prop changes ──────────────────────────────────
  React.useEffect(() => {
    const t = deriveTempo(Number(cofre.regrasAcesso.periodoInatividade));
    setPeriodoInatividade(t.valor);
    setUnidadeTempo(t.unidade);
  }, [cofre.regrasAcesso.periodoInatividade]);

  // ── contact helpers ───────────────────────────────────────────────────────
  const getContactName = (pid: string) => {
    const c = contatos.find((x) => x.principalId.toString() === pid);
    return c ? c.nome : `${pid.slice(0, 10)}…`;
  };

  // ── user list mutations ───────────────────────────────────────────────────
  const adicionarUsuario = () =>
    setUsuariosAutorizados([...usuariosAutorizados, "__empty__"]);
  const removerUsuario = (index: number) =>
    setUsuariosAutorizados(usuariosAutorizados.filter((_, i) => i !== index));
  const atualizarUsuario = (index: number, valor: string) => {
    const nova = [...usuariosAutorizados];
    nova[index] = valor;
    setUsuariosAutorizados(nova);
  };

  // ── revoke ────────────────────────────────────────────────────────────────
  const handleRevokeUser = (pid: string) => {
    setUserToRevoke(pid);
    setShowRevokeDialog(true);
  };

  const confirmRevokeUser = async () => {
    try {
      await revogarAutorizacao.mutateAsync({
        idCofre: cofre.id,
        usuario: userToRevoke,
      });
      setShowRevokeDialog(false);
      setUserToRevoke("");
      setTimeout(onClose, 800);
    } catch (error: unknown) {
      console.error("Erro ao revogar autorização:", error);
    }
  };

  // ── save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      const usuariosValidos = usuariosAutorizados
        .filter((u) => u.trim() && u !== "__empty__")
        .map((u) => Principal.fromText(u.trim()));

      let segundos: bigint;
      if (unidadeTempo === "dias")
        segundos = BigInt(Number.parseInt(periodoInatividade) * 24 * 60 * 60);
      else if (unidadeTempo === "horas")
        segundos = BigInt(Number.parseInt(periodoInatividade) * 60 * 60);
      else segundos = BigInt(Number.parseInt(periodoInatividade) * 60);

      await editarCofre.mutateAsync({
        id: cofre.id,
        nome: nome.trim(),
        descricao: descricao.trim(),
        regras: {
          usuariosAutorizados: usuariosValidos,
          periodoInatividade: segundos,
        },
      });

      setIsEditing(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
    } catch (error: unknown) {
      console.error("Erro ao editar cofre:", error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setNome(cofre.nome);
    setDescricao(cofre.descricao);
    setUsuariosAutorizados(
      cofre.regrasAcesso.usuariosAutorizados.map((p) => p.toString()),
    );
  };

  const hasChanges = () => {
    const cur = usuariosAutorizados
      .filter((u) => u.trim() && u !== "__empty__")
      .map((u) => u.trim())
      .sort();
    const orig = cofre.regrasAcesso.usuariosAutorizados
      .map((p) => p.toString())
      .sort();
    let curSeg: number;
    if (unidadeTempo === "dias")
      curSeg = Number.parseInt(periodoInatividade) * 24 * 60 * 60;
    else if (unidadeTempo === "horas")
      curSeg = Number.parseInt(periodoInatividade) * 60 * 60;
    else curSeg = Number.parseInt(periodoInatividade) * 60;
    return (
      nome.trim() !== cofre.nome ||
      descricao.trim() !== cofre.descricao ||
      curSeg !== Number(cofre.regrasAcesso.periodoInatividade) ||
      JSON.stringify(cur) !== JSON.stringify(orig)
    );
  };

  const selectedPrincipals = usuariosAutorizados.filter(
    (u) => u && u !== "__empty__",
  );

  const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  // ── period display ────────────────────────────────────────────────────────
  const periodoDisplay = (() => {
    const seg = Number(cofre.regrasAcesso.periodoInatividade);
    const dias = seg / (24 * 60 * 60);
    const horas = seg / (60 * 60);
    const minutos = seg / 60;
    if (dias >= 1 && dias === Math.floor(dias))
      return `${Math.floor(dias)} dia${Math.floor(dias) !== 1 ? "s" : ""}`;
    if (horas >= 1 && horas === Math.floor(horas))
      return `${Math.floor(horas)} hora${Math.floor(horas) !== 1 ? "s" : ""}`;
    return `${Math.floor(minutos)} minuto${Math.floor(minutos) !== 1 ? "s" : ""}`;
  })();

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in"
        data-ocid="edit-cofre.modal"
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
      >
        <dialog
          open
          aria-label={isEditing ? "Editar Cofre" : "Visualizar Cofre"}
          className="glass-modal relative w-full min-h-full sm:min-h-0 sm:max-w-[540px] sm:rounded-2xl shadow-2xl glass-scrollbar animate-slide-up p-0 flex flex-col"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-border/40 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center bg-primary/15 border border-primary/25">
                {isEditing ? (
                  <Edit2 className="h-4 w-4 text-primary" />
                ) : (
                  <Shield className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-[20px] font-semibold text-foreground leading-tight truncate">
                  {isEditing ? "Editar Cofre" : cofre.nome}
                </h2>
                <p className="text-[11px] font-technical text-muted-foreground mt-0.5 truncate">
                  ID:{" "}
                  <span className="font-mono text-muted-foreground/70">
                    {String(cofre.id)}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {!isEditing && (
                <button
                  type="button"
                  aria-label="Editar cofre"
                  onClick={() => setIsEditing(true)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  data-ocid="edit-cofre.edit_button"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                aria-label="Fechar"
                onClick={onClose}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                data-ocid="edit-cofre.close_button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <div className="px-4 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-5 flex-1 overflow-y-auto glass-scrollbar dialog-body">
            {/* Success banner */}
            {showSuccess && (
              <Alert className="glass-card border-success/30 success-message">
                <CheckCircle className="h-4 w-4 text-success" />
                <AlertDescription className="text-foreground text-sm ml-2">
                  <strong>Sucesso!</strong> Alterações salvas com sucesso.
                </AlertDescription>
              </Alert>
            )}

            {/* Owner Principal ID */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Proprietário
              </p>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  background: "oklch(var(--muted) / 0.15)",
                  border: "1px solid oklch(var(--border) / 0.4)",
                }}
              >
                <Lock className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
                <span className="text-[12px] font-mono text-muted-foreground truncate min-w-0">
                  {cofre.proprietario.toString()}
                </span>
              </div>
            </div>

            {/* Nome */}
            <div className="space-y-1.5">
              <label
                htmlFor="edit-nome"
                className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
              >
                Nome do Cofre
                {isEditing && <span className="text-primary ml-1">*</span>}
              </label>
              {isEditing ? (
                <Input
                  id="edit-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do cofre"
                  required
                  className="glass-input w-full text-sm"
                  data-ocid="edit-cofre.nome.input"
                />
              ) : (
                <div
                  className="px-3 py-2 rounded-lg text-sm text-foreground"
                  style={{
                    background: "oklch(var(--muted) / 0.15)",
                    border: "1px solid oklch(var(--border) / 0.4)",
                  }}
                >
                  {cofre.nome}
                </div>
              )}
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <label
                htmlFor="edit-descricao"
                className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
              >
                Descrição
              </label>
              {isEditing ? (
                <Textarea
                  id="edit-descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                  placeholder="Descrição do cofre"
                  className="glass-input w-full text-sm resize-none"
                  data-ocid="edit-cofre.descricao.textarea"
                />
              ) : (
                <div
                  className="px-3 py-2 rounded-lg text-sm min-h-[72px] text-foreground"
                  style={{
                    background: "oklch(var(--muted) / 0.15)",
                    border: "1px solid oklch(var(--border) / 0.4)",
                  }}
                >
                  {cofre.descricao || (
                    <span className="text-muted-foreground italic">
                      Sem descrição
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Usuários Autorizados */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Usuários Autorizados
              </p>

              {isEditing ? (
                <div className="space-y-2">
                  {/* Chips */}
                  {selectedPrincipals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPrincipals.map((pid) => {
                        const label = getContactName(pid);
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

                  {/* Pending slots */}
                  {usuariosAutorizados.map((usuario, index) => {
                    if (usuario !== "__empty__") return null;
                    const slotKey = `edit-slot-pos-${index}`;
                    return (
                      <div key={slotKey} className="flex gap-2">
                        <Select
                          value={undefined}
                          onValueChange={(value) =>
                            atualizarUsuario(index, value)
                          }
                        >
                          <SelectTrigger
                            className="flex-1 glass-input text-sm"
                            data-ocid={`edit-cofre.usuario.select.${index + 1}`}
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
                        .length > 0
                    }
                    className="flex items-center gap-1.5 text-[13px] font-medium text-primary/80 hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    data-ocid="edit-cofre.add_usuario_button"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar usuário
                  </button>
                </div>
              ) : (
                /* View mode — authorized users with revoke button */
                <div className="space-y-1.5">
                  {cofre.regrasAcesso.usuariosAutorizados.length > 0 ? (
                    cofre.regrasAcesso.usuariosAutorizados.map((u, i) => (
                      <div
                        key={u.toString()}
                        className="flex items-center justify-between px-3 py-2 rounded-lg gap-2"
                        style={{
                          background: "oklch(var(--muted) / 0.15)",
                          border: "1px solid oklch(var(--border) / 0.4)",
                        }}
                        data-ocid={`edit-cofre.usuario.item.${i + 1}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-foreground truncate">
                            {getContactName(u.toString())}
                          </span>
                          <span className="text-[11px] font-technical text-muted-foreground/60 flex-shrink-0 hidden sm:block">
                            {u.toString().slice(0, 10)}…
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label={`Revogar ${getContactName(u.toString())}`}
                          onClick={() => handleRevokeUser(u.toString())}
                          className="flex-shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          data-ocid={`edit-cofre.revoke_button.${i + 1}`}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div
                      className="px-3 py-2 rounded-lg text-sm text-muted-foreground italic"
                      style={{
                        background: "oklch(var(--muted) / 0.15)",
                        border: "1px solid oklch(var(--border) / 0.4)",
                      }}
                    >
                      Nenhum usuário autorizado
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Período de Inatividade */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Período de Inatividade
              </p>
              {isEditing ? (
                <div className="flex gap-2">
                  <Input
                    id="edit-periodo"
                    type="number"
                    value={periodoInatividade}
                    onChange={(e) => setPeriodoInatividade(e.target.value)}
                    min="1"
                    className="flex-1 glass-input text-sm"
                    required
                    data-ocid="edit-cofre.periodo.input"
                  />
                  <Select
                    value={unidadeTempo}
                    onValueChange={(v: "minutos" | "horas" | "dias") =>
                      setUnidadeTempo(v)
                    }
                  >
                    <SelectTrigger
                      className="w-[120px] glass-input text-sm"
                      data-ocid="edit-cofre.periodo.select"
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
              ) : (
                <div
                  className="px-3 py-2 rounded-lg text-sm text-foreground"
                  style={{
                    background: "oklch(var(--muted) / 0.15)",
                    border: "1px solid oklch(var(--border) / 0.4)",
                  }}
                >
                  {periodoDisplay}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Após este período sem acesso global, usuários autorizados
                poderão acessar o cofre.
              </p>
            </div>

            {/* Último acesso */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Último Acesso Global do Proprietário
              </p>
              <div
                className="px-3 py-2 rounded-lg text-sm font-mono text-foreground"
                style={{
                  background: "oklch(var(--muted) / 0.15)",
                  border: "1px solid oklch(var(--border) / 0.4)",
                }}
              >
                {formatDateTime(ultimoAcesso)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Usado para determinar quando usuários autorizados podem acessar
                o cofre.
              </p>
            </div>

            {/* Footer buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 sm:pt-3 border-t border-border/40">
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancel}
                    className="w-full sm:w-auto glass-button-ghost text-sm font-medium"
                    data-ocid="edit-cofre.cancel_button"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={
                      !hasChanges() || editarCofre.isPending || !nome.trim()
                    }
                    className="w-full sm:w-auto glass-button-primary text-sm font-semibold disabled:opacity-50"
                    data-ocid="edit-cofre.save_button"
                  >
                    {editarCofre.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        Salvando…
                      </span>
                    ) : (
                      "Salvar Alterações"
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="w-full sm:w-auto glass-button-ghost text-sm font-medium"
                  data-ocid="edit-cofre.close_button"
                >
                  Fechar
                </Button>
              )}
            </div>
          </div>
        </dialog>
      </div>

      {/* Revoke confirmation dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent
          className="glass-modal border-border/50 rounded-2xl max-w-sm"
          data-ocid="edit-cofre.revoke.dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground font-semibold">
              Revogar Autorização
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm">
              Tem certeza que deseja revogar o acesso de{" "}
              <strong className="text-foreground">
                {getContactName(userToRevoke)}
              </strong>
              ? O usuário perderá o acesso imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="glass-button-ghost text-sm"
              data-ocid="edit-cofre.revoke.cancel_button"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevokeUser}
              disabled={revogarAutorizacao.isPending}
              className="glass-button-ghost text-destructive border-destructive/30 hover:bg-destructive/15 text-sm"
              data-ocid="edit-cofre.revoke.confirm_button"
            >
              {revogarAutorizacao.isPending ? "Revogando…" : "Revogar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
