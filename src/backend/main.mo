import AccessControl "authorization/access-control";
import Principal "mo:core/Principal";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import Blob "mo:core/Blob";
import ManagementCanister "mo:ic-vetkeys/ManagementCanister";



actor {
    // Initialize the user system state
    let accessControlState = AccessControl.initState();

    // Tracks the first principal to become admin — this admin can never be revoked
    var primeiroAdmin : ?Principal = null;

    // Initialize auth (first caller becomes admin, others become users)
    public shared ({ caller }) func initializeAccessControl() : async () {
        let eraAdminAntes = accessControlState.adminAssigned;
        AccessControl.initialize(accessControlState, caller);
        // Se o admin ainda não havia sido atribuído e agora foi, este é o primeiro admin
        if (not eraAdminAntes and accessControlState.adminAssigned) {
            primeiroAdmin := ?caller;
        };
        // Auto-register the caller in userProfiles so they are discoverable as a contact
        // even before they explicitly complete ProfileSetup. Only create if not already present.
        switch (userProfiles.get(caller)) {
            case null {
                let defaultProfile : UserProfile = {
                    name = "";
                    principalId = caller.toText();
                };
                userProfiles.add(caller, defaultProfile);
            };
            case (?_) {};
        };
        updateLastAccess(caller);
    };

    public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
        AccessControl.getUserRole(accessControlState, caller);
    };

    public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
        updateLastAccess(caller);
        AccessControl.assignRole(accessControlState, caller, user, role);
    };

    public query ({ caller }) func isCallerAdmin() : async Bool {
        AccessControl.isAdmin(accessControlState, caller);
    };

    public type UserProfile = {
        name : Text;
        principalId : Text;
    };

    var userProfiles = Map.empty<Principal, UserProfile>();

    public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
        userProfiles.get(caller);
    };

    public query func getUserProfile(user : Principal) : async ?UserProfile {
        userProfiles.get(user);
    };

    public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
        updateLastAccess(caller);
        userProfiles.add(caller, profile);
    };

    // Tipos de dados
    public type Cofre = {
        id : Nat;
        nome : Text;
        descricao : Text;
        proprietario : Principal;
        regrasAcesso : RegrasAcesso;
        notas : [Nota];
    };

    public type RegrasAcesso = {
        usuariosAutorizados : [Principal];
        periodoInatividade : Int; // Em segundos
    };

    public type Nota = {
        id : Nat;
        titulo : Text;
        conteudo : Text;
        dataCriacao : Time.Time;
        dataModificacao : Time.Time;
    };

    public type Contato = {
        principalId : Principal;
        nome : Text;
    };

    // Inicialização de mapas
    var cofres = Map.empty<Nat, Cofre>();
    var proximoIdCofre : Nat = 1;
    var proximoIdNota : Nat = 1;

    var contatos = Map.empty<Principal, [Contato]>();
    var ultimosAcessos = Map.empty<Principal, Time.Time>();

    // ── Access control (canonical) ───────────────────────────────────────────

    /// Single canonical access-check function. Returns #ok(()) if access is
    /// allowed, or #err(message) explaining why access is denied.
    ///
    /// Rules:
    ///   (a) Owner always has access — no inactivity check for owners.
    ///   (b) Non-owners must be in usuariosAutorizados.
    ///   (c) If periodoInatividade > 0, the OWNER's last access timestamp is
    ///       checked (NOT the caller's). The elapsed time must be >= the period.
    ///       If the owner has no recorded access, inheritance is not yet active.
    ///   (d) If periodoInatividade == 0, authorized users always have access.
    ///
    /// IMPORTANT: This function never calls updateLastAccess.
    private func checarAcessoCofre(caller : Principal, cofre : Cofre) : { #ok; #err : Text } {
        // (a) Owner always has access
        if (isOwner(caller, cofre)) {
            return #ok;
        };

        // (b) Caller must be in the authorized users list
        let autorizado = cofre.regrasAcesso.usuariosAutorizados.find(
            func(u : Principal) : Bool { u == caller }
        );
        switch (autorizado) {
            case null {
                return #err("Acesso negado ao cofre");
            };
            case (?_) {};
        };

        // (d) No inactivity rule → authorized users always have access
        if (cofre.regrasAcesso.periodoInatividade == 0) {
            return #ok;
        };

        // (c) Inactivity check: use OWNER's last access, not caller's.
        //     periodoInatividade is stored in SECONDS; Time.now() is nanoseconds.
        let ownerLastAccess = switch (ultimosAcessos.get(cofre.proprietario)) {
            case null {
                // Owner has never accessed → inheritance not yet active
                return #err("Acesso ao cofre ainda não liberado: proprietário nunca acessou o sistema");
            };
            case (?t) { t };
        };

        let elapsedNanos : Int = Time.now() - ownerLastAccess;
        let periodoNanos : Int = cofre.regrasAcesso.periodoInatividade * 1_000_000_000;

        if (elapsedNanos >= periodoNanos) {
            #ok
        } else {
            #err("Período de inatividade do proprietário ainda não transcorreu")
        };
    };

    /// Trap-based wrapper for critical operations (update calls that require access).
    /// Call this BEFORE updateLastAccess — never after.
    private func exigirAcessoCofre(caller : Principal, cofre : Cofre) {
        switch (checarAcessoCofre(caller, cofre)) {
            case (#ok) {};
            case (#err(msg)) { Runtime.trap(msg) };
        };
    };

    // Helper: check ownership by Principal equality
    func isOwner(usuario : Principal, cofre : Cofre) : Bool {
        usuario.toText() == cofre.proprietario.toText();
    };

    // Private helper — centralizes last-access update logic
    private func updateLastAccess(user : Principal) {
        ultimosAcessos.add(user, Time.now());
    };

    // ── Funções de gestão de cofres ───────────────────────────────────────────

    public shared ({ caller }) func criarCofre(nome : Text, descricao : Text, regras : RegrasAcesso) : async Nat {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Runtime.trap("Apenas usuários autenticados podem criar cofres");
        };
        updateLastAccess(caller);

        let id = proximoIdCofre;
        proximoIdCofre += 1;

        let novoCofre : Cofre = {
            id;
            nome;
            descricao;
            proprietario = caller;
            regrasAcesso = regras;
            notas = [];
        };

        cofres.add(id, novoCofre);
        id;
    };

    public shared ({ caller }) func adicionarNota(idCofre : Nat, titulo : Text, conteudo : Text) : async Nat {
        switch (cofres.get(idCofre)) {
            case null { Runtime.trap("Cofre não encontrado") };
            case (?cofre) {
                if (not isOwner(caller, cofre)) {
                    Runtime.trap("Apenas o proprietário pode adicionar notas");
                };
                updateLastAccess(caller);

                let idNota = proximoIdNota;
                proximoIdNota += 1;

                let novaNota : Nota = {
                    id = idNota;
                    titulo;
                    conteudo;
                    dataCriacao = Time.now();
                    dataModificacao = Time.now();
                };

                let novasNotas = cofre.notas.concat([novaNota]);

                let cofreAtualizado = {
                    cofre with
                    notas = novasNotas;
                };

                cofres.add(idCofre, cofreAtualizado);
                idNota;
            };
        };
    };

    public shared ({ caller }) func listarNotas(idCofre : Nat) : async [Nota] {
        let cofre = switch (cofres.get(idCofre)) {
            case null { Runtime.trap("Cofre não encontrado") };
            case (?c) { c };
        };
        exigirAcessoCofre(caller, cofre);
        updateLastAccess(caller);
        cofre.notas;
    };

    // Lista cofres onde o caller é proprietário OU está na lista de usuariosAutorizados.
    // NÃO aplica verificação de período de inatividade — cofres trancados ainda aparecem na lista.
    // A separação entre "compartilhado" (layer de autorização) e "trancado" (layer temporal) é
    // responsabilidade do frontend, que usa verificarAcessoCofre (polling a cada 10s) para
    // determinar se o cofre está trancado.
    public shared ({ caller }) func listarCofresUsuario() : async [Cofre] {
        updateLastAccess(caller);
        let todosCofres = cofres.values().toArray();
        todosCofres.filter(func(cofre : Cofre) : Bool {
            // Owner always sees their own vaults
            if (isOwner(caller, cofre)) { return true };
            // Authorized users see shared vaults regardless of lock state
            let autorizado = cofre.regrasAcesso.usuariosAutorizados.find(
                func(u : Principal) : Bool { u == caller }
            );
            switch (autorizado) {
                case null { false };
                case (?_) { true };
            };
        });
    };

    // Função para editar cofres existentes
    public shared ({ caller }) func editarCofre(idCofre : Nat, nome : Text, descricao : Text, regras : RegrasAcesso) : async () {
        switch (cofres.get(idCofre)) {
            case null { Runtime.trap("Cofre não encontrado") };
            case (?cofre) {
                if (not isOwner(caller, cofre)) {
                    Runtime.trap("Apenas o proprietário pode editar o cofre");
                };
                updateLastAccess(caller);

                let cofreAtualizado = {
                    cofre with
                    nome;
                    descricao;
                    regrasAcesso = regras;
                };

                cofres.add(idCofre, cofreAtualizado);
            };
        };
    };

    // Função para editar notas existentes
    public shared ({ caller }) func editarNota(idCofre : Nat, idNota : Nat, novoTitulo : Text, novoConteudo : Text) : async () {
        switch (cofres.get(idCofre)) {
            case null { Runtime.trap("Cofre não encontrado") };
            case (?cofre) {
                if (not isOwner(caller, cofre)) {
                    Runtime.trap("Apenas o proprietário pode editar notas");
                };
                updateLastAccess(caller);

                let notasAtualizadas = cofre.notas.map(
                    func(nota : Nota) : Nota {
                        if (nota.id == idNota) {
                            {
                                nota with
                                titulo = novoTitulo;
                                conteudo = novoConteudo;
                                dataModificacao = Time.now();
                            };
                        } else {
                            nota;
                        };
                    },
                );

                let cofreAtualizado = {
                    cofre with
                    notas = notasAtualizadas;
                };

                cofres.add(idCofre, cofreAtualizado);
            };
        };
    };

    // Função para excluir notas
    public shared ({ caller }) func excluirNota(idCofre : Nat, idNota : Nat) : async () {
        switch (cofres.get(idCofre)) {
            case null { Runtime.trap("Cofre não encontrado") };
            case (?cofre) {
                if (not isOwner(caller, cofre)) {
                    Runtime.trap("Apenas o proprietário pode excluir notas");
                };
                updateLastAccess(caller);

                let notasFiltradas = cofre.notas.filter(
                    func(nota : Nota) : Bool { nota.id != idNota },
                );

                let cofreAtualizado = {
                    cofre with
                    notas = notasFiltradas;
                };

                cofres.add(idCofre, cofreAtualizado);
            };
        };
    };

    // Função para excluir cofres
    public shared ({ caller }) func excluirCofre(idCofre : Nat) : async () {
        switch (cofres.get(idCofre)) {
            case null { Runtime.trap("Cofre não encontrado") };
            case (?cofre) {
                if (not isOwner(caller, cofre)) {
                    Runtime.trap("Apenas o proprietário pode excluir o cofre");
                };
                updateLastAccess(caller);
                cofres.remove(idCofre);
            };
        };
    };

    // Nova função para buscar cofre por ID
    public shared ({ caller }) func buscarCofrePorId(idCofre : Nat) : async Cofre {
        let cofre = switch (cofres.get(idCofre)) {
            case null { Runtime.trap("Cofre não encontrado") };
            case (?c) { c };
        };
        exigirAcessoCofre(caller, cofre);
        updateLastAccess(caller);
        cofre;
    };

    /// Verifica se o caller tem acesso ao cofre (para polling de status de bloqueio).
    /// Retorna true = cofre acessível (desbloqueado), false = cofre trancado.
    /// NÃO atualiza o último acesso — seguro para polling frequente.
    public query ({ caller }) func verificarAcessoCofre(idCofre : Nat) : async Bool {
        let cofre = switch (cofres.get(idCofre)) {
            case null { return false };
            case (?c) { c };
        };
        switch (checarAcessoCofre(caller, cofre)) {
            case (#ok) { true };
            case (#err(_)) { false };
        };
    };

    // Função para obter o último acesso global do usuário
    public query func obterUltimoAcesso(usuario : Principal) : async Time.Time {
        switch (ultimosAcessos.get(usuario)) {
            case null { 0 };
            case (?tempo) { tempo };
        };
    };

    // Função para atualizar o último acesso global do usuário
    // SECURITY: only records the caller's own last access — never accepts an arbitrary principal
    // Kept for backward compatibility; frontend may still call this harmlessly.
    public shared ({ caller }) func atualizarUltimoAcessoBackend() : async () {
        updateLastAccess(caller);
    };

    // ── Funções de gestão de contatos ─────────────────────────────────────────

    public shared ({ caller }) func adicionarContato(principalId : Principal) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Runtime.trap("Apenas usuários autenticados podem adicionar contatos");
        };
        updateLastAccess(caller);

        switch (userProfiles.get(principalId)) {
            case null {
                Runtime.trap("Principal ID não encontrado");
            };
            case (?perfil) {
                let novoContato : Contato = {
                    principalId;
                    nome = perfil.name;
                };

                let contatosExistentes = switch (contatos.get(caller)) {
                    case null { [] };
                    case (?c) { c };
                };

                // Verifica se o contato já existe
                let contatoExistente = contatosExistentes.find(
                    func(contato : Contato) : Bool { contato.principalId == principalId },
                );

                switch (contatoExistente) {
                    case null {
                        let novosContatos = contatosExistentes.concat([novoContato]);
                        contatos.add(caller, novosContatos);
                    };
                    case (?_) {
                        Runtime.trap("Contato já existe");
                    };
                };
            };
        };
    };

    public query ({ caller }) func listarContatos() : async [Contato] {
        switch (contatos.get(caller)) {
            case null { [] };
            case (?contatosUsuario) {
                // Atualiza os nomes dos contatos com base nos perfis mais recentes
                contatosUsuario.map<Contato, Contato>(
                    func(contato : Contato) : Contato {
                        switch (userProfiles.get(contato.principalId)) {
                            case null { contato };
                            case (?perfil) {
                                {
                                    contato with
                                    nome = perfil.name;
                                };
                            };
                        };
                    },
                );
            };
        };
    };

    public shared ({ caller }) func removerContato(principalId : Principal) : async () {
        switch (contatos.get(caller)) {
            case null {
                Runtime.trap("Nenhum contato encontrado para o usuário");
            };
            case (?contatosUsuario) {
                let contatosFiltrados = contatosUsuario.filter(
                    func(contato : Contato) : Bool { contato.principalId != principalId },
                );
                contatos.add(caller, contatosFiltrados);
                updateLastAccess(caller);
            };
        };
    };

    // Função para revogar autorização de usuários em cofres
    public shared ({ caller }) func revogarAutorizacao(idCofre : Nat, usuario : Principal) : async () {
        switch (cofres.get(idCofre)) {
            case null { Runtime.trap("Cofre não encontrado") };
            case (?cofre) {
                if (not isOwner(caller, cofre)) {
                    Runtime.trap("Apenas o proprietário pode revogar autorizações");
                };
                updateLastAccess(caller);

                let usuariosAutorizados = cofre.regrasAcesso.usuariosAutorizados.filter(
                    func(u : Principal) : Bool { u != usuario },
                );

                let regrasAtualizadas = {
                    cofre.regrasAcesso with
                    usuariosAutorizados;
                };

                let cofreAtualizado = {
                    cofre with
                    regrasAcesso = regrasAtualizadas;
                };

                cofres.add(idCofre, cofreAtualizado);
            };
        };
    };

    // ── Gestão de administradores ─────────────────────────────────────────────

    public type UserProfileEntry = {
        principalId : Principal;
        nome : Text;
        role : AccessControl.UserRole;
    };

    /// Lista todos os perfis registrados (somente administradores)
    public query ({ caller }) func listarTodosProfiles() : async [UserProfileEntry] {
        if (not AccessControl.isAdmin(accessControlState, caller)) {
            Runtime.trap("Acesso negado: apenas administradores podem listar todos os perfis");
        };
        let entries = userProfiles.entries().toArray();
        entries.map<(Principal, UserProfile), UserProfileEntry>(
            func((principal, perfil) : (Principal, UserProfile)) : UserProfileEntry {
                let role = switch (accessControlState.userRoles.get(principal)) {
                    case (?r) { r };
                    case null { #guest };
                };
                {
                    principalId = principal;
                    nome = perfil.name;
                    role;
                };
            }
        );
    };

    /// Promove um usuário a administrador (somente administradores podem fazer isso)
    public shared ({ caller }) func promoverParaAdmin(user : Principal) : async { #ok : Text; #err : Text } {
        updateLastAccess(caller);
        if (not AccessControl.isAdmin(accessControlState, caller)) {
            return #err("Acesso negado: apenas administradores podem promover outros usuários");
        };
        AccessControl.assignRole(accessControlState, caller, user, #admin);
        #ok("Usuário promovido a administrador com sucesso");
    };

    /// Revoga o status de administrador de um usuário (somente administradores podem fazer isso)
    /// O primeiro administrador do sistema não pode ter seu status revogado
    public shared ({ caller }) func revogarAdmin(user : Principal) : async { #ok : Text; #err : Text } {
        updateLastAccess(caller);
        if (not AccessControl.isAdmin(accessControlState, caller)) {
            return #err("Acesso negado: apenas administradores podem revogar outros administradores");
        };
        switch (primeiroAdmin) {
            case (?primeiro) {
                if (primeiro == user) {
                    return #err("Não é possível revogar o administrador original do sistema");
                };
            };
            case null {};
        };
        AccessControl.assignRole(accessControlState, caller, user, #user);
        #ok("Status de administrador revogado com sucesso");
    };

    // ── VetKeys helpers ──────────────────────────────────────────────────────

    /// Encode a Nat cofreId as big-endian bytes (Blob)
    private func cofreIdToBytes(id : Nat) : Blob {
        if (id == 0) {
            return "\00";
        };
        var count = 0;
        var tmp = id;
        while (tmp > 0) {
            count += 1;
            tmp /= 256;
        };
        var bytes : [Nat8] = [];
        var i = 0;
        var remaining = id;
        // build least-significant-byte first, then reverse
        while (i < count) {
            bytes := [Nat8.fromNat(remaining % 256)].concat(bytes);
            remaining /= 256;
            i += 1;
        };
        Blob.fromArray(bytes);
    };

    private func vetKdKeyId() : ManagementCanister.VetKdKeyid {
        { curve = #bls12_381_g2; name = "test_key_1" };
    };

    // ── VetKeys public endpoints ─────────────────────────────────────────────

    /// Returns the canister base public key (empty context), used to verify vetKeys
    /// derived with context=[] and input=cofreIdToBytes(cofreId) in vetkd_encrypted_key.
    /// Access controlled — only cofre owner or authorized users (with inactivity met) may call this.
    public shared ({ caller }) func vetkd_public_key(idCofre : Nat) : async Blob {
        let cofre = switch (cofres.get(idCofre)) {
            case null { Runtime.trap("Cofre não encontrado") };
            case (?c) { c };
        };
        exigirAcessoCofre(caller, cofre);
        updateLastAccess(caller);
        await ManagementCanister.vetKdPublicKey(null, Blob.fromArray([]), vetKdKeyId());
    };

    /// Returns the encrypted derived key for the caller (auth required)
    public shared ({ caller }) func vetkd_encrypted_key(transportPublicKey : Blob, cofreId : Nat) : async Blob {
        let cofre = switch (cofres.get(cofreId)) {
            case null { Runtime.trap("Cofre não encontrado") };
            case (?c) { c };
        };
        exigirAcessoCofre(caller, cofre);
        updateLastAccess(caller);
        await ManagementCanister.vetKdDeriveKey(cofreIdToBytes(cofreId), Blob.fromArray([]), vetKdKeyId(), transportPublicKey);
    };
};
