const formulario = document.getElementById("formulario");
const mensagem = document.getElementById("mensagem");
const popup = document.getElementById("popup");

function voltarInicial() {
    window.location.href = "../inicial/index.html";
}

function irParaLogin() {
    window.location.href = "../login/index.html";
}

function fecharPopup() {
    popup.classList.remove("ativo");
}

formulario.addEventListener("submit", async function(event) {
    event.preventDefault();

    mensagem.innerText = "Cadastrando usuário...";
    mensagem.style.color = "black";

    const usuario = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value;
    const confirmarSenha = document.getElementById("confirmarSenha").value;

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

    if (senha.length < 6) {
        mensagem.innerText = "A senha deve possuir pelo menos 6 caracteres.";
        mensagem.style.color = "red";
        return;
    }

    if (senha !== confirmarSenha) {
        mensagem.innerText = "As senhas não coincidem.";
        mensagem.style.color = "red";
        return;
    }

    const dados = {
        usuario: usuario,
        senha: senha
    };

    console.log("Enviando cadastro de usuário:", {
        usuario: usuario
    });

    try {
        const resposta = await fetch(
            window.location.origin + "/api/cadastro-usuario",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(dados)
            }
        );

        console.log("Resposta recebida:", resposta.status);

        const texto = await resposta.text();

        console.log("Resposta do servidor:", texto);

        let resultado;

        try {
            resultado = JSON.parse(texto);
        } catch (erro) {
            throw new Error("O servidor não retornou JSON válido.");
        }

        if (resposta.ok && resultado.sucesso) {
            formulario.reset();
            mensagem.innerText = "";
            popup.classList.add("ativo");
            return;
        }

        mensagem.innerText =
            resultado.erro ||
            "Não foi possível cadastrar o usuário.";

        mensagem.style.color = "red";

    } catch (erro) {
        console.error("ERRO NO FETCH:", erro);

        mensagem.innerText =
            "Não foi possível conectar ao servidor.";

        mensagem.style.color = "red";
    }
});