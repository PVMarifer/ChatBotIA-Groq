from flask import Flask, render_template, request, jsonify, redirect, session
from groq import Groq
from pymongo import MongoClient
import time

app = Flask(__name__)
app.secret_key = "Clave"

# -----------------------
# MONGO DB
# -----------------------

mongo_client = MongoClient(
    "mongodb+srv://marferpv_db_user:JW9ntXFTCGu2tpio@paradigmaschatbot.zrlyhfk.mongodb.net/?appName=ParadigmasChatBot"
)

db = mongo_client["ChatBotDB"]
conversaciones = db["conversaciones"]
usuarios_db = db["usuarios"]  # si querés guardar usuarios después aquí


# -----------------------
# GROQ
# -----------------------

client = Groq(api_key="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")

# -----------------------
# FUNCIONES DE MEMORIA
# -----------------------

def guardar_mensaje(usuario, role, message):
    conversaciones.insert_one({
        "usuario": usuario,
        "role": role,
        "message": message,
        "timestamp": time.time()
    })


def obtener_historial(usuario, limite=10):
    historial = list(
        conversaciones
        .find({"usuario": usuario})
        .sort("timestamp", -1)
        .limit(limite)
    )

    historial.reverse()  # orden normal

    mensajes = []
    for h in historial:
        mensajes.append({
            "role": h["role"],
            "content": h["message"]
        })

    return mensajes


# -----------------------
# USUARIOS EN MEMORIA (POR AHORA)
# -----------------------

usuarios = {}


# -----------------------
# RUTAS LOGIN / REGISTRO
# -----------------------

@app.route("/")
def login():
    return render_template("login.html")


@app.route("/validar_login", methods=["POST"])
def validar_login():
    correo = request.form.get("correo")
    contrasena = request.form.get("contrasena")

    if correo in usuarios and usuarios[correo]["password"] == contrasena:
        session["usuario"] = correo
        session["nombre"] = usuarios[correo]["nombre"]
        return redirect("/index")
    else:
        return render_template("login.html", error="Credenciales inválidas")


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


@app.route("/contrasenna")
def forgot():
    return render_template("contrasenna.html")


@app.route("/procesar_contrasenna", methods=["POST"])
def procesar_contrasenna():
    correo = request.form.get("correo")

    if correo in usuarios:
        return render_template(
            "contrasenna.html",
            mensaje="Si el correo existe, recibirás un enlace para recuperar tu cuenta."
        )
    else:
        return render_template(
            "contrasenna.html",
            error="El correo no está registrado."
        )


@app.route("/registro")
def register():
    return render_template("registro.html")


@app.route("/procesar_registro", methods=["POST"])
def procesar_registro():
    correo = request.form.get("correo")
    contrasena = request.form.get("contrasena")
    nombreUsuario = request.form.get("nombreUsuario")

    if correo in usuarios:
        return render_template("registro.html", error="Este correo ya está registrado.")

    usuarios[correo] = {
        "password": contrasena,
        "nombre": nombreUsuario
    }

    return render_template("login.html", mensaje="Registro exitoso. Ahora puedes iniciar sesión.")


# -----------------------
# PÁGINA PRINCIPAL
# -----------------------

@app.route("/index")
def index():
    if "usuario" not in session:
        return redirect("/")
    return render_template("index.html")


# -----------------------
# CHAT CON MEMORIA
# -----------------------

@app.route("/chat", methods=["POST"])
def chat():
    try:
        # recibir datos del frontend
        data = request.get_json(force=True)
        if not data or "message" not in data:
            return jsonify({"error": "Falta 'message'"}), 400

        user_message = data["message"]
        nombre = session.get("nombre", "usuario")
        correo = session.get("usuario")

        # guardar mensaje del usuario
        guardar_mensaje(correo, "user", user_message)

        # recuperar historial previo
        historial = obtener_historial(correo, limite=10)

        # construir mensaje con memoria incluida
        messages = [
            {"role": "system", "content": f"Eres un asistente amigable. El usuario se llama {nombre}."}
        ]

        messages.extend(historial)
        messages.append({"role": "user", "content": user_message})

        # generar respuesta con Groq
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages
        )

        bot_response = completion.choices[0].message.content

        # guardar respuesta del bot
        guardar_mensaje(correo, "assistant", bot_response)

        return jsonify({"response": bot_response})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------
# INICIO DEL SERVIDOR
# -----------------------

if __name__ == "__main__":
    app.run(debug=True)
