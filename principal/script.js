// Vai para o cadastro
function irParaGestao() {
    window.location.href = "../gestao/index.html";
}

// Vai para o histórico
function irParaHistorico() {
    window.location.href = "../historico/index.html";
}

// Vai para o controle de locais
function irParaLocais() {
    window.location.href = "../locais/index.html";
}

// Sai da conta
async function sair() {
    try {
        const resposta = await fetch(window.location.origin + "/api/logout", {
            method: "POST"
        });
        const resultado = await resposta.json();

        // Verifica se saiu com sucesso
        if (resposta.ok && resultado.sucesso) {
            window.location.href = "../inicial/index.html";
            return;
        }

        alert(resultado.erro || "Não foi possível sair da conta.");
    } catch (erro) {
        console.error("ERRO AO SAIR:", erro);
        alert("Não foi possível conectar ao servidor.");
    }
}