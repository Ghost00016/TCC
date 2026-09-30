import cv2
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import os
import shutil
import sys
import json
import mysql.connector
import numpy as np
from deepface import DeepFace

# Configurações
PASTA_FOTOS = os.path.abspath("fotos")
MODELO = "Facenet512"

# Dados recebidos
if len(sys.argv) < 2:
    print("ERRO: Dados não recebidos.")
    sys.exit(1)

try:
    dados = json.loads(sys.argv[1])
except Exception:
    print("ERRO: Dados inválidos.")
    sys.exit(1)

nome = dados.get("nome", "").strip()
idade = dados.get("idade")
cpf = dados.get("cpf", "").strip()
sexo = dados.get("sexo", "").strip()
cargo = dados.get("cargo", "").strip()
locais_acesso = dados.get("locais_acesso", [])

if isinstance(locais_acesso, str):
    locais_acesso = [
        local.strip()
        for local in locais_acesso.split(",")
        if local.strip()
    ]

# Validação
if not locais_acesso:
    print("ERRO: Selecione pelo menos um local de acesso.")
    sys.exit(1)

if not nome or not cpf or not sexo or not cargo:
    print("ERRO: Campos obrigatórios não preenchidos.")
    sys.exit(1)

try:
    idade = int(idade)
except Exception:
    print("ERRO: Idade inválida.")
    sys.exit(1)

if idade < 0:
    print("ERRO: Idade inválida.")
    sys.exit(1)

# MySQL
try:
    banco = mysql.connector.connect(
        host="localhost",
        user="root",
        password="admin",
        database="tcc"
    )
    cursor = banco.cursor(dictionary=True)
except Exception as erro:
    print(f"ERRO MySQL: {erro}")
    sys.exit(1)

# CPF duplicado
try:
    cursor.execute(
        "SELECT id FROM pessoas WHERE cpf = %s",
        (cpf,)
    )

    if cursor.fetchone():
        print("ERRO: CPF já cadastrado.")
        banco.close()
        sys.exit(1)

except Exception as erro:
    print(f"ERRO MySQL: {erro}")
    banco.close()
    sys.exit(1)

# Verifica locais
ids_locais = []

try:
    for local in locais_acesso:
        local_id = int(local)

        cursor.execute(
            "SELECT id FROM locais WHERE id = %s",
            (local_id,)
        )

        if not cursor.fetchone():
            print(f"ERRO: Local {local_id} não existe.")
            banco.close()
            sys.exit(1)

        ids_locais.append(local_id)

except Exception as erro:
    print(f"ERRO nos locais: {erro}")
    banco.close()
    sys.exit(1)

locais_formatados = ",".join(map(str, ids_locais))

# Pasta da pessoa
nome_pasta = nome.replace(" ", "_")
pasta = os.path.join(PASTA_FOTOS, nome_pasta)

if os.path.exists(pasta):
    shutil.rmtree(pasta)

os.makedirs(pasta, exist_ok=True)

# Câmera
camera = None

for backend in [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]:
    try:
        tentativa = cv2.VideoCapture(0, backend)

        if tentativa.isOpened():
            camera = tentativa
            break

        tentativa.release()

    except Exception:
        try:
            tentativa.release()
        except Exception:
            pass

if camera is None:
    print("ERRO: Não foi possível abrir a câmera.")
    shutil.rmtree(pasta, ignore_errors=True)
    banco.close()
    sys.exit(1)

camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)

# Detector
cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"

face_cascade = cv2.CascadeClassifier(cascade_path)

if face_cascade.empty():
    print("ERRO: Não foi possível carregar o detector facial.")
    camera.release()
    shutil.rmtree(pasta, ignore_errors=True)
    banco.close()
    sys.exit(1)

# Janela
NOME_JANELA = "Cadastro Facial"

cv2.namedWindow(
    NOME_JANELA,
    cv2.WINDOW_NORMAL
)

cv2.resizeWindow(
    NOME_JANELA,
    800,
    600
)

try:
    cv2.setWindowProperty(
        NOME_JANELA,
        cv2.WND_PROP_TOPMOST,
        1
    )
except Exception:
    pass

# Interface
def desenhar_informacoes(
    frame,
    tipo,
    tiradas_etapa,
    quantidade,
    fotos_tiradas,
    status,
    cor_status
):
    altura, largura = frame.shape[:2]

    painel_h = 75

    painel = np.zeros(
        (painel_h, largura, 3),
        dtype=np.uint8
    )

    painel[:] = (
        25,
        30,
        40
    )

    cv2.line(
        painel,
        (0, 0),
        (largura, 0),
        (70, 80, 95),
        1
    )

    cv2.circle(
        painel,
        (18, 23),
        6,
        cor_status,
        -1
    )

    cv2.putText(
        painel,
        status,
        (32, 29),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.42,
        cor_status,
        1,
        cv2.LINE_AA
    )

    cv2.putText(
        painel,
        f"{tipo.upper()}  {tiradas_etapa}/{quantidade}",
        (15, 60),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.45,
        (210, 210, 210),
        1,
        cv2.LINE_AA
    )

    cv2.putText(
        painel,
        f"TOTAL {fotos_tiradas}/20",
        (190, 60),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.45,
        (100, 255, 100),
        1,
        cv2.LINE_AA
    )

    texto = "ESPACO = FOTO"

    tamanho = cv2.getTextSize(
        texto,
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        1
    )[0]

    x_texto = largura // 2 - tamanho[0] // 2

    cv2.putText(
        painel,
        texto,
        (x_texto, 29),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (0, 255, 255),
        1,
        cv2.LINE_AA
    )

    texto_cancelar = "ESC = CANCELAR"

    tamanho_cancelar = cv2.getTextSize(
        texto_cancelar,
        cv2.FONT_HERSHEY_SIMPLEX,
        0.4,
        1
    )[0]

    cv2.putText(
        painel,
        texto_cancelar,
        (
            largura - tamanho_cancelar[0] - 15,
            29
        ),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.4,
        (180, 180, 180),
        1,
        cv2.LINE_AA
    )

    frame_final = np.vstack(
        (
            frame,
            painel
        )
    )

    return frame_final

# Captura
embeddings = []

etapas = [
    ("frente", 5),
    ("esquerda", 5),
    ("direita", 5),
    ("cima", 5)
]

fotos_tiradas = 0
cancelado = False
falhas_camera = 0

print("INICIANDO_CAPTURA")

try:
    for tipo, quantidade in etapas:
        tiradas_etapa = 0

        while tiradas_etapa < quantidade:
            ret, frame_original = camera.read()

            if not ret or frame_original is None:
                falhas_camera += 1

                print(
                    f"Falha ao capturar frame: {falhas_camera}"
                )

                if falhas_camera >= 30:
                    print(
                        "ERRO: A câmera parou de fornecer imagens."
                    )
                    cancelado = True
                    break

                cv2.waitKey(30)
                continue

            falhas_camera = 0

            frame = cv2.flip(
                frame_original,
                1
            )

            cinza = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2GRAY
            )

            faces = face_cascade.detectMultiScale(
                cinza,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(100, 100)
            )

            for (x, y, w, h) in faces:
                if len(faces) == 1:
                    cor = (
                        0,
                        255,
                        0
                    )
                else:
                    cor = (
                        0,
                        165,
                        255
                    )

                cv2.rectangle(
                    frame,
                    (x, y),
                    (x + w, y + h),
                    cor,
                    2
                )

            if len(faces) == 0:
                status = "NENHUM ROSTO"
                cor_status = (
                    0,
                    0,
                    255
                )

            elif len(faces) > 1:
                status = "MAIS DE UM ROSTO"
                cor_status = (
                    0,
                    165,
                    255
                )

            else:
                status = "ROSTO PRONTO"
                cor_status = (
                    0,
                    255,
                    0
                )

            frame_final = desenhar_informacoes(
                frame,
                tipo,
                tiradas_etapa,
                quantidade,
                fotos_tiradas,
                status,
                cor_status
            )

            cv2.imshow(
                NOME_JANELA,
                frame_final
            )

            try:
                cv2.setWindowProperty(
                    NOME_JANELA,
                    cv2.WND_PROP_TOPMOST,
                    1
                )
            except Exception:
                pass

            tecla = cv2.waitKey(1) & 0xFF

            if tecla == 27:
                cancelado = True
                break

            if tecla != 32:
                continue

            if len(faces) == 0:
                print("Rosto não detectado.")
                continue

            if len(faces) > 1:
                print("Mais de um rosto detectado.")
                continue

            x, y, w, h = faces[0]

            margem_x = int(w * 0.20)
            margem_y = int(h * 0.20)

            x1 = max(
                0,
                x - margem_x
            )

            y1 = max(
                0,
                y - margem_y
            )

            x2 = min(
                frame.shape[1],
                x + w + margem_x
            )

            y2 = min(
                frame.shape[0],
                y + h + margem_y
            )

            largura_original = frame_original.shape[1]

            x1_original = largura_original - x2
            x2_original = largura_original - x1

            rosto = frame_original[
                y1:y2,
                x1_original:x2_original
            ]

            if rosto.size == 0:
                print("Erro: rosto vazio.")
                continue

            numero_foto = fotos_tiradas + 1

            caminho = os.path.join(
                pasta,
                f"foto_{numero_foto:02d}_{tipo}.jpg"
            )


            sucesso = cv2.imwrite(
                caminho,
                rosto
            )

            if not sucesso:
                print("Erro ao salvar foto.")
                continue

            try:
                resultado = DeepFace.represent(
                    img_path=caminho,
                    model_name=MODELO,
                    enforce_detection=True
                )

                if not resultado:
                    raise Exception(
                        "Embedding não encontrado."
                    )

                embedding = np.array(
                    resultado[0]["embedding"],
                    dtype=np.float32
                )

                if embedding.shape[0] != 512:
                    raise Exception(
                        "Embedding inválido."
                    )

                norma = np.linalg.norm(
                    embedding
                )

                if norma == 0:
                    raise Exception(
                        "Embedding inválido."
                    )

                embedding = embedding / norma

                embeddings.append(embedding)

                tiradas_etapa += 1
                fotos_tiradas += 1

                print(
                    f"Foto validada: {fotos_tiradas}/20"
                )

            except Exception as erro:
                print(
                    "Rosto não foi validado pelo DeepFace."
                )
                print(
                    f"Detalhes: {erro}"
                )

                if os.path.exists(caminho):
                    os.remove(caminho)

        if cancelado:
            break

finally:
    camera.release()
    cv2.destroyAllWindows()

# Cancelamento
if cancelado:
    print("CADASTRO_CANCELADO")

    shutil.rmtree(
        pasta,
        ignore_errors=True
    )

    banco.close()
    sys.exit(0)

# Verificação
if len(embeddings) != 20:
    print(
        "ERRO: Não foram obtidos 20 embeddings."
    )

    shutil.rmtree(
        pasta,
        ignore_errors=True
    )

    banco.close()
    sys.exit(1)

# Embedding médio
try:
    matriz = np.array(
        embeddings,
        dtype=np.float32
    )

    embedding_medio = np.mean(
        matriz,
        axis=0
    )

    norma = np.linalg.norm(
        embedding_medio
    )

    if norma == 0:
        raise Exception(
            "Embedding médio inválido."
        )

    embedding_medio = (
        embedding_medio / norma
    )

    embedding_json = json.dumps(
        embedding_medio.tolist()
    )

except Exception as erro:
    print(
        f"ERRO ao gerar embedding: {erro}"
    )

    shutil.rmtree(
        pasta,
        ignore_errors=True
    )

    banco.close()
    sys.exit(1)

# Cadastro no banco
try:
    cursor.execute(
        """
        INSERT INTO pessoas
        (
            nome,
            idade,
            cpf,
            sexo,
            cargo,
            locais_acesso,
            embedding
        )
        VALUES
        (
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s
        )
        """,
        (
            nome,
            idade,
            cpf,
            sexo,
            cargo,
            locais_formatados,
            embedding_json
        )
    )

    banco.commit()

    print("CADASTRO_CONCLUIDO")

except Exception as erro:
    banco.rollback()

    print(
        f"ERRO ao salvar pessoa: {erro}"
    )

    shutil.rmtree(
        pasta,
        ignore_errors=True
    )

    banco.close()
    sys.exit(1)

banco.close()