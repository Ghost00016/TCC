import cv2
import json
import numpy as np
import mysql.connector
import serial
import time
from deepface import DeepFace

MODELO = "Facenet512"
LIMITE = 0.40
INTERVALO_ANALISE = 10
ID_LOCAL = 4

ARDUINO_PORTA = "COM3"
ARDUINO_BAUDRATE = 9600

NENHUM_ROSTO = "NENHUM_ROSTO"
AUTORIZADO = "AUTORIZADO"
NAO_AUTORIZADO = "NAO_AUTORIZADO"

CONFIRMACOES_NECESSARIAS = 2

pessoas = {}
banco = None
cursor = None
arduino = None
estado_atual = NENHUM_ROSTO
nome_atual = "Nenhum rosto"
id_pessoa_atual = None
caixa_atual = None
contador = 0
comando_arduino_atual = None
pessoa_confirmacao = None
contador_confirmacao = 0
ultima_abertura = 0

def enviar_comando(comando):
    global comando_arduino_atual

    if arduino is None or not arduino.is_open:
        return

    try:
        arduino.write((comando + "\n").encode("utf-8"))
        comando_arduino_atual = comando
        print("Arduino recebeu:", comando)
    except serial.SerialException as erro:
        print("Erro ao enviar comando para o Arduino:")
        print(erro)

def controlar_porta(estado):
    global ultima_abertura

    if estado == AUTORIZADO:
        if time.time() - ultima_abertura >= 5:
            enviar_comando("ABRIR")
            ultima_abertura = time.time()

    elif estado == NAO_AUTORIZADO:
        if comando_arduino_atual != "FECHAR":
            enviar_comando("FECHAR")

print("CONECTANDO AO ARDUINO")

try:
    arduino = serial.Serial(
        ARDUINO_PORTA,
        ARDUINO_BAUDRATE,
        timeout=1
    )

    time.sleep(2)

    print("Arduino conectado.")
    print("Porta:", ARDUINO_PORTA)
    print("Baudrate:", ARDUINO_BAUDRATE)

except serial.SerialException as erro:
    print("Não foi possível conectar ao Arduino.")
    print(erro)
    arduino = None

try:
    banco = mysql.connector.connect(
        host="localhost",
        user="root",
        password="admin",
        database="tcc"
    )

    cursor = banco.cursor(dictionary=True)
    print("MySQL conectado.")

except mysql.connector.Error as erro:
    print("Erro ao conectar ao MySQL:")
    print(erro)

    if arduino is not None and arduino.is_open:
        arduino.close()

    exit()

cursor.execute(
    """
    SELECT id, nome_local
    FROM locais
    WHERE id = %s
    """,
    (ID_LOCAL,)
)

local = cursor.fetchone()

if not local:
    print("O ID_LOCAL não existe no banco.")

    banco.close()

    if arduino is not None and arduino.is_open:
        arduino.close()

    exit()

print("Local:", local["nome_local"])

cursor.execute(
    """
    SELECT id, nome, locais_acesso, embedding
    FROM pessoas
    WHERE embedding IS NOT NULL
    """
)

dados_pessoas = cursor.fetchall()

print("Carregando embeddings...")

for pessoa in dados_pessoas:
    try:
        embedding = np.array(
            json.loads(pessoa["embedding"]),
            dtype=np.float32
        )

        if embedding.size != 512:
            print(f"Embedding inválido para: {pessoa['nome']}")
            continue

        norma = np.linalg.norm(embedding)

        if norma == 0:
            print(f"Embedding inválido para: {pessoa['nome']}")
            continue

        embedding = embedding / norma
        locais_acesso = set()

        for id_local in pessoa["locais_acesso"].split(","):
            id_local = id_local.strip()

            if id_local.isdigit():
                locais_acesso.add(int(id_local))

        pessoas[pessoa["id"]] = {
            "nome": pessoa["nome"],
            "id": pessoa["id"],
            "locais_acesso": locais_acesso,
            "embedding": embedding
        }

        print(f"OK: {pessoa['nome']}")

    except Exception as erro:
        print(f"Erro ao carregar {pessoa['nome']}:", erro)

print("Pessoas carregadas:", len(pessoas))

if not pessoas:
    print("Nenhuma pessoa com embedding encontrada.")

    banco.close()

    if arduino is not None and arduino.is_open:
        arduino.close()

    exit()

print("Abrindo câmera...")

camera = cv2.VideoCapture(
    0,
    cv2.CAP_DSHOW
)

if not camera.isOpened():
    print("Não foi possível abrir a câmera.")

    banco.close()

    if arduino is not None and arduino.is_open:
        arduino.close()

    exit()

camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

print("Câmera aberta.")
print("SISTEMA INICIADO")
print("Pressione ESC para sair.")

try:
    while True:
        sucesso, frame = camera.read()

        if not sucesso:
            print("Erro ao capturar imagem.")
            break

        frame = cv2.flip(frame, 1)
        contador += 1

        if contador % INTERVALO_ANALISE == 0:
            try:
                resultado = DeepFace.represent(
                    img_path=frame,
                    model_name=MODELO,
                    enforce_detection=True
                )

                embedding_atual = np.array(
                    resultado[0]["embedding"],
                    dtype=np.float32
                )

                norma = np.linalg.norm(embedding_atual)

                if norma == 0:
                    raise Exception("Embedding inválido.")

                embedding_atual = embedding_atual / norma

                area = resultado[0].get("facial_area")

                if area:
                    x = area["x"]
                    y = area["y"]
                    w = area["w"]
                    h = area["h"]
                    caixa_atual = (x, y, w, h)

                melhor_pessoa = "Desconhecido"
                melhor_distancia = float("inf")
                melhor_id = None
                melhores_locais = set()

                for id_pessoa, dados in pessoas.items():
                    similaridade = np.dot(
                        embedding_atual,
                        dados["embedding"]
                    )

                    distancia = 1 - similaridade

                    if distancia < melhor_distancia:
                        melhor_distancia = distancia
                        melhor_pessoa = dados["nome"]
                        melhor_id = dados["id"]
                        melhores_locais = dados["locais_acesso"]

                if melhor_distancia <= LIMITE:
                    nome_atual = melhor_pessoa
                    id_pessoa_atual = melhor_id

                    if ID_LOCAL in melhores_locais:
                        if pessoa_confirmacao == melhor_id:
                            contador_confirmacao += 1
                        else:
                            pessoa_confirmacao = melhor_id
                            contador_confirmacao = 1

                        if contador_confirmacao >= CONFIRMACOES_NECESSARIAS:
                            novo_estado = AUTORIZADO
                        else:
                            novo_estado = NENHUM_ROSTO
                    else:
                        pessoa_confirmacao = None
                        contador_confirmacao = 0
                        novo_estado = NAO_AUTORIZADO

                else:
                    nome_atual = "Desconhecido"
                    id_pessoa_atual = None
                    pessoa_confirmacao = None
                    contador_confirmacao = 0
                    novo_estado = NAO_AUTORIZADO

                estado_anterior = estado_atual
                estado_atual = novo_estado

                if estado_atual == AUTORIZADO:
                    controlar_porta(estado_atual)

                elif estado_atual == NAO_AUTORIZADO:
                    if estado_anterior != NAO_AUTORIZADO:
                        controlar_porta(estado_atual)

                if estado_atual in (
                    AUTORIZADO,
                    NAO_AUTORIZADO
                ):
                    chave_registro = (
                        id_pessoa_atual,
                        estado_atual
                    )
                else:
                    chave_registro = None

                if not hasattr(
                    controlar_porta,
                    "ultimo_registro"
                ):
                    controlar_porta.ultimo_registro = None

                if (
                    chave_registro is not None
                    and chave_registro != controlar_porta.ultimo_registro
                ):
                    cursor.execute(
                        """
                        INSERT INTO registros
                        (id_pessoa, id_local, status)
                        VALUES (%s, %s, %s)
                        """,
                        (
                            id_pessoa_atual,
                            ID_LOCAL,
                            (
                                "Autorizado"
                                if estado_atual == AUTORIZADO
                                else "Não autorizado"
                            )
                        )
                    )

                    banco.commit()
                    controlar_porta.ultimo_registro = chave_registro

                    print()
                    print("RECONHECIMENTO")
                    print("Pessoa:", nome_atual)
                    print(
                        "Distância:",
                        round(melhor_distancia, 4)
                    )
                    print("Estado:", estado_atual)

                    if estado_atual == AUTORIZADO:
                        print("ACESSO AUTORIZADO")
                    elif estado_atual == NAO_AUTORIZADO:
                        print("ACESSO NEGADO")

                    print("Arduino:", comando_arduino_atual)

            except Exception:
                nome_atual = "Nenhum rosto"
                id_pessoa_atual = None
                caixa_atual = None
                pessoa_confirmacao = None
                contador_confirmacao = 0

                estado_anterior = estado_atual
                estado_atual = NENHUM_ROSTO

                if estado_anterior != estado_atual:
                    print("Nenhum rosto detectado.")

        if estado_atual == AUTORIZADO:
            cor = (0, 255, 0)
        elif estado_atual == NAO_AUTORIZADO:
            cor = (0, 0, 255)
        else:
            cor = (255, 255, 0)

        if caixa_atual is not None:
            x, y, w, h = caixa_atual

            cv2.rectangle(
                frame,
                (x, y),
                (x + w, y + h),
                cor,
                2
            )

            if estado_atual == AUTORIZADO:
                texto = f"{nome_atual} - ACESSO AUTORIZADO"
            elif estado_atual == NAO_AUTORIZADO:
                if nome_atual == "Desconhecido":
                    texto = "Desconhecido - ACESSO NEGADO"
                else:
                    texto = f"{nome_atual} - ACESSO NEGADO"
            else:
                texto = f"{nome_atual} - CONFIRMANDO..."

            cv2.putText(
                frame,
                texto,
                (x, max(y - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                cor,
                2
            )

        cv2.putText(
            frame,
            f"Estado: {estado_atual}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            cor,
            2
        )

        cv2.imshow(
            "Reconhecimento Facial",
            frame
        )

        tecla = cv2.waitKey(1) & 0xFF

        if tecla == 27:
            break

finally:
    print("ENCERRANDO SISTEMA")

    camera.release()
    cv2.destroyAllWindows()

    if arduino is not None and arduino.is_open:
        try:
            enviar_comando("FECHAR")
            time.sleep(0.5)
            arduino.close()
            print("Arduino desconectado.")
        except Exception as erro:
            print("Erro ao fechar Arduino:", erro)

    if cursor is not None:
        cursor.close()

    if banco is not None:
        banco.close()

    print("Sistema encerrado.")