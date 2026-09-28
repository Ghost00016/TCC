const pessoasDiv = document.getElementById("pessoas");
const formulario = document.getElementById("formulario");
const formAlterar = document.getElementById("formAlterar");
const locaisDiv = document.getElementById("locais");
const mensagem = document.getElementById("mensagem");

let pessoas = [];
let locais = [];

console.log("GERENCIAMENTO DE PESSOAS");

async function carregarDados() {
try {
const respostaPessoas = await fetch("/api/pessoas");
const respostaLocais = await fetch("/api/locais");

    if (respostaPessoas.status === 401 || respostaLocais.status === 401) {
        window.location.href = "../inicial/index.html";
        return;
    }

    pessoas = await respostaPessoas.json();
    locais = await respostaLocais.json();

    mostrarPessoas();
    mostrarLocais();
} catch (erro) {
    console.error("Erro ao carregar dados:", erro);
    mostrarMensagem("Não foi possível carregar os dados.", "erro");
}

}

function mostrarPessoas() {
pessoasDiv.innerHTML = "";

if (!Array.isArray(pessoas) || pessoas.length === 0) {
    pessoasDiv.innerHTML = "<p>Nenhuma pessoa cadastrada.</p>";
    return;
}

pessoas.forEach(function(pessoa) {
    const card = document.createElement("div");
    card.className = "pessoa";

    const informacoes = document.createElement("div");
    informacoes.className = "informacoes";

    const nome = document.createElement("h3");
    nome.textContent = pessoa.nome;

    const dados = document.createElement("p");
    dados.textContent = "CPF: " + pessoa.cpf + " | Cargo: " + pessoa.cargo;

    informacoes.appendChild(nome);
    informacoes.appendChild(dados);

    const botoes = document.createElement("div");
    botoes.className = "acoes";

    const alterar = document.createElement("button");
    alterar.className = "btn-alterar";
    alterar.textContent = "Alterar";
    alterar.onclick = function() { prepararAlteracao(pessoa); };

    const deletar = document.createElement("button");
    deletar.className = "btn-deletar";
    deletar.textContent = "Deletar";
    deletar.onclick = function() { deletarPessoa(pessoa); };

    botoes.appendChild(alterar);
    botoes.appendChild(deletar);

    card.appendChild(informacoes);
    card.appendChild(botoes);
    pessoasDiv.appendChild(card);
});

}

function mostrarLocais() {
locaisDiv.innerHTML = "";

if (!Array.isArray(locais) || locais.length === 0) {
    locaisDiv.innerHTML = "<p>Nenhum local cadastrado.</p>";
    return;
}

locais.forEach(function(local) {
    const item = document.createElement("div");
    item.className = "local-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "local-checkbox";
    checkbox.value = local.id;
    checkbox.id = "local-" + local.id;

    const label = document.createElement("label");
    label.htmlFor = "local-" + local.id;
    label.textContent = local.nome_local;

    item.appendChild(checkbox);
    item.appendChild(label);
    locaisDiv.appendChild(item);
});

}

function prepararAlteracao(pessoa) {
document.getElementById("id").value = pessoa.id;
document.getElementById("nome").value = pessoa.nome;
document.getElementById("idade").value = pessoa.idade;
document.getElementById("cpf").value = pessoa.cpf;
document.getElementById("sexo").value = pessoa.sexo;
document.getElementById("cargo").value = pessoa.cargo;

const locaisPessoa = String(pessoa.locais_acesso || "")
    .split(",")
    .map(id => id.trim())
    .filter(id => id !== "");

document.querySelectorAll(".local-checkbox").forEach(function(checkbox) {
    checkbox.checked = locaisPessoa.includes(checkbox.value);
});

formulario.style.display = "block";

formulario.scrollIntoView({
    behavior: "smooth",
    block: "start"
});

}

formAlterar.addEventListener("submit", async function(event) {
event.preventDefault();

const id = document.getElementById("id").value;

const locaisSelecionados = Array.from(
    document.querySelectorAll(".local-checkbox:checked")
).map(function(checkbox) {
    return checkbox.value;
});

if (locaisSelecionados.length === 0) {
    mostrarMensagem("Selecione pelo menos um local de acesso.", "erro");
    return;
}

const dados = {
    nome: document.getElementById("nome").value.trim(),
    idade: parseInt(document.getElementById("idade").value),
    cpf: document.getElementById("cpf").value.trim(),
    sexo: document.getElementById("sexo").value,
    cargo: document.getElementById("cargo").value.trim(),
    locais_acesso: locaisSelecionados.join(",")
};

try {
    const resposta = await fetch("/api/pessoas/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
        mostrarMensagem(resultado.erro || "Não foi possível alterar a pessoa.", "erro");
        return;
    }

    mostrarMensagem("Pessoa alterada com sucesso!", "sucesso");
    formulario.style.display = "none";
    await carregarDados();
} catch (erro) {
    console.error("Erro ao alterar pessoa:", erro);
    mostrarMensagem("Não foi possível conectar ao servidor.", "erro");
}

});

async function deletarPessoa(pessoa) {
const confirmar = confirm(
"Tem certeza que deseja deletar " + pessoa.nome +
"?\n\nA pessoa será removida do banco e a pasta de fotos também será apagada."
);

if (!confirmar) return;

try {
    const resposta = await fetch("/api/pessoas/" + pessoa.id, {
        method: "DELETE"
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
        mostrarMensagem(resultado.erro || "Não foi possível deletar a pessoa.", "erro");
        return;
    }

    mostrarMensagem("Pessoa deletada com sucesso!", "sucesso");
    formulario.style.display = "none";
    await carregarDados();
} catch (erro) {
    console.error("Erro ao deletar pessoa:", erro);
    mostrarMensagem("Não foi possível conectar ao servidor.", "erro");
}

}

function cancelarAlteracao() {
formulario.style.display = "none";
formAlterar.reset();

document.querySelectorAll(".local-checkbox").forEach(function(checkbox) {
    checkbox.checked = false;
});

}

function registrarPessoa() {
window.location.href = "../cadastro/index.html";
}

function voltar() {
window.location.href = "../principal/index.html";
}

function mostrarMensagem(texto, tipo) {
mensagem.textContent = texto;
mensagem.className = tipo;

setTimeout(function() {
    mensagem.textContent = "";
    mensagem.className = "";
}, 4000);

}

carregarDados();
