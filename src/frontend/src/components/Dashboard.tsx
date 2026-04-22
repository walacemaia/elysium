import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Shield, Users, Vault } from "lucide-react";
import { useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useListarCofres } from "../hooks/useQueries";
import CofreCard from "./CofreCard";
import CriarCofreModal from "./CriarCofreModal";

// Skeleton for a single card while loading
function CofreCardSkeleton() {
  return (
    <div
      className="glass-card card-uniform rounded-2xl p-5 relative overflow-hidden"
      style={{ minHeight: "240px" }}
      aria-hidden="true"
    >
      {/* Top: icon + name */}
      <div className="flex items-start space-x-3 mb-4">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0 bg-muted/30" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4 rounded-md bg-muted/30" />
          <Skeleton className="h-3 w-1/3 rounded-md bg-muted/20" />
        </div>
      </div>

      {/* Middle: description */}
      <div className="flex-1 space-y-2 mb-4">
        <Skeleton className="h-3.5 w-full rounded-md bg-muted/20" />
        <Skeleton className="h-3.5 w-5/6 rounded-md bg-muted/20" />
        <div className="flex space-x-3 mt-3">
          <Skeleton className="h-3 w-14 rounded-md bg-muted/15" />
          <Skeleton className="h-3 w-14 rounded-md bg-muted/15" />
          <Skeleton className="h-3 w-10 rounded-md bg-muted/15" />
        </div>
      </div>

      {/* Bottom: action bar */}
      <div className="pt-3 border-t border-border/30 space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-28 rounded-md bg-muted/15" />
          <Skeleton className="h-3 w-8 rounded-md bg-muted/15" />
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-8 flex-1 rounded-lg bg-muted/20" />
          <Skeleton className="h-8 flex-1 rounded-lg bg-muted/20" />
          <Skeleton className="h-8 w-10 rounded-lg bg-muted/20" />
        </div>
      </div>

      {/* Shimmer overlay */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="animate-shimmer h-full w-full" />
      </div>
    </div>
  );
}

// Empty state for "Meus Cofres"
function EmptyMeusCofres({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      className="flex items-center justify-center py-16"
      data-ocid="dashboard.meus_cofres.empty_state"
    >
      <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center animate-fade-in">
        <div
          className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-5"
          style={{
            background: "oklch(62% 0.18 230 / 0.1)",
            border: "1px solid oklch(62% 0.18 230 / 0.2)",
          }}
        >
          <Vault className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2 font-display">
          Nenhum cofre ainda
        </h3>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed font-body">
          Crie seu primeiro cofre para armazenar notas de forma segura com
          criptografia de ponta a ponta.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="glass-button-primary w-full flex items-center justify-center gap-2"
          data-ocid="dashboard.empty_create_button"
        >
          <Plus className="h-4 w-4" />
          Criar Primeiro Cofre
        </button>
      </div>
    </div>
  );
}

// Empty state for "Compartilhados"
function EmptyCompartilhados() {
  return (
    <div
      className="flex items-center justify-center py-16"
      data-ocid="dashboard.compartilhados.empty_state"
    >
      <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center animate-fade-in">
        <div
          className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-5"
          style={{
            background: "oklch(72% 0.15 210 / 0.1)",
            border: "1px solid oklch(72% 0.15 210 / 0.2)",
          }}
        >
          <Users className="h-8 w-8 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2 font-display">
          Nenhum cofre compartilhado
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed font-body">
          Quando outro usuário compartilhar um cofre com você, ele aparecerá
          aqui.
        </p>
      </div>
    </div>
  );
}

// Responsive card grid — uniform card heights via align-items: stretch
function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState("meus");
  const { data: cofres = [], isLoading } = useListarCofres();
  const { identity } = useInternetIdentity();

  const myPrincipal = identity?.getPrincipal().toString();

  const meusCofres = cofres.filter(
    (c) => c.proprietario.toString() === myPrincipal,
  );
  const compartilhados = cofres.filter(
    (c) => c.proprietario.toString() !== myPrincipal,
  );

  return (
    <div className="py-2 sm:py-4">
      {/* Page header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold text-foreground font-display">
            Meus Cofres
          </h2>
        </div>
        <p className="text-sm text-muted-foreground font-body">
          Notas privadas protegidas com criptografia vetKeys de ponta a ponta
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          {/* Tab switcher */}
          <TabsList
            className="glass-card grid grid-cols-2 w-full sm:w-auto sm:min-w-[300px] p-1 rounded-xl border-border/50 bg-transparent h-auto gap-1"
            data-ocid="dashboard.tabs"
          >
            <TabsTrigger
              value="meus"
              data-ocid="dashboard.meus_tab"
              className="flex items-center gap-1.5 rounded-lg text-sm font-medium font-body py-2 text-muted-foreground transition-all duration-200 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/30"
            >
              <Vault className="h-4 w-4 shrink-0" />
              <span>Meus Cofres</span>
              {meusCofres.length > 0 && (
                <span
                  className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-xs font-bold"
                  style={{
                    background: "oklch(62% 0.18 230 / 0.2)",
                    color: "oklch(62% 0.18 230)",
                  }}
                >
                  {meusCofres.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="compartilhados"
              data-ocid="dashboard.compartilhados_tab"
              className="flex items-center gap-1.5 rounded-lg text-sm font-medium font-body py-2 text-muted-foreground transition-all duration-200 data-[state=active]:bg-accent/15 data-[state=active]:text-accent data-[state=active]:shadow-none data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/30"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>Compartilhados</span>
              {compartilhados.length > 0 && (
                <span
                  className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-xs font-bold"
                  style={{
                    background: "oklch(72% 0.15 210 / 0.2)",
                    color: "oklch(72% 0.15 210)",
                  }}
                >
                  {compartilhados.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Create button — always visible */}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="glass-button-primary flex items-center justify-center gap-2 w-full sm:w-auto"
            data-ocid="dashboard.create_cofre_button"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Cofre</span>
          </button>
        </div>

        {/* Meus Cofres */}
        <TabsContent value="meus" className="animate-slide-up mt-0">
          {isLoading ? (
            <CardGrid>
              {(["sk1", "sk2", "sk3"] as const).map((sk) => (
                <CofreCardSkeleton key={sk} />
              ))}
            </CardGrid>
          ) : meusCofres.length === 0 ? (
            <EmptyMeusCofres onCreate={() => setShowCreateModal(true)} />
          ) : (
            <CardGrid>
              {meusCofres.map((cofre, index) => (
                <div
                  key={cofre.id.toString()}
                  className="animate-slide-up card-uniform"
                  style={{ animationDelay: `${index * 40}ms` }}
                  data-ocid={`dashboard.meus_cofres.item.${index + 1}`}
                >
                  <CofreCard cofre={cofre} />
                </div>
              ))}
            </CardGrid>
          )}
        </TabsContent>

        {/* Compartilhados */}
        <TabsContent value="compartilhados" className="animate-slide-up mt-0">
          {isLoading ? (
            <CardGrid>
              {(["sk1", "sk2"] as const).map((sk) => (
                <CofreCardSkeleton key={sk} />
              ))}
            </CardGrid>
          ) : compartilhados.length === 0 ? (
            <EmptyCompartilhados />
          ) : (
            <CardGrid>
              {compartilhados.map((cofre, index) => (
                <div
                  key={cofre.id.toString()}
                  className="animate-slide-up card-uniform"
                  style={{ animationDelay: `${index * 40}ms` }}
                  data-ocid={`dashboard.compartilhados.item.${index + 1}`}
                >
                  <CofreCard cofre={cofre} />
                </div>
              ))}
            </CardGrid>
          )}
        </TabsContent>
      </Tabs>

      {showCreateModal && (
        <CriarCofreModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
