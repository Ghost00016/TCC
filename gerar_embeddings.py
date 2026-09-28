import os
import json
import numpy as np
import mysql.connector
from deepface import DeepFace

PASTA_FOTOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fotos")
MODELO = "Facenet512"

# MySQL
banco = mysql.connector.connect(
    host="localhost",
    user="root",
    password="admin",
    database="tcc"
)

cursor = banco.cursor()

# Lê as pastas
pastas = [
    pasta for pasta in os.listdir(PASTA_FOTOS)
    if os.path.isdir(os.path.join(PASTA_FOTOS, pasta))
]

print(f"{len(pastas)} pastas encontradas.\n")

sucesso = 0
erros = 0

for pasta in pastas:
    nome = pasta.replace("_", " ")
    caminho_pasta = os.path.join(PASTA_FOTOS, pasta)

    print(f"Processando: {nome}")

    # Procura a pessoa pelo nome
    cursor.execute(
        "SELECT id FROM pessoas WHERE nome = %s",
        (nome,)
    )

    pessoa = cursor.fetchone()

    if not pessoa:
        print(f"  ERRO: pessoa '{nome}' não encontrada no banco.\n")
        erros += 1
        continue

    pessoa_id = pessoa[0]

    # Pega as fotos da pasta
    fotos = [
        arquivo for arquivo in os.listdir(caminho_pasta)
        if arquivo.lower().endswith((".jpg", ".jpeg", ".png"))
    ]

    if not fotos:
        print("  ERRO: nenhuma foto encontrada.\n")
        erros += 1
        continue

    embeddings = []

    for arquivo in fotos:
        caminho_foto = os.path.join(caminho_pasta, arquivo)

        try:
            resultado = DeepFace.represent(
                img_path=caminho_foto,
                model_name=MODELO,
                enforce_detection=True
            )

            embedding = np.array(resultado[0]["embedding"], dtype=np.float32)

            if embedding.shape[0] != 512:
                print(f"  ERRO: embedding inválido em {arquivo}")
                continue

            norma = np.linalg.norm(embedding)

            if norma == 0:
                continue

            embedding = embedding / norma
            embeddings.append(embedding)

        except Exception as erro:
            print(f"  Erro na foto {arquivo}: {erro}")

    if not embeddings:
        print("  ERRO: não foi possível gerar embeddings.\n")
        erros += 1
        continue

    # Calcula o embedding médio
    embedding_medio = np.mean(embeddings, axis=0)

    # Normaliza
    norma = np.linalg.norm(embedding_medio)

    if norma != 0:
        embedding_medio = embedding_medio / norma

    # Converte para JSON
    embedding_json = json.dumps(embedding_medio.tolist())

    # Salva na pessoa correspondente
    cursor.execute(
        """
        UPDATE pessoas
        SET embedding = %s
        WHERE id = %s
        """,
        (embedding_json, pessoa_id)
    )

    banco.commit()

    print(f"  OK: {len(embeddings)} fotos processadas.")
    print(f"  Embedding salvo para {nome} (ID {pessoa_id}).\n")

    sucesso += 1

cursor.close()
banco.close()

print("Processo finalizado.")
print(f"Sucesso: {sucesso}")
print(f"Erros: {erros}")