let todosRegistros = [];

/*

* CARREGAR HISTÓRICO
  */
  async function carregarHistorico() {

  const tabela = document.getElementById("historico");
  const mensagem = document.getElementById("mensagem");

  try {

   mensagem.textContent = "Carregando registros...";

   const resposta = await fetch("/api/registros");

   if (!resposta.ok) {

       if (resposta.status === 401) {
           mensagem.textContent =
               "Sua sessão expirou. Faça login novamente.";
           return;
       }

       throw new Error("Erro na API");
   }

   const registros = await resposta.json();

   todosRegistros = registros;

   carregarLocais(registros);

   exibirRegistros(registros);

  } catch (erro) {

   console.error("Erro:", erro);

   tabela.innerHTML = "";

   mensagem.textContent =
       "Erro ao carregar os registros.";

  }
  }

/*

* CARREGAR LOCAIS NO SELECT
  */
  function carregarLocais(registros) {

  const selectLocal =
  document.getElementById("filtroLocal");

  const locais = [
  ...new Set(
  registros
  .map(registro => registro.local)
  .filter(local => local)
  )
  ];

  locais.sort((a, b) =>
  a.localeCompare(b)
  );

  selectLocal.innerHTML =
  '<option value="">Todos os locais</option>';

  locais.forEach(local => {

   const option =
       document.createElement("option");

   option.value = local;
   option.textContent = local;

   selectLocal.appendChild(option);

  });
  }

/*

* APLICAR FILTROS
  */
  function aplicarFiltros() {

  const nome =
  document
  .getElementById("filtroNome")
  .value
  .trim()
  .toLowerCase();

  const dataInicio =
  document
  .getElementById("filtroDataInicio")
  .value;

  const dataFim =
  document
  .getElementById("filtroDataFim")
  .value;

  const horaInicio =
  document
  .getElementById("filtroHoraInicio")
  .value;

  const horaFim =
  document
  .getElementById("filtroHoraFim")
  .value;

  const local =
  document
  .getElementById("filtroLocal")
  .value;

  const status =
  document
  .getElementById("filtroStatus")
  .value
  .toLowerCase();

  /*

  * Verifica se a data inicial
  * é maior que a data final
    */
    if (
    dataInicio &&
    dataFim &&
    dataInicio > dataFim
    ) {

    alert(
    "A data inicial não pode ser maior que a data final."
    );

    return;
    }

  /*

  * Verifica se a hora inicial
  * é maior que a hora final
    */
    if (
    horaInicio &&
    horaFim &&
    horaInicio > horaFim
    ) {

    alert(
    "A hora inicial não pode ser maior que a hora final."
    );

    return;
    }

  const resultados =
  todosRegistros.filter(registro => {

       /*
        * NOME
        */
       if (nome) {

           const nomeRegistro =
               String(registro.nome || "")
                   .toLowerCase();

           if (!nomeRegistro.includes(nome)) {
               return false;
           }
       }


       /*
        * DATA
        */
       const dataRegistro =
           normalizarData(registro.data);


       if (dataInicio) {

           if (
               !dataRegistro ||
               dataRegistro < dataInicio
           ) {
               return false;
           }
       }


       if (dataFim) {

           if (
               !dataRegistro ||
               dataRegistro > dataFim
           ) {
               return false;
           }
       }


       /*
        * HORA
        */
       const horaRegistro =
           normalizarHora(registro.hora);


       if (horaInicio) {

           if (
               !horaRegistro ||
               horaRegistro < horaInicio
           ) {
               return false;
           }
       }


       if (horaFim) {

           if (
               !horaRegistro ||
               horaRegistro > horaFim
           ) {
               return false;
           }
       }


       /*
        * LOCAL
        */
       if (local) {

           if (
               String(registro.local || "") !== local
           ) {
               return false;
           }
       }


       /*
        * STATUS
        */
       if (status) {

           const statusRegistro =
               normalizarStatus(
                   registro.status
               );

           if (statusRegistro !== status) {
               return false;
           }
       }


       return true;
   });

  exibirRegistros(resultados);
  }

/*

* NORMALIZAR DATA
  */
  function normalizarData(data) {

  if (!data) {
  return "";
  }

  data = String(data).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
  return data;
  }

  const partes = data.split("/");

  if (partes.length === 3) {

   const dia = partes[0];
   const mes = partes[1];
   const ano = partes[2];

   return `${ano}-${mes}-${dia}`;

  }

  return data;
  }

/*

* NORMALIZAR HORA
  */
  function normalizarHora(hora) {

  if (!hora) {
  return "";
  }

  hora = String(hora).trim();

  if (hora.length >= 5) {
  return hora.substring(0, 5);
  }

  return hora;
  }

/*

* NORMALIZAR STATUS
  */
  function normalizarStatus(status) {

  if (!status) {
  return "";
  }

  const valor =
  String(status)
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

  if (
  valor === "autorizado" ||
  valor === "permitido" ||
  valor === "authorized"
  ) {
  return "autorizado";
  }

  if (
  valor === "nao autorizado" ||
  valor === "negado" ||
  valor === "nao permitido" ||
  valor === "denied"
  ) {
  return "nao autorizado";
  }

  return valor;
  }

/*

* EXIBIR REGISTROS
  */
  function exibirRegistros(registros) {

  const tabela =
  document.getElementById("historico");

  const mensagem =
  document.getElementById("mensagem");

  tabela.innerHTML = "";

  if (registros.length === 0) {

   mensagem.textContent =
       "Nenhum registro encontrado.";

   return;

  }

  mensagem.textContent =
  `${registros.length} registro(s) encontrado(s).`;

  registros.forEach(registro => {

   const linha =
       document.createElement("tr");


   const statusNormalizado =
       normalizarStatus(
           registro.status
       );


   const classeStatus =
       statusNormalizado === "autorizado"
           ? "autorizado"
           : "negado";


   linha.innerHTML = `
       <td>${escapeHTML(
           registro.nome || "Desconhecido"
       )}</td>

       <td>${escapeHTML(
           registro.data || ""
       )}</td>

       <td>${escapeHTML(
           registro.hora || ""
       )}</td>

       <td>${escapeHTML(
           registro.local || ""
       )}</td>

       <td class="${classeStatus}">
           ${escapeHTML(
               registro.status || ""
           )}
       </td>
   `;


   tabela.appendChild(linha);

  });
  }

/*

* PROTEÇÃO CONTRA HTML
  */
function escapeHTML(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/*

* =========================
* CONTROLE DOS FILTROS
* =========================
  */

const btnAbrirFiltros =
document.getElementById("btnAbrirFiltros");

const painelFiltros =
document.getElementById("painelFiltros");

/*

* ABRIR / FECHAR FILTROS
  */
  btnAbrirFiltros.addEventListener(
  "click",
  () => {

   const aberto =
       painelFiltros.classList.toggle("aberto");

   btnAbrirFiltros.setAttribute(
       "aria-expanded",
       aberto
   );

   painelFiltros.setAttribute(
       "aria-hidden",
       !aberto
   );

   btnAbrirFiltros.classList.toggle(
       "ativo",
       aberto
   );

  }
  );

/*

* =========================
* PERÍODO DE DATA
* =========================
  */

const btnPeriodoData =
document.getElementById("btnPeriodoData");

const periodoData =
document.getElementById("periodoData");

btnPeriodoData.addEventListener(
"click",
evento => {

    evento.stopPropagation();

    periodoData.classList.toggle("aberto");

    periodoHora.classList.remove("aberto");
}

);

/*

* =========================
* PERÍODO DE HORA
* =========================
  */

const btnPeriodoHora =
document.getElementById("btnPeriodoHora");

const periodoHora =
document.getElementById("periodoHora");

btnPeriodoHora.addEventListener(
"click",
evento => {

    evento.stopPropagation();

    periodoHora.classList.toggle("aberto");

    periodoData.classList.remove("aberto");
}

);

/*

* Impede que o clique
* dentro dos períodos feche o campo
  */
  periodoData.addEventListener(
  "click",
  evento => {
  evento.stopPropagation();
  }
  );

periodoHora.addEventListener(
"click",
evento => {
evento.stopPropagation();
}
);

/*

* Fecha os períodos quando
* clicar fora deles
  */
  document.addEventListener(
  "click",
  evento => {

   if (
       !evento.target.closest(".filtro-periodo")
   ) {

       periodoData.classList.remove("aberto");

       periodoHora.classList.remove("aberto");
   }

  }
  );

/*

* =========================
* ATUALIZAR TEXTO DA DATA
* =========================
  */

function atualizarTextoData() {

const inicio =
    document.getElementById("filtroDataInicio").value;

const fim =
    document.getElementById("filtroDataFim").value;

const texto =
    document.getElementById("textoPeriodoData");


if (!inicio && !fim) {

    texto.textContent =
        "Selecionar período";

    return;
}


if (inicio && !fim) {

    texto.textContent =
        formatarData(inicio);

    return;
}


if (!inicio && fim) {

    texto.textContent =
        "Até " + formatarData(fim);

    return;
}


texto.textContent =
    `${formatarData(inicio)} até ${formatarData(fim)}`;

}

/*

* =========================
* ATUALIZAR TEXTO DA HORA
* =========================
  */

function atualizarTextoHora() {

const inicio =
    document.getElementById("filtroHoraInicio").value;

const fim =
    document.getElementById("filtroHoraFim").value;

const texto =
    document.getElementById("textoPeriodoHora");


if (!inicio && !fim) {

    texto.textContent =
        "Selecionar horário";

    return;
}


if (inicio && !fim) {

    texto.textContent =
        inicio;

    return;
}


if (!inicio && fim) {

    texto.textContent =
        "Até " + fim;

    return;
}


texto.textContent =
    `${inicio} até ${fim}`;

}

/*

* FORMATAR DATA PARA EXIBIÇÃO
  */
  function formatarData(data) {

  if (!data) {
  return "";
  }

  const partes =
  data.split("-");

  if (partes.length !== 3) {
  return data;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

/*

* Atualiza os textos quando
* o usuário altera as datas
  */
  document
  .getElementById("filtroDataInicio")
  .addEventListener(
  "change",
  atualizarTextoData
  );

document
.getElementById("filtroDataFim")
.addEventListener(
"change",
atualizarTextoData
);

/*

* Atualiza os textos quando
* o usuário altera os horários
  */
  document
  .getElementById("filtroHoraInicio")
  .addEventListener(
  "change",
  atualizarTextoHora
  );

document
.getElementById("filtroHoraFim")
.addEventListener(
"change",
atualizarTextoHora
);

/*

* =========================
* BOTÃO BUSCAR
* =========================
  */

document
.getElementById("btnBuscar")
.addEventListener(
"click",
() => {

        aplicarFiltros();

        periodoData.classList.remove("aberto");

        periodoHora.classList.remove("aberto");
    }
);

/*

* =========================
* BOTÃO LIMPAR
* =========================
  */

document
.getElementById("btnLimpar")
.addEventListener(
"click",
() => {

        document
            .getElementById("filtroNome")
            .value = "";


        document
            .getElementById("filtroDataInicio")
            .value = "";


        document
            .getElementById("filtroDataFim")
            .value = "";


        document
            .getElementById("filtroHoraInicio")
            .value = "";


        document
            .getElementById("filtroHoraFim")
            .value = "";


        document
            .getElementById("filtroLocal")
            .value = "";


        document
            .getElementById("filtroStatus")
            .value = "";


        atualizarTextoData();

        atualizarTextoHora();


        periodoData.classList.remove("aberto");

        periodoHora.classList.remove("aberto");


        exibirRegistros(todosRegistros);
    }
);

/*

* =========================
* ENTER NO NOME
* =========================
  */

document
.getElementById("filtroNome")
.addEventListener(
"keydown",
evento => {

        if (evento.key === "Enter") {

            aplicarFiltros();

            periodoData.classList.remove("aberto");

            periodoHora.classList.remove("aberto");
        }
    }
);

/*

* INICIAR
  */
  document.addEventListener(
  "DOMContentLoaded",
  carregarHistorico
  );
