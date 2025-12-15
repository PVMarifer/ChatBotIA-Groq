from flask import Flask, render_template, request, jsonify, redirect, session
from groq import Groq
from pymongo import MongoClient
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
import time
import secrets

# -----------------------
# APP
# -----------------------

app = Flask(__name__)
app.secret_key = "Clave"

# -----------------------
# MAIL
# -----------------------

app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = "asistente.ia.proyecto@gmail.com"
app.config["MAIL_PASSWORD"] = "ujwe gtab xqif kvgc"
app.config["MAIL_DEFAULT_SENDER"] = "asistente.ia.proyecto@gmail.com"

mail = Mail(app)

# -----------------------
# MONGO DB
# -----------------------

mongo_client = MongoClient(
    "mongodb+srv://marferpv_db_user:JW9ntXFTCGu2tpio@paradigmaschatbot.zrlyhfk.mongodb.net/?appName=ParadigmasChatBot"
)

db = mongo_client["ChatBotDB"]
conversaciones = db["conversaciones"]
usuarios_db = db["usuarios"]

# -----------------------
# GROQ
# -----------------------

client = Groq(api_key="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")

# -----------------------
# MEMORIA
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
    historial.reverse()
    return [{"role": h["role"], "content": h["message"]} for h in historial]

def generar_token():
    return secrets.token_urlsafe(32)

# -----------------------
# LOGIN / LOGOUT
# -----------------------

@app.route("/")
def login():
    return render_template("login.html")

@app.route("/validar_login", methods=["POST"])
def validar_login():
    correo = request.form.get("correo")
    contrasena = request.form.get("contrasena")

    usuario = usuarios_db.find_one({"correo": correo})

    if usuario:
        pwd_db = usuario["password"]

        if pwd_db == contrasena or check_password_hash(pwd_db, contrasena):
            session["usuario"] = usuario["correo"]
            session["nombre"] = usuario["nombre"]
            return redirect("/index")

    return render_template("login.html", error="Credenciales inválidas")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

# -----------------------
# RECUPERAR CONTRASEÑA
# -----------------------

@app.route("/contrasenna")
def forgot():
    return render_template("contrasenna.html")

@app.route("/procesar_contrasenna", methods=["POST"])
def procesar_contrasenna():
    correo = request.form.get("correo")
    usuario = usuarios_db.find_one({"correo": correo})

    if usuario:
        token = generar_token()
        expira = time.time() + 3600

        usuarios_db.update_one(
            {"correo": correo},
            {"$set": {
                "reset_token": token,
                "reset_expira": expira
            }}
        )

        link = f"http://localhost:5000/reset_password/{token}"

        msg = Message(
            subject="Password recovery",
            recipients=[correo]
        )

        msg.body = (
            "¡Hola!\n\n"
            "Recibimos una solicitud para restaurar tu contraseña. \n\n"
            "Usa este link (valido por 1 hora):\n"
            f"{link}\n\n"
            "Si no has sido tú, por favor ignora este mensaje.\n\n"
            "Asistente de IA"
        )

        try:
            mail.send(msg)
        except Exception as e:
            print("ERROR SMTP:", repr(e))

    return render_template(
        "contrasenna.html",
        mensaje="Si el correo existe, se te enviará un correo de verificación"
    )

@app.route("/reset_password/<token>")
def reset_password(token):
    usuario = usuarios_db.find_one({
        "reset_token": token,
        "reset_expira": {"$gt": time.time()}
    })

    if not usuario:
        return "Enlace inválido o expirado"

    return render_template("reset_password.html", token=token)

@app.route("/guardar_nueva_contrasena", methods=["POST"])
def guardar_nueva_contrasena():
    token = request.form.get("token")
    nueva = request.form.get("password")
    confirmar = request.form.get("password_confirm")

    #Verificar que coincidan
    if nueva != confirmar:
        return render_template(
            "reset_password.html",
            token=token,
            error="Las contraseñas no coinciden"
        )

    #Verificar token válido
    usuario = usuarios_db.find_one({
        "reset_token": token,
        "reset_expira": {"$gt": time.time()}
    })

    if not usuario:
        return "Token inválido o expirado"

    #Guardar contraseña
    usuarios_db.update_one(
        {"_id": usuario["_id"]},
        {
            "$set": {
                "password": generate_password_hash(nueva)
            },
            "$unset": {
                "reset_token": "",
                "reset_expira": ""
            }
        }
    )

    return redirect("/")
# -----------------------
# REGISTRO
# -----------------------

@app.route("/registro")
def register():
    return render_template("registro.html")

@app.route("/procesar_registro", methods=["POST"])
def procesar_registro():
    correo = request.form.get("correo")
    contrasena = request.form.get("contrasena")
    nombreUsuario = request.form.get("nombreUsuario")

    if usuarios_db.find_one({"correo": correo}):
        return render_template("registro.html", error="Este correo ya está registrado.")

    usuarios_db.insert_one({
        "correo": correo,
        "password": generate_password_hash(contrasena),
        "nombre": nombreUsuario,
        "creado": time.time()
    })

    return render_template(
        "login.html",
        mensaje="Registro exitoso. Ahora puedes iniciar sesión."
    )

# -----------------------
# INDEX
# -----------------------

@app.route("/index")
def index():
    if "usuario" not in session:
        return redirect("/")
    return render_template("index.html")

# -----------------------
# CHAT y TAREAS
# -----------------------
def guardar_tarea(usuario, tarea):
    usuarios_db.update_one(
        {"correo": usuario},
        {"$push": {"tasks": tarea}}
    )

def actualizar_tarea(usuario, titulo, cambios):
    usuarios_db.update_one(
        {"correo": usuario, "tasks.titulo": titulo},
        {"$set": {f"tasks.$.{k}": v for k, v in cambios.items()}}
    )

def obtener_tareas(usuario):
    usuario_doc = usuarios_db.find_one({"correo": usuario})
    return usuario_doc.get("tasks", []) if usuario_doc else []


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(force=True)
        user_message = data.get("message")
        correo = session.get("usuario")
        nombre = session.get("nombre", "usuario")

        # Guardar mensaje del usuario
        guardar_mensaje(correo, "user", user_message)
        historial = obtener_historial(correo, limite=20)

        # Obtener tareas pendientes
        tareas = obtener_tareas(correo)
        tareas_pendientes = [t for t in tareas if t.get("estado") == "pendiente"]

        # Construir mensaje para el modelo
        messages = [
            {"role": "system", "content": f"Eres un asistente amigable. El usuario se llama {nombre}."}
        ]
        messages.extend(historial)

        # Contexto proactivo de tareas
        if tareas_pendientes:
            tasks_text = "\n".join([f"- {t['titulo']} (para {t['fecha']})" for t in tareas_pendientes])
            tarea_prioritaria = min(tareas_pendientes, key=lambda t: t['fecha'])
            messages.append({
                "role": "system",
                "content": (
                    f"Tienes estas tareas pendientes:\n{tasks_text}\n"
                    f"La más urgente es '{tarea_prioritaria['titulo']}' para {tarea_prioritaria['fecha']}.\n"
                    "Sugiere cuál empezar primero y cómo priorizarlas."
                )
            })

        # Mensaje del usuario
        messages.append({"role": "user", "content": user_message})

        # Llamada al modelo Groq
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages
        )
        respuesta = completion.choices[0].message.content

        # Guardar respuesta del asistente
        guardar_mensaje(correo, "assistant", respuesta)

        # Sugerencias de botones interactivos
        sugerencias = [{"titulo": t["titulo"], "accion": "marcar_como_hecha"} for t in tareas_pendientes]

        return jsonify({
            "response": respuesta,
            "tareas_sugeridas": sugerencias
        })

    except Exception as e:
        print("ERROR EN CHAT:", repr(e))
        return jsonify({"response": "Ocurrió un error interno en el servidor"}), 500
# -----------------------
# ACTUALIZAR TAREA (nuevo endpoint)
# -----------------------
@app.route("/actualizar_tarea", methods=["POST"])
def actualizar_tarea_route():
    try:
        data = request.get_json(force=True)
        correo = session.get("usuario")
        titulo = data.get("titulo")
        nuevo_estado = data.get("estado")
        actualizar_tarea(correo, titulo, {"estado": nuevo_estado})
        return jsonify({"ok": True})
    except Exception as e:
        print("ERROR AL ACTUALIZAR TAREA:", repr(e))
        return jsonify({"ok": False, "error": str(e)})
    try:
        data = request.get_json(force=True)
        user_message = data.get("message")

        correo = session.get("usuario")
        nombre = session.get("nombre", "usuario")

        guardar_mensaje(correo, "user", user_message)
        historial = obtener_historial(correo)

        # Obtener tareas pendientes
        tareas = obtener_tareas(correo)
        tareas_pendientes = [t for t in tareas if t.get("estado") == "pendiente"]

        messages = [
            {"role": "system", "content": f"Eres un asistente amigable. El usuario se llama {nombre}."}
        ]
        messages.extend(historial)

        if tareas_pendientes:
            tasks_text = "\n".join([f"- {t['titulo']} (para {t['fecha']})" for t in tareas_pendientes])
            messages.append({
                "role": "system",
                "content": (
                    "El usuario tiene estas tareas pendientes:\n"
                    f"{tasks_text}\n"
                    "Sugiere cómo organizarlas, priorizarlas o mejorarlas de manera práctica."
                )
            })

        messages.append({"role": "user", "content": user_message})

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages
        )

        respuesta = completion.choices[0].message.content
        guardar_mensaje(correo, "assistant", respuesta)

        return jsonify({"response": respuesta})
    except Exception as e:
        print("ERROR EN CHAT:", repr(e))
        return jsonify({"response": "Ocurrió un error interno en el servidor"}), 500

    data = request.get_json(force=True)
    correo = session.get("usuario")
    titulo = data.get("titulo")
    nuevo_estado = data.get("estado")

    actualizar_tarea(correo, titulo, {"estado": nuevo_estado})
    return jsonify({"ok": True})
# -----------------------
# RUN
# -----------------------

if __name__ == "__main__":
    app.run(debug=True)
