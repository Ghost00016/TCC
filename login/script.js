const formulario = document.getElementById("formulario");
const mensagem = document.getElementById("mensagem");

console.log("LOGIN");

function voltarInicial() {
window.location.href = "../inicial/index.html";
}

function irParaCadastro() {
window.location.href = "../cadastro_usuario/index.html";
}

formulario.addEventListener("submit", async function(event) {
event.preventDefault();

const usuario = document.getElementById("usuario").value.trim();
const senha = document.getElementById("senha").value;

mensagem.innerText = "";
mensagem.style.color = "black";

if (!usuario) {
    mensagem.innerText = "Digite um nome de usuário.";
    mensagem.style.color = "red";
    return;
}

if (usuario.length < 3) {
    mensagem.innerText = "O usuário deve possuir pelo menos 3 caracteres.";
    mensagem.style.color = "red";
    return;
}

if (!senha) {
    mensagem.innerText = "Digite sua senha.";
    mensagem.style.color = "red";
    return;
}

mensagem.innerText = "Entrando...";
mensagem.style.color = "black";

try {
    const resposta = await fetch(window.location.origin + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuario, senha: senha })
    });

    const texto = await resposta.text();
    let resultado;

    try {
        resultado = JSON.parse(texto);
    } catch (erro) {
        throw new Error("O servidor não retornou JSON válido.");
    }

    if (resposta.ok && resultado.sucesso) {
        mensagem.innerText = resultado.mensagem || "Login realizado com sucesso!";
        mensagem.style.color = "green";

        setTimeout(function() {
            window.location.href = "../principal/index.html";
        }, 500);

        return;
    }

    mensagem.innerText = resultado.erro || "Usuário ou senha incorretos.";
    mensagem.style.color = "red";
} catch (erro) {
    console.error("ERRO NO LOGIN:", erro);
    mensagem.innerText = "Não foi possível conectar ao servidor.";
    mensagem.style.color = "red";
}

});
