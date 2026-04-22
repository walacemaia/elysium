import Cycles "mo:base/ExperimentalCycles";
import AccessControl "authorization/access-control";
import Principal "mo:core/Principal";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Debug "mo:core/Debug";
import Nat "mo:core/Nat";
import Iter "mo:core/Iter";
import Migration "../src/backend/migration";

(with migration = Migration.run)
persistent actor Main {

    let accessControlState = AccessControl.initState();

    public shared ({ caller }) func initializeAccessControl() : async () {
        AccessControl.initialize(accessControlState, caller);
    };

    public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
        AccessControl.getUserRole(accessControlState, caller);
    };

    public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
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
        Map.get(userProfiles, Principal.compare, caller);
    };

    public query func getUserProfile(user : Principal) : async ?UserProfile {
        Map.get(userProfiles, Principal.compare, user);
    };

    public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
        Map.add(userProfiles, Principal.compare, caller, profile);
    };

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
        periodoInatividade : Int;
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

    var cofres = Map.empty<Nat, Cofre>();
    var proximoIdCofre : Nat = 1;
    var proximoIdNota : Nat = 1;

    var contatos = Map.empty<Principal, [Contato]>();
    var ultimosAcessos = Map.empty<Principal, Time.Time>();

    public shared ({ caller }) func criarCofre(nome : Text, descricao : Text, regras : RegrasAcesso) : async Nat {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Apenas usuários autenticados podem criar cofres");
        };

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

        Map.add(cofres, Nat.compare, id, novoCofre);
        await atualizarUltimoAcessoBackend(caller);
        id;
    };

    public shared ({ caller }) func adicionarNota(idCofre : Nat, titulo : Text, conteudo : Text) : async Nat {
        switch (Map.get(cofres, Nat.compare, idCofre)) {
            case null { Debug.trap("Cofre não encontrado") };
            case (?cofre) {
                if (caller != cofre.proprietario) {
                    Debug.trap("Apenas o proprietário pode adicionar notas");
                };

                let idNota = proximoIdNota;
                proximoIdNota += 1;

                let novaNota : Nota = {
                    id = idNota;
                    titulo;
                    conteudo;
                    dataCriacao = Time.now();
                    dataModificacao = Time.now();
                };

                let novasNotas = Array.concat(cofre.notas, [novaNota]);

                let cofreAtualizado = {
                    cofre with
                    notas = novasNotas;
                };

                Map.add(cofres, Nat.compare, idCofre, cofreAtualizado);
                await atualizarUltimoAcessoBackend(caller);
                idNota;
            };
        };
    };

    public shared ({ caller }) func listarNotas(idCofre : Nat) : async [Nota] {
        switch (Map.get(cofres, Nat.compare, idCofre)) {
            case null { Debug.trap("Cofre não encontrado") };
            case (?cofre) {
                if (not temPermissaoAcesso(caller, cofre)) {
                    Debug.trap("Acesso negado ao cofre");
                };
                await atualizarUltimoAcessoBackend(caller);
                cofre.notas;
            };
        };
    };

    public shared ({ caller }) func listarCofresUsuario() : async [Cofre] {
        let todosCofres = Array.fromIter<Cofre>(Iter.map<(Nat, Cofre), Cofre>(Map.entries(cofres), func((_, v)) { v }));
        let cofresAutorizados = Array.filter<Cofre>(todosCofres, func(cofre) { temPermissaoAcesso(caller, cofre) });
        await atualizarUltimoAcessoBackend(caller);
        cofresAutorizados;
    };

    func temPermissaoAcesso(usuario : Principal, cofre : Cofre) : Bool {
        if (usuario == cofre.proprietario) {
            return true;
        };

        let autorizado = Array.find<Principal>(
            cofre.regrasAcesso.usuariosAutorizados,
            func(u) { u == usuario },
        );

        switch (autorizado) {
            case null { false };
            case (?_) {
                let ultimoAcessoProprietario = switch (Map.get(ultimosAcessos, Principal.compare, cofre.proprietario)) {
                    case null { 0 };
                    case (?tempo) { tempo };
                };
                let tempoInativo = Time.now() - ultimoAcessoProprietario;
                tempoInativo >= cofre.regrasAcesso.periodoInatividade;
            };
        };
    };

    public shared ({ caller }) func editarCofre(idCofre : Nat, nome : Text, descricao : Text, regras : RegrasAcesso) : async () {
        switch (Map.get(cofres, Nat.compare, idCofre)) {
            case null { Debug.trap("Cofre não encontrado") };
            case (?cofre) {
                if (caller != cofre.proprietario) {
                    Debug.trap("Apenas o proprietário pode editar o cofre");
                };

                let cofreAtualizado = {
                    cofre with
                    nome;
                    descricao;
                    regrasAcesso = regras;
                };

                Map.add(cofres, Nat.compare, idCofre, cofreAtualizado);
                await atualizarUltimoAcessoBackend(caller);
            };
        };
    };

    public shared ({ caller }) func editarNota(idCofre : Nat, idNota : Nat, novoTitulo : Text, novoConteudo : Text) : async () {
        switch (Map.get(cofres, Nat.compare, idCofre)) {
            case null { Debug.trap("Cofre não encontrado") };
            case (?cofre) {
                if (caller != cofre.proprietario) {
                    Debug.trap("Apenas o proprietário pode editar notas");
                };

                let notasAtualizadas = Array.map<Nota, Nota>(
                    cofre.notas,
                    func(nota) {
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

                Map.add(cofres, Nat.compare, idCofre, cofreAtualizado);
                await atualizarUltimoAcessoBackend(caller);
            };
        };
    };

    public shared ({ caller }) func excluirNota(idCofre : Nat, idNota : Nat) : async () {
        switch (Map.get(cofres, Nat.compare, idCofre)) {
            case null { Debug.trap("Cofre não encontrado") };
            case (?cofre) {
                if (caller != cofre.proprietario) {
                    Debug.trap("Apenas o proprietário pode excluir notas");
                };

                let notasFiltradas = Array.filter<Nota>(
                    cofre.notas,
                    func(nota) { nota.id != idNota },
                );

                let cofreAtualizado = {
                    cofre with
                    notas = notasFiltradas;
                };

                Map.add(cofres, Nat.compare, idCofre, cofreAtualizado);
                await atualizarUltimoAcessoBackend(caller);
            };
        };
    };

    public shared ({ caller }) func excluirCofre(idCofre : Nat) : async () {
        switch (Map.get(cofres, Nat.compare, idCofre)) {
            case null { Debug.trap("Cofre não encontrado") };
            case (?cofre) {
                if (caller != cofre.proprietario) {
                    Debug.trap("Apenas o proprietário pode excluir o cofre");
                };

                Map.remove(cofres, Nat.compare, idCofre);
                await atualizarUltimoAcessoBackend(caller);
            };
        };
    };

    public shared ({ caller }) func adicionarContato(principalId : Principal) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Apenas usuários autenticados podem adicionar contatos");
        };

        switch (Map.get(userProfiles, Principal.compare, principalId)) {
            case null {
                Debug.trap("Principal ID não encontrado");
            };
            case (?perfil) {
                let novoContato : Contato = {
                    principalId;
                    nome = perfil.name;
                };

                let contatosExistentes = switch (Map.get(contatos, Principal.compare, caller)) {
                    case null { [] };
                    case (?c) { c };
                };

                let contatoExistente = Array.find<Contato>(
                    contatosExistentes,
                    func(contato) { contato.principalId == principalId },
                );

                switch (contatoExistente) {
                    case null {
                        let novosContatos = Array.concat(contatosExistentes, [novoContato]);
                        Map.add(contatos, Principal.compare, caller, novosContatos);
                        await atualizarUltimoAcessoBackend(caller);
                    };
                    case (?_) {
                        Debug.trap("Contato já existe");
                    };
                };
            };
        };
    };

    public query ({ caller }) func listarContatos() : async [Contato] {
        switch (Map.get(contatos, Principal.compare, caller)) {
            case null { [] };
            case (?contatosUsuario) {
                Array.map<Contato, Contato>(
                    contatosUsuario,
                    func(contato) {
                        switch (Map.get(userProfiles, Principal.compare, contato.principalId)) {
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
        switch (Map.get(contatos, Principal.compare, caller)) {
            case null {
                Debug.trap("Nenhum contato encontrado para o usuário");
            };
            case (?contatosUsuario) {
                let contatosFiltrados = Array.filter<Contato>(
                    contatosUsuario,
                    func(contato) { contato.principalId != principalId },
                );
                Map.add(contatos, Principal.compare, caller, contatosFiltrados);
                await atualizarUltimoAcessoBackend(caller);
            };
        };
    };

    public shared ({ caller }) func revogarAutorizacao(idCofre : Nat, usuario : Principal) : async () {
        switch (Map.get(cofres, Nat.compare, idCofre)) {
            case null { Debug.trap("Cofre não encontrado") };
            case (?cofre) {
                if (caller != cofre.proprietario) {
                    Debug.trap("Apenas o proprietário pode revogar autorizações");
                };

                let usuariosAutorizados = Array.filter<Principal>(
                    cofre.regrasAcesso.usuariosAutorizados,
                    func(u) { u != usuario },
                );

                let regrasAtualizadas = {
                    cofre.regrasAcesso with
                    usuariosAutorizados;
                };

                let cofreAtualizado = {
                    cofre with
                    regrasAcesso = regrasAtualizadas;
                };

                Map.add(cofres, Nat.compare, idCofre, cofreAtualizado);
                await atualizarUltimoAcessoBackend(caller);
            };
        };
    };

    public shared ({ caller }) func atualizarUltimoAcessoBackend(usuario : Principal) : async () {
        Map.add(ultimosAcessos, Principal.compare, usuario, Time.now());
    };

    public query func obterUltimoAcesso(usuario : Principal) : async Time.Time {
        switch (Map.get(ultimosAcessos, Principal.compare, usuario)) {
            case null { 0 };
            case (?tempo) { tempo };
        };
    };

    public shared ({ caller }) func buscarCofrePorId(idCofre : Nat) : async Cofre {
        switch (Map.get(cofres, Nat.compare, idCofre)) {
            case null { Debug.trap("Cofre não encontrado") };
            case (?cofre) {
                if (not temPermissaoAcesso(caller, cofre)) {
                    Debug.trap("Acesso negado ao cofre");
                };
                await atualizarUltimoAcessoBackend(caller);
                cofre;
            };
        };
    };

type __CAFFEINE_STORAGE_RefillInformation = {
    proposed_top_up_amount: ?Nat;
};

type __CAFFEINE_STORAGE_RefillResult = {
    success: ?Bool;
    topped_up_amount: ?Nat;
};

    public shared (msg) func __CAFFEINE_STORAGE_refillCashier(refill_information: ?__CAFFEINE_STORAGE_RefillInformation) : async __CAFFEINE_STORAGE_RefillResult {
    let cashier = Principal.fromText("72ch2-fiaaa-aaaar-qbsvq-cai");

    assert (cashier == msg.caller);

    let current_balance = Cycles.balance();
    let reserved_cycles : Nat = 400_000_000_000;

    let current_free_cycles_count : Nat = Nat.sub(current_balance, reserved_cycles);

    let cycles_to_send : Nat = switch (refill_information) {
        case null { current_free_cycles_count };
        case (?info) {
            switch (info.proposed_top_up_amount) {
                case null { current_free_cycles_count };
                case (?proposed) { Nat.min(proposed, current_free_cycles_count) };
            }
        };
    };

    let target_canister = actor(Principal.toText(cashier)) : actor {
        account_top_up_v1 : ({ account : Principal }) -> async ();
    };

    let current_principal = Principal.fromActor(Main);

    await (with cycles = cycles_to_send) target_canister.account_top_up_v1({ account = current_principal });

    return {
        success = ?true;
        topped_up_amount = ?cycles_to_send;
    };
};
};
