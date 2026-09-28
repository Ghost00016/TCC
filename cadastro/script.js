const formulario = document.getElementById("formulario");
const mensagem = document.getElementById("mensagem");
const locais = document.getElementById("locais");

// Voltar
function voltarInicial() {
    window.location.href = "../gestao/index.html";
}

// Carrega os locais
async function carregarLocais() {
    try {
        const resposta = await fetch(
            window.location.origin + "/api/locais"
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.erro || "Erro ao carregar locais."
            );
        }

        locais.innerHTML = "";

        if (dados.length === 0) {
            locais.innerHTML =
                "<p>Nenhum local cadastrado.</p>";
            return;
        }

        dados.forEach(function(local) {
            const div = document.createElement("div");

            div.className = "local-item";

            const checkbox =
                document.createElement("input");

            checkbox.type = "checkbox";
            checkbox.className = "local-checkbox";
            checkbox.value = local.id;
            checkbox.id = "local-" + local.id;

            const label =
                document.createElement("label");

            label.htmlFor = "local-" + local.id;
            label.innerText = local.nome_local;

            div.appendChild(checkbox);
            div.appendChild(label);

            locais.appendChild(div);
        });

    } catch (erro) {
        console.error(
            "Erro ao carregar locais:",
            erro
        );

        locais.innerHTML =
            "<p>Não foi possível carregar os locais.</p>";
    }
}

carregarLocais();

// Valida CPF
function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, "");

    if (cpf.length !== 11) {
        return false;
    }

    if (/^(\d)\1{10}$/.test(cpf)) {
        return false;
    }

    let soma = 0;

    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }

    let resto = soma % 11;

    let digito1 =
        resto < 2 ? 0 : 11 - resto;

    if (
        digito1 !==
        parseInt(cpf.charAt(9))
    ) {
        return false;
    }

    soma = 0;

    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }

    resto = soma % 11;

    let digito2 =
        resto < 2 ? 0 : 11 - resto;

    if (
        digito2 !==
        parseInt(cpf.charAt(10))
    ) {
        return false;
    }

    return true;
}

// Formata CPF
function formatarCPF(cpf) {
    cpf = cpf.replace(/\D/g, "");

    if (cpf.length > 11) {
        cpf = cpf.substring(0, 11);
    }

    if (cpf.length > 9) {
        return cpf.replace(
            /^(\d{3})(\d{3})(\d{3})(\d{0,2})$/,
            "$1.$2.$3-$4"
        );
    }

    if (cpf.length > 6) {
        return cpf.replace(
            /^(\d{3})(\d{3})(\d{0,3})$/,
            "$1.$2.$3"
        );
    }

    if (cpf.length > 3) {
        return cpf.replace(
            /^(\d{3})(\d{0,3})$/,
            "$1.$2"
        );
    }

    return cpf;
}

// Formata CPF enquanto digita
document.getElementById("cpf").addEventListener(
    "input",
    function() {
        this.value = formatarCPF(this.value);
    }
);

// Envia cadastro
formulario.addEventListener(
    "submit",
    async function(event) {
        event.preventDefault();

        mensagem.innerText =
            "Enviando cadastro...";

        mensagem.style.color = "black";

        const nome =
            document.getElementById("nome").value.trim();

        const idade =
            document.getElementById("idade").value;

        const cpf =
            document.getElementById("cpf").value.trim();

        const sexo =
            document.getElementById("sexo").value;

        const cargo =
            document.getElementById("cargo").value.trim();

        const checkboxes =
            document.querySelectorAll(
                ".local-checkbox:checked"
            );

        const locais_acesso =
            Array.from(checkboxes).map(
                function(checkbox) {
                    return checkbox.value;
                }
            );

        if (!validarCPF(cpf)) {
            mensagem.innerText =
                "CPF inválido.";

            mensagem.style.color =
                "red";

            return;
        }

        if (
            !nome ||
            !idade ||
            !sexo ||
            !cargo
        ) {
            mensagem.innerText =
                "Preencha todos os campos.";

            mensagem.style.color =
                "red";

            return;
        }

        if (locais_acesso.length === 0) {
            mensagem.innerText =
                "Selecione pelo menos um local de acesso.";

            mensagem.style.color =
                "red";

            return;
        }

        const dados = {
            nome: nome,
            idade: parseInt(idade),
            cpf: cpf,
            sexo: sexo,
            cargo: cargo,
            locais_acesso: locais_acesso.join(",")
        };

        console.log(
            "Enviando cadastro:",
            dados
        );

        try {
            const resposta = await fetch(
                window.location.origin + "/api/cadastro",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                }
            );

            console.log(
                "Resposta recebida:",
                resposta.status
            );

            const texto =
                await resposta.text();

            console.log(
                "Resposta do servidor:",
                texto
            );

            let resultado;

            try {
                resultado =
                    JSON.parse(texto);
            } catch (erro) {
                throw new Error(
                    "O servidor não retornou JSON válido."
                );
            }

            if (
                resposta.ok &&
                resultado.sucesso
            ) {
                mensagem.innerText =
                    resultado.mensagem ||
                    "Cadastro realizado com sucesso!";

                mensagem.style.color =
                    "green";

                formulario.reset();

                return;
            }

            mensagem.innerText =
                resultado.erro ||
                "Não foi possível realizar o cadastro.";

            mensagem.style.color =
                "red";

        } catch (erro) {
            console.error(
                "ERRO NO FETCH:",
                erro
            );

            mensagem.innerText =
                "Não foi possível conectar ao servidor.";

            mensagem.style.color =
                "red";
        }
    }
);