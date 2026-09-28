const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const { spawn } = require("child_process");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const fs = require("fs");

const app = express();
const PORTA = 5000;

console.log("CONFIGURAÇÕES");

app.use(express.json({ limit: "10mb" }));

app.use(session({
    secret: "chave-secreta-tcc",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 8
    }
}));

console.log("BANCO DE DADOS");

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "admin",
    database: "tcc",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((erro, conexao) => {
    if (erro) {
        console.error(
            "Erro ao conectar ao MySQL:",
            erro.message
        );
        return;
    }

    console.log(
        "MySQL conectado com sucesso."
    );

    conexao.release();
});

const pastaProjeto = path.join(__dirname, "..");

app.use(express.static(pastaProjeto));

console.log("LOGIN");

function verificarLogin(req, res, next) {
    if (!req.session.usuario) {
        return res.status(401).json({
            erro: "Você precisa estar logado para realizar esta ação."
        });
    }

    next();
}

app.get("/", (req, res) => {
    res.send("Servidor do TCC funcionando!");
});

app.post("/api/login", (req, res) => {
    const { usuario, senha } = req.body;

    console.log("LOGIN");
    console.log("Usuário:", usuario);

    if (!usuario || !senha) {
        return res.status(400).json({
            erro: "Preencha o usuário e a senha."
        });
    }

    const sql = `
        SELECT id_usuario, usuario, senha, ativo
        FROM usuarios
        WHERE usuario = ?
        LIMIT 1
    `;

    db.query(
        sql,
        [usuario],
        async (erro, resultados) => {
            if (erro) {
                console.error(
                    "Erro ao consultar usuário:",
                    erro
                );

                return res.status(500).json({
                    erro: "Erro ao consultar o banco."
                });
            }

            if (resultados.length === 0) {
                return res.status(401).json({
                    erro: "Usuário ou senha incorretos."
                });
            }

            const usuarioBanco = resultados[0];

            if (!usuarioBanco.ativo) {
                return res.status(403).json({
                    erro: "Este usuário está desativado."
                });
            }

            const senhaCorreta = await bcrypt.compare(
                senha,
                usuarioBanco.senha
            );

            if (!senhaCorreta) {
                return res.status(401).json({
                    erro: "Usuário ou senha incorretos."
                });
            }

            req.session.usuario =
                usuarioBanco.usuario;

            req.session.id_usuario =
                usuarioBanco.id_usuario;

            console.log(
                "Login realizado com sucesso."
            );

            return res.json({
                sucesso: true,
                mensagem: "Login realizado com sucesso.",
                usuario: usuarioBanco.usuario
            });
        }
    );
});

app.get("/api/sessao", (req, res) => {
    if (!req.session.usuario) {
        return res.json({
            logado: false
        });
    }

    return res.json({
        logado: true,
        usuario: req.session.usuario,
        id_usuario: req.session.id_usuario
    });
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(erro => {
        if (erro) {
            console.error(
                "Erro ao sair:",
                erro
            );

            return res.status(500).json({
                erro: "Não foi possível encerrar a sessão."
            });
        }

        res.clearCookie("connect.sid");

        return res.json({
            sucesso: true,
            mensagem: "Logout realizado com sucesso."
        });
    });
});

console.log("CADASTRO DE USUÁRIO");

app.post(
    "/api/cadastro-usuario",
    async (req, res) => {
        console.log("CADASTRO DE USUÁRIO");

        console.log(
            "Usuário que está cadastrando:",
            req.session.usuario || "Não está logado"
        );

        const { usuario, senha } = req.body;

        if (!usuario || !senha) {
            return res.status(400).json({
                erro: "Preencha todos os campos."
            });
        }

        if (usuario.length < 3) {
            return res.status(400).json({
                erro: "O usuário deve possuir pelo menos 3 caracteres."
            });
        }

        if (senha.length < 6) {
            return res.status(400).json({
                erro: "A senha deve possuir pelo menos 6 caracteres."
            });
        }

        const sqlVerificar = `
            SELECT id_usuario
            FROM usuarios
            WHERE usuario = ?
            LIMIT 1
        `;

        db.query(
            sqlVerificar,
            [usuario],
            async (erro, resultados) => {
                if (erro) {
                    console.error(
                        "Erro ao verificar usuário:",
                        erro
                    );

                    return res.status(500).json({
                        erro: "Erro ao consultar o banco."
                    });
                }

                if (resultados.length > 0) {
                    return res.status(400).json({
                        erro: "Esse usuário já existe."
                    });
                }

                try {
                    const senhaHash =
                        await bcrypt.hash(
                            senha,
                            10
                        );

                    console.log(
                        "Senha transformada em HASH."
                    );

                    const sqlInserir = `
                        INSERT INTO usuarios
                        (usuario, senha)
                        VALUES (?, ?)
                    `;

                    db.query(
                        sqlInserir,
                        [usuario, senhaHash],
                        (erro, resultado) => {
                            if (erro) {
                                console.error(
                                    "Erro ao inserir usuário:",
                                    erro
                                );

                                return res.status(500).json({
                                    erro: "Erro ao salvar usuário no banco."
                                });
                            }

                            console.log(
                                "Usuário cadastrado com sucesso."
                            );

                            console.log(
                                "ID do usuário:",
                                resultado.insertId
                            );

                            return res.json({
                                sucesso: true,
                                mensagem: "Usuário cadastrado com sucesso!"
                            });
                        }
                    );
                } catch (erro) {
                    console.error(
                        "Erro ao gerar HASH:",
                        erro
                    );

                    return res.status(500).json({
                        erro: "Erro ao proteger a senha."
                    });
                }
            }
        );
    }
);

console.log("LOCAIS");

app.get(
    "/api/locais",
    verificarLogin,
    (req, res) => {
        const sql = `
            SELECT id, nome_local
            FROM locais
            ORDER BY id
        `;

        db.query(
            sql,
            (erro, resultados) => {
                if (erro) {
                    console.error(
                        "Erro ao consultar locais:",
                        erro
                    );

                    return res.status(500).json({
                        erro: "Erro ao consultar os locais."
                    });
                }

                return res.json(resultados);
            }
        );
    }
);

app.post(
    "/api/locais",
    verificarLogin,
    (req, res) => {
        const nome_local =
            req.body.nome_local;

        if (
            typeof nome_local !== "string" ||
            nome_local.trim() === ""
        ) {
            return res.status(400).json({
                erro: "Informe o nome do local."
            });
        }

        const nome = nome_local.trim();

        const sqlVerificar = `
            SELECT id
            FROM locais
            WHERE nome_local = ?
        `;

        db.query(
            sqlVerificar,
            [nome],
            (erro, resultados) => {
                if (erro) {
                    console.error(
                        "Erro ao verificar local:",
                        erro
                    );

                    return res.status(500).json({
                        erro: "Erro ao verificar o local."
                    });
                }

                if (resultados.length > 0) {
                    return res.status(400).json({
                        erro: "Já existe um local com esse nome."
                    });
                }

                const sql = `
                    INSERT INTO locais
                    (nome_local)
                    VALUES (?)
                `;

                db.query(
                    sql,
                    [nome],
                    (erro, resultado) => {
                        if (erro) {
                            console.error(
                                "Erro ao cadastrar local:",
                                erro
                            );

                            return res.status(500).json({
                                erro: "Erro ao cadastrar o local."
                            });
                        }

                        res.status(201).json({
                            mensagem: "Local cadastrado com sucesso.",
                            id: resultado.insertId
                        });
                    }
                );
            }
        );
    }
);

app.put(
    "/api/locais/:id",
    verificarLogin,
    (req, res) => {
        const id =
            parseInt(req.params.id);

        const nome_local =
            req.body.nome_local;

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            return res.status(400).json({
                erro: "ID do local inválido."
            });
        }

        if (
            typeof nome_local !== "string" ||
            nome_local.trim() === ""
        ) {
            return res.status(400).json({
                erro: "Informe o nome do local."
            });
        }

        const nome =
            nome_local.trim();

        const sqlVerificar = `
            SELECT id
            FROM locais
            WHERE nome_local = ?
            AND id <> ?
        `;

        db.query(
            sqlVerificar,
            [nome, id],
            (erro, resultados) => {
                if (erro) {
                    console.error(
                        "Erro ao verificar local:",
                        erro
                    );

                    return res.status(500).json({
                        erro: "Erro ao verificar o local."
                    });
                }

                if (resultados.length > 0) {
                    return res.status(400).json({
                        erro: "Já existe um local com esse nome."
                    });
                }

                const sql = `
                    UPDATE locais
                    SET nome_local = ?
                    WHERE id = ?
                `;

                db.query(
                    sql,
                    [nome, id],
                    (erro, resultado) => {
                        if (erro) {
                            console.error(
                                "Erro ao alterar local:",
                                erro
                            );

                            return res.status(500).json({
                                erro: "Erro ao alterar o local."
                            });
                        }

                        if (
                            resultado.affectedRows === 0
                        ) {
                            return res.status(404).json({
                                erro: "Local não encontrado."
                            });
                        }

                        res.json({
                            mensagem: "Local alterado com sucesso."
                        });
                    }
                );
            }
        );
    }
);

app.delete(
    "/api/locais/:id",
    verificarLogin,
    (req, res) => {
        const id =
            parseInt(req.params.id);

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            return res.status(400).json({
                erro: "ID do local inválido."
            });
        }

        db.getConnection(
            (erro, conexao) => {
                if (erro) {
                    console.error(
                        "Erro ao obter conexão:",
                        erro
                    );

                    return res.status(500).json({
                        erro: "Erro ao conectar ao banco."
                    });
                }

                conexao.beginTransaction(
                    erro => {
                        if (erro) {
                            conexao.release();

                            return res.status(500).json({
                                erro: "Erro ao iniciar operação."
                            });
                        }

                        const sqlVerificar = `
                            SELECT id
                            FROM locais
                            WHERE id = ?
                        `;

                        conexao.query(
                            sqlVerificar,
                            [id],
                            (erro, resultado) => {
                                if (erro) {
                                    return conexao.rollback(
                                        () => {
                                            conexao.release();

                                            console.error(
                                                "Erro ao verificar local:",
                                                erro
                                            );

                                            res.status(500).json({
                                                erro: "Erro ao verificar o local."
                                            });
                                        }
                                    );
                                }

                                if (
                                    resultado.length === 0
                                ) {
                                    return conexao.rollback(
                                        () => {
                                            conexao.release();

                                            res.status(404).json({
                                                erro: "Local não encontrado."
                                            });
                                        }
                                    );
                                }

                                const sqlPessoas = `
                                    SELECT id, locais_acesso
                                    FROM pessoas
                                `;

                                conexao.query(
                                    sqlPessoas,
                                    (erro, pessoas) => {
                                        if (erro) {
                                            return conexao.rollback(
                                                () => {
                                                    conexao.release();

                                                    console.error(
                                                        "Erro ao consultar pessoas:",
                                                        erro
                                                    );

                                                    res.status(500).json({
                                                        erro: "Erro ao consultar as pessoas."
                                                    });
                                                }
                                            );
                                        }

                                        let pendentes = 0;
                                        let finalizado = false;

                                        const atualizarPessoas = () => {
                                            if (
                                                pendentes > 0 ||
                                                finalizado
                                            ) {
                                                return;
                                            }

                                            finalizado = true;

                                            const sqlDeletar = `
                                                DELETE FROM locais
                                                WHERE id = ?
                                            `;

                                            conexao.query(
                                                sqlDeletar,
                                                [id],
                                                erro => {
                                                    if (erro) {
                                                        return conexao.rollback(
                                                            () => {
                                                                conexao.release();

                                                                if (
                                                                    erro.code ===
                                                                    "ER_ROW_IS_REFERENCED_2"
                                                                ) {
                                                                    return res.status(400).json({
                                                                        erro: "Não é possível deletar este local porque existem registros de acesso relacionados a ele."
                                                                    });
                                                                }

                                                                console.error(
                                                                    "Erro ao deletar local:",
                                                                    erro
                                                                );

                                                                res.status(500).json({
                                                                    erro: "Erro ao deletar o local."
                                                                });
                                                            }
                                                        );
                                                    }

                                                    conexao.commit(
                                                        erro => {
                                                            if (erro) {
                                                                return conexao.rollback(
                                                                    () => {
                                                                        conexao.release();

                                                                        console.error(
                                                                            "Erro ao confirmar operação:",
                                                                            erro
                                                                        );

                                                                        res.status(500).json({
                                                                            erro: "Erro ao deletar o local."
                                                                        });
                                                                    }
                                                                );
                                                            }

                                                            conexao.release();

                                                            res.json({
                                                                mensagem: "Local deletado com sucesso."
                                                            });
                                                        }
                                                    );
                                                }
                                            );
                                        };

                                        pessoas.forEach(
                                            pessoa => {
                                                const locais =
                                                    String(
                                                        pessoa.locais_acesso || ""
                                                    )
                                                        .split(",")
                                                        .map(
                                                            local =>
                                                                local.trim()
                                                        )
                                                        .filter(
                                                            local =>
                                                                local &&
                                                                local !==
                                                                    String(id)
                                                        );

                                                const novosLocais =
                                                    locais.join(",");

                                                if (
                                                    novosLocais !==
                                                    pessoa.locais_acesso
                                                ) {
                                                    pendentes++;

                                                    const sqlAtualizar = `
                                                        UPDATE pessoas
                                                        SET locais_acesso = ?
                                                        WHERE id = ?
                                                    `;

                                                    conexao.query(
                                                        sqlAtualizar,
                                                        [
                                                            novosLocais,
                                                            pessoa.id
                                                        ],
                                                        erro => {
                                                            if (erro) {
                                                                return conexao.rollback(
                                                                    () => {
                                                                        conexao.release();

                                                                        console.error(
                                                                            "Erro ao atualizar pessoa:",
                                                                            erro
                                                                        );

                                                                        res.status(500).json({
                                                                            erro: "Erro ao atualizar os acessos das pessoas."
                                                                        });
                                                                    }
                                                                );
                                                            }

                                                            pendentes--;

                                                            atualizarPessoas();
                                                        }
                                                    );
                                                }
                                            }
                                        );

                                        atualizarPessoas();
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

console.log("HISTÓRICO");

app.get(
    "/api/registros",
    verificarLogin,
    (req, res) => {
        console.log(
            "================================="
        );

        console.log(
            "ACESSANDO /api/registros"
        );

        console.log(
            "Sessão:",
            req.session
        );

        console.log(
            "Usuário:",
            req.session.usuario
        );

        console.log(
            "ID usuário:",
            req.session.id_usuario
        );

        console.log(
            "================================="
        );

        const sql = `
            SELECT
                registros.id,
                pessoas.nome AS nome,
                DATE_FORMAT(
                    registros.hr_acesso,
                    '%d/%m/%Y'
                ) AS data,
                DATE_FORMAT(
                    registros.hr_acesso,
                    '%H:%i:%s'
                ) AS hora,
                locais.nome_local AS local,
                registros.status
            FROM registros
            LEFT JOIN pessoas
                ON registros.id_pessoa = pessoas.id
            INNER JOIN locais
                ON registros.id_local = locais.id
            ORDER BY registros.hr_acesso DESC
        `;

        db.query(
            sql,
            (erro, resultados) => {
                if (erro) {
                    console.error(
                        "Erro ao consultar registros:",
                        erro
                    );

                    return res.status(500).json({
                        erro: "Erro ao consultar o banco"
                    });
                }

                res.json(resultados);
            }
        );
    }
);

console.log("CADASTRO DE PESSOA");
console.log("ROTA /api/cadastro FOI REGISTRADA");

app.post(
    "/api/cadastro",
    verificarLogin,
    (req, res) => {
        console.log("CADASTRO");

        console.log(
            "Usuário logado:",
            req.session.usuario
        );

        const {
            nome,
            idade,
            cpf,
            sexo,
            cargo,
            locais_acesso
        } = req.body;

        console.log("Nome:", nome);
        console.log("CPF:", cpf);
        console.log("Cargo:", cargo);
        console.log(
            "Locais de acesso:",
            locais_acesso
        );

        if (
            !nome ||
            !idade ||
            !cpf ||
            !sexo ||
            !cargo ||
            !locais_acesso
        ) {
            return res.status(400).json({
                erro: "Preencha todos os campos."
            });
        }

        if (
            typeof locais_acesso !== "string" ||
            locais_acesso.trim() === ""
        ) {
            return res.status(400).json({
                erro: "Selecione pelo menos um local de acesso."
            });
        }

        const locaisArray =
            locais_acesso
                .split(",")
                .map(
                    id =>
                        parseInt(
                            id.trim()
                        )
                )
                .filter(
                    id =>
                        Number.isInteger(id) &&
                        id > 0
                );

        if (
            locaisArray.length === 0
        ) {
            return res.status(400).json({
                erro: "Selecione pelo menos um local de acesso."
            });
        }

        const locaisFormatados =
            [
                ...new Set(
                    locaisArray
                )
            ].join(",");

        const cpfFormatado =
            cpf.replace(
                /\D/g,
                ""
            );

        if (
            cpfFormatado.length !== 11
        ) {
            return res.status(400).json({
                erro: "CPF inválido."
            });
        }

        const cpfBanco =
            cpfFormatado.substring(0, 3) +
            "." +
            cpfFormatado.substring(3, 6) +
            "." +
            cpfFormatado.substring(6, 9) +
            "-" +
            cpfFormatado.substring(9, 11);

        const sqlCPF = `
            SELECT id
            FROM pessoas
            WHERE cpf = ?
            LIMIT 1
        `;

        db.query(
            sqlCPF,
            [cpfBanco],
            (erro, resultados) => {
                if (erro) {
                    console.error(
                        "Erro ao verificar CPF:",
                        erro
                    );

                    return res.status(500).json({
                        erro: "Erro ao consultar o banco."
                    });
                }

                if (
                    resultados.length > 0
                ) {
                    return res.status(400).json({
                        erro: "Esse CPF já está cadastrado."
                    });
                }

                console.log(
                    "INICIANDO CADASTRO FACIAL"
                );

                const caminhoPython =
                    path.join(
                        pastaProjeto,
                        "cadastro.py"
                    );

                console.log(
                    "Arquivo:",
                    caminhoPython
                );

                console.log(
                    "Python utilizado:",
                    "Python 3.12"
                );

                const dadosPython =
                    JSON.stringify({
                        nome,
                        idade:
                            parseInt(idade),
                        cpf: cpfBanco,
                        sexo,
                        cargo,
                        locais_acesso:
                            locaisFormatados
                    });

                console.log(
                    "Dados enviados para Python:",
                    dadosPython
                );

                const python =
                    spawn(
                        "py",
                        [
                            "-3.12",
                            caminhoPython,
                            dadosPython
                        ],
                        {
                            cwd: pastaProjeto,
                            windowsHide: false
                        }
                    );

                let saidaPython = "";
                let erroPython = "";
                let respostaEnviada = false;

                python.stdout.on(
                    "data",
                    dados => {
                        const texto =
                            dados.toString();

                        saidaPython +=
                            texto;

                        console.log(
                            "[PYTHON]",
                            texto
                        );
                    }
                );

                python.stderr.on(
                    "data",
                    dados => {
                        const texto =
                            dados.toString();

                        erroPython +=
                            texto;

                        console.error(
                            "[PYTHON ERRO]",
                            texto
                        );
                    }
                );

                python.on(
                    "close",
                    codigo => {
                        console.log(
                            "PYTHON FINALIZADO"
                        );

                        console.log(
                            "Código:",
                            codigo
                        );

                        if (
                            respostaEnviada
                        ) {
                            return;
                        }

                        respostaEnviada =
                            true;

                        if (
                            codigo === 0 &&
                            saidaPython.includes(
                                "CADASTRO_CONCLUIDO"
                            )
                        ) {
                            console.log(
                                "CADASTRO CONCLUÍDO COM SUCESSO!"
                            );

                            return res.json({
                                sucesso: true,
                                mensagem: "Cadastro realizado com sucesso!"
                            });
                        }

                        console.log(
                            "CADASTRO NÃO FOI CONCLUÍDO."
                        );

                        return res.status(500).json({
                            erro: "Não foi possível concluir o cadastro facial.",
                            detalhes:
                                erroPython ||
                                saidaPython
                        });
                    }
                );

                python.on(
                    "error",
                    erro => {
                        console.error(
                            "Erro ao iniciar Python:",
                            erro
                        );

                        if (
                            respostaEnviada
                        ) {
                            return;
                        }

                        respostaEnviada =
                            true;

                        return res.status(500).json({
                            erro: "Não foi possível iniciar o Python.",
                            detalhes:
                                erro.message
                        });
                    }
                );
            }
        );
    }
);

console.log(
    "GERENCIAMENTO DE PESSOAS"
);

app.get(
    "/api/pessoas",
    verificarLogin,
    (req, res) => {
        const sql = `
            SELECT
                id,
                nome,
                idade,
                cpf,
                sexo,
                cargo,
                locais_acesso
            FROM pessoas
            ORDER BY nome
        `;

        db.query(
            sql,
            (erro, resultados) => {
                if (erro) {
                    console.error(
                        "Erro ao consultar pessoas:",
                        erro
                    );

                    return res.status(500).json({
                        erro: "Erro ao consultar as pessoas."
                    });
                }

                return res.json(
                    resultados
                );
            }
        );
    }
);

app.put(
    "/api/pessoas/:id",
    verificarLogin,
    (req, res) => {
        const id =
            parseInt(req.params.id);

        const {
            nome,
            idade,
            cpf,
            sexo,
            cargo,
            locais_acesso
        } = req.body;

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            return res.status(400).json({
                erro: "ID da pessoa inválido."
            });
        }

        if (
            !nome ||
            !idade ||
            !cpf ||
            !sexo ||
            !cargo ||
            !locais_acesso
        ) {
            return res.status(400).json({
                erro: "Preencha todos os campos."
            });
        }

        const cpfFormatado =
            cpf.replace(
                /\D/g,
                ""
            );

        if (
            cpfFormatado.length !== 11
        ) {
            return res.status(400).json({
                erro: "CPF inválido."
            });
        }

        const cpfBanco =
            cpfFormatado.substring(0, 3) +
            "." +
            cpfFormatado.substring(3, 6) +
            "." +
            cpfFormatado.substring(6, 9) +
            "-" +
            cpfFormatado.substring(9, 11);

        const locaisFormatados =
            String(locais_acesso)
                .split(",")
                .map(
                    idLocal =>
                        idLocal.trim()
                )
                .filter(
                    idLocal =>
                        /^\d+$/.test(
                            idLocal
                        )
                )
                .map(
                    idLocal =>
                        parseInt(
                            idLocal
                        )
                )
                .filter(
                    idLocal =>
                        idLocal > 0
                );

        if (
            locaisFormatados.length === 0
        ) {
            return res.status(400).json({
                erro: "Selecione pelo menos um local de acesso."
            });
        }

        const locaisUnicos =
            [
                ...new Set(
                    locaisFormatados
                )
            ];

        const locaisString =
            locaisUnicos.join(",");

        const sqlPessoa = `
            SELECT id, nome, cpf
            FROM pessoas
            WHERE id = ?
            LIMIT 1
        `;

        db.query(
            sqlPessoa,
            [id],
            (erro, pessoas) => {
                if (erro) {
                    console.error(
                        "Erro ao consultar pessoa:",
                        erro
                    );

                    return res.status(500).json({
                        erro: "Erro ao consultar a pessoa."
                    });
                }

                if (
                    pessoas.length === 0
                ) {
                    return res.status(404).json({
                        erro: "Pessoa não encontrada."
                    });
                }

                const pessoaAtual =
                    pessoas[0];

                const sqlCPF = `
                    SELECT id
                    FROM pessoas
                    WHERE cpf = ?
                    AND id <> ?
                    LIMIT 1
                `;

                db.query(
                    sqlCPF,
                    [
                        cpfBanco,
                        id
                    ],
                    (
                        erro,
                        resultadoCPF
                    ) => {
                        if (erro) {
                            console.error(
                                "Erro ao verificar CPF:",
                                erro
                            );

                            return res.status(500).json({
                                erro: "Erro ao verificar o CPF."
                            });
                        }

                        if (
                            resultadoCPF.length > 0
                        ) {
                            return res.status(400).json({
                                erro: "Esse CPF já está cadastrado."
                            });
                        }

                        const sqlLocais = `
                            SELECT id
                            FROM locais
                            WHERE id IN (?)
                        `;

                        db.query(
                            sqlLocais,
                            [locaisUnicos],
                            (
                                erro,
                                locaisExistentes
                            ) => {
                                if (erro) {
                                    console.error(
                                        "Erro ao verificar locais:",
                                        erro
                                    );

                                    return res.status(500).json({
                                        erro: "Erro ao verificar os locais."
                                    });
                                }

                                if (
                                    locaisExistentes.length !==
                                    locaisUnicos.length
                                ) {
                                    return res.status(400).json({
                                        erro: "Um ou mais locais não existem."
                                    });
                                }

                                const nomeAntigo =
                                    pessoaAtual.nome.replace(
                                        / /g,
                                        "_"
                                    );

                                const nomeNovo =
                                    nome
                                        .trim()
                                        .replace(
                                            / /g,
                                            "_"
                                        );

                                const pastaAntiga =
                                    path.join(
                                        pastaProjeto,
                                        "fotos",
                                        nomeAntigo
                                    );

                                const pastaNova =
                                    path.join(
                                        pastaProjeto,
                                        "fotos",
                                        nomeNovo
                                    );

                                function atualizarBanco() {
                                    const sqlUpdate = `
                                        UPDATE pessoas
                                        SET
                                            nome = ?,
                                            idade = ?,
                                            cpf = ?,
                                            sexo = ?,
                                            cargo = ?,
                                            locais_acesso = ?
                                        WHERE id = ?
                                    `;

                                    db.query(
                                        sqlUpdate,
                                        [
                                            nome.trim(),
                                            idade,
                                            cpfBanco,
                                            sexo,
                                            cargo.trim(),
                                            locaisString,
                                            id
                                        ],
                                        erro => {
                                            if (erro) {
                                                console.error(
                                                    "Erro ao alterar pessoa:",
                                                    erro
                                                );

                                                return res.status(500).json({
                                                    erro: "Erro ao alterar a pessoa."
                                                });
                                            }

                                            return res.json({
                                                sucesso: true,
                                                mensagem: "Pessoa alterada com sucesso."
                                            });
                                        }
                                    );
                                }

                                if (
                                    nomeAntigo !==
                                        nomeNovo &&
                                    fs.existsSync(
                                        pastaAntiga
                                    )
                                ) {
                                    if (
                                        fs.existsSync(
                                            pastaNova
                                        )
                                    ) {
                                        return res.status(400).json({
                                            erro: "Já existe uma pasta de fotos com esse nome."
                                        });
                                    }

                                    fs.rename(
                                        pastaAntiga,
                                        pastaNova,
                                        erro => {
                                            if (erro) {
                                                console.error(
                                                    "Erro ao renomear pasta:",
                                                    erro
                                                );

                                                return res.status(500).json({
                                                    erro: "Não foi possível renomear a pasta de fotos."
                                                });
                                            }

                                            atualizarBanco();
                                        }
                                    );
                                } else {
                                    atualizarBanco();
                                }
                            }
                        );
                    }
                );
            }
        );
    }
);

app.delete(
    "/api/pessoas/:id",
    verificarLogin,
    (req, res) => {
        const id =
            parseInt(req.params.id);

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            return res.status(400).json({
                erro: "ID da pessoa inválido."
            });
        }

        const sqlPessoa = `
            SELECT id, nome
            FROM pessoas
            WHERE id = ?
            LIMIT 1
        `;

        db.query(
            sqlPessoa,
            [id],
            (erro, pessoas) => {
                if (erro) {
                    console.error(
                        "Erro ao consultar pessoa:",
                        erro
                    );

                    return res.status(500).json({
                        erro: "Erro ao consultar a pessoa."
                    });
                }

                if (
                    pessoas.length === 0
                ) {
                    return res.status(404).json({
                        erro: "Pessoa não encontrada."
                    });
                }

                const pessoa =
                    pessoas[0];

                const nomePasta =
                    pessoa.nome.replace(
                        / /g,
                        "_"
                    );

                const pastaFotos =
                    path.join(
                        pastaProjeto,
                        "fotos",
                        nomePasta
                    );

                db.getConnection(
                    (erro, conexao) => {
                        if (erro) {
                            console.error(
                                "Erro ao obter conexão:",
                                erro
                            );

                            return res.status(500).json({
                                erro: "Erro ao conectar ao banco."
                            });
                        }

                        conexao.beginTransaction(
                            erro => {
                                if (erro) {
                                    conexao.release();

                                    return res.status(500).json({
                                        erro: "Erro ao iniciar operação."
                                    });
                                }

                                const limparRegistros = `
                                    UPDATE registros
                                    SET id_pessoa = NULL
                                    WHERE id_pessoa = ?
                                `;

                                conexao.query(
                                    limparRegistros,
                                    [id],
                                    erro => {
                                        if (erro) {
                                            return conexao.rollback(
                                                () => {
                                                    conexao.release();

                                                    console.error(
                                                        "Erro ao atualizar registros:",
                                                        erro
                                                    );

                                                    res.status(500).json({
                                                        erro: "Não foi possível remover a pessoa dos registros."
                                                    });
                                                }
                                            );
                                        }

                                        const deletarPessoa = `
                                            DELETE FROM pessoas
                                            WHERE id = ?
                                        `;

                                        conexao.query(
                                            deletarPessoa,
                                            [id],
                                            erro => {
                                                if (erro) {
                                                    return conexao.rollback(
                                                        () => {
                                                            conexao.release();

                                                            console.error(
                                                                "Erro ao deletar pessoa:",
                                                                erro
                                                            );

                                                            res.status(500).json({
                                                                erro: "Não foi possível deletar a pessoa."
                                                            });
                                                        }
                                                    );
                                                }

                                                conexao.commit(
                                                    erro => {
                                                        if (erro) {
                                                            return conexao.rollback(
                                                                () => {
                                                                    conexao.release();

                                                                    res.status(500).json({
                                                                        erro: "Não foi possível concluir a exclusão."
                                                                    });
                                                                }
                                                            );
                                                        }

                                                        conexao.release();

                                                        if (
                                                            fs.existsSync(
                                                                pastaFotos
                                                            )
                                                        ) {
                                                            fs.rm(
                                                                pastaFotos,
                                                                {
                                                                    recursive: true,
                                                                    force: true
                                                                },
                                                                erro => {
                                                                    if (erro) {
                                                                        console.error(
                                                                            "Pessoa removida, mas erro ao apagar fotos:",
                                                                            erro
                                                                        );

                                                                        return res.json({
                                                                            sucesso: true,
                                                                            mensagem: "Pessoa removida, mas a pasta de fotos não pôde ser apagada."
                                                                        });
                                                                    }

                                                                    return res.json({
                                                                        sucesso: true,
                                                                        mensagem: "Pessoa e fotos removidas com sucesso."
                                                                    });
                                                                }
                                                            );
                                                        } else {
                                                            return res.json({
                                                                sucesso: true,
                                                                mensagem: "Pessoa removida com sucesso."
                                                            });
                                                        }
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

console.log("ROTAS DE ERRO");

app.use(
    (req, res) => {
        res.status(404).send(
            "Página ou rota não encontrada."
        );
    }
);

app.use(
    (erro, req, res, next) => {
        console.error(
            "ERRO NO SERVIDOR:",
            erro
        );

        if (res.headersSent) {
            return next(erro);
        }

        res.status(500).json({
            erro: "Erro interno do servidor."
        });
    }
);

process.on(
    "uncaughtException",
    erro => {
        console.error(
            "UNCAUGHT EXCEPTION:",
            erro
        );
    }
);

process.on(
    "unhandledRejection",
    erro => {
        console.error(
            "UNHANDLED REJECTION:",
            erro
        );
    }
);

console.log("SERVIDOR");

app.listen(
    PORTA,
    () => {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "       SERVIDOR DO TCC INICIADO"
        );
        console.log(
            "========================================"
        );
        console.log(
            "Site: http://localhost:5000"
        );
        console.log(
            "Login: http://localhost:5000/login/"
        );
        console.log(
            "Cadastro: http://localhost:5000/cadastro/"
        );
        console.log(
            "Cadastro de usuário: http://localhost:5000/cadastro_usuario/"
        );
        console.log(
            "Histórico: http://localhost:5000/historico/"
        );
        console.log(
            "========================================"
        );
        console.log(
            "Banco: tcc"
        );
        console.log(
            "Python: 3.12"
        );
        console.log(
            "========================================"
        );
    }
);