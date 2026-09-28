const form = document.getElementById("formLocal");
const nomeLocal = document.getElementById("nome_local");
const listaLocais = document.getElementById("listaLocais");
const mensagem = document.getElementById("mensagem");

let localEditando = null;

// Carrega os locais
async function carregarLocais() {
    try {
        const resposta = await fetch("/api/locais");

        if (resposta.status === 401) {
            window.location.href = "/login/";
            return;
        }

        const locais = await resposta.json();
        listaLocais.innerHTML = "";

        if (locais.length === 0) {
            listaLocais.innerHTML = "<p>Nenhum local cadastrado.</p>";
            return;
        }

        locais.forEach(local => {
            const div = document.createElement("div");
            div.className = "local";

            div.innerHTML = `
                <div class="informacoes">
                    <strong>ID: ${local.id}</strong>
                    <span>${local.nome_local}</span>
                </div>
                <div class="acoes">
                    <button class="btn-alterar" onclick="editarLocal(${local.id}, '${escaparTexto(local.nome_local)}')">
                        Alterar
                    </button>
                    <button class="btn-deletar" onclick="deletarLocal(${local.id}, '${escaparTexto(local.nome_local)}')">
                        Deletar
                    </button>
                </div>
            `;

            listaLocais.appendChild(div);
        });
    } catch (erro) {
        listaLocais.innerHTML = "<p>Erro ao carregar os locais.</p>";
        console.error(erro);
    }
}

// Envia o formulário
form.addEventListener("submit", async function(evento) {
    evento.preventDefault();

    const nome = nomeLocal.value.trim();

    // Valida o nome
    if (!nome) {
        mostrarMensagem("Digite o nome do local.", "erro");
        return;
    }

    try {
        let resposta;

        // Cadastra um local
        if (localEditando === null) {
            resposta = await fetch("/api/locais", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nome_local: nome
                })
            });
        } else {
            // Altera um local
            resposta = await fetch(`/api/locais/${localEditando}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nome_local: nome
                })
            });
        }

        const dados = await resposta.json();

        if (!resposta.ok) {
            mostrarMensagem(dados.erro || "Erro ao salvar o local.", "erro");
            return;
        }

        // Mostra o resultado
        if (localEditando === null) {
            mostrarMensagem("Local cadastrado com sucesso!", "sucesso");
        } else {
            mostrarMensagem("Local alterado com sucesso!", "sucesso");
        }

        form.reset();
        localEditando = null;
        document.querySelector(".btn-cadastrar").textContent = "Cadastrar Local";
        carregarLocais();
    } catch (erro) {
        console.error(erro);
        mostrarMensagem("Erro ao conectar com o servidor.", "erro");
    }
});

// Edita um local
function editarLocal(id, nome) {
    localEditando = id;
    nomeLocal.value = nome;
    nomeLocal.focus();
    document.querySelector(".btn-cadastrar").textContent = "Salvar Alteração";
    mostrarMensagem(`Alterando o local ${id}.`, "info");
}

// Deleta um local
async function deletarLocal(id, nome) {
    const confirmar = confirm(`Deseja realmente deletar o local "${nome}"?`);

    if (!confirmar) {
        return;
    }

    try {
        const resposta = await fetch(`/api/locais/${id}`, {
            method: "DELETE"
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            mostrarMensagem(dados.erro || "Erro ao deletar o local.", "erro");
            return;
        }

        mostrarMensagem("Local deletado com sucesso!", "sucesso");
        carregarLocais();
    } catch (erro) {
        console.error(erro);
        mostrarMensagem("Erro ao conectar com o servidor.", "erro");
    }
}

// Mostra mensagens
function mostrarMensagem(texto, tipo) {
    mensagem.textContent = texto;
    mensagem.className = tipo;

    setTimeout(() => {
        mensagem.textContent = "";
        mensagem.className = "";
    }, 3000);
}

// Escapa caracteres especiais
function escaparTexto(texto) {
    return texto
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}

// Volta para a página principal
function voltarPrincipal() {
    window.location.href = "/principal/";
}

// Inicia o carregamento
carregarLocais();
