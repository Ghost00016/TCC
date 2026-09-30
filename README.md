```
-- Criando a tabela de locais
CREATE TABLE locais (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nome_local VARCHAR(100) NOT NULL
);

-- Criando a tabela de pessoas
CREATE TABLE pessoas (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    idade INT NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE KEY,
    sexo VARCHAR(20) NOT NULL,
    cargo VARCHAR(50) NOT NULL,
    locais_acesso VARCHAR(255) NOT NULL DEFAULT '',
    embedding LONGTEXT
);

-- Criando a tabela de registros
CREATE TABLE registros (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_pessoa INT DEFAULT NULL,
    id_local INT NOT NULL,
    hr_acesso DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    CONSTRAINT registros_ibfk_1 FOREIGN KEY (id_pessoa) REFERENCES pessoas (id) ON DELETE SET NULL,
    CONSTRAINT registros_ibfk_2 FOREIGN KEY (id_local) REFERENCES locais (id) ON DELETE CASCADE
);

-- Criando a tabela de usuários
CREATE TABLE usuarios (
    id_usuario INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE KEY,
    senha VARCHAR(255) NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    ativo TINYINT(1) DEFAULT '1'
);

```
