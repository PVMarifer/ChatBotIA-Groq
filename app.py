from flask import Flask, render_template, request, jsonify, redirect, session
from groq import Groq

app = Flask(__name__)
app.secret_key = "Clave"  

# Diccionario en memoria para usuarios

usuarios = {}

# CONFIGURACIÓN DE GROQ

client = Groq(api_key="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")

# RUTAS LOGIN / REGISTRO / CONTRASEÑA

@app.route("/")
def login():
    return render_template("login.html")

@app.route("/validar_login", methods=["POST"])
def validar_login():
    correo = request.form.get("correo")
    contrasena = request.form.get("contrasena")

    if correo in usuarios and usuarios[correo]["password"] == contrasena:
        session["usuario"] = correo
        return redirect("/index")
    else:
        return render_template("login.html", error="Credenciales inválidas")

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

    if correo in usuarios:
        return render_template("registro.html", error="Este correo ya está registrado.")

    usuarios[correo] = {"password": contrasena}
    return render_template("login.html", mensaje="Registro exitoso. Ahora puedes iniciar sesión.")

@app.route("/index")
def index():
    if "usuario" not in session:
        return redirect("/")
    return render_template("index.html")

# -----------------------
# CHAT
# -----------------------
@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(force=True)
        if not data or "message" not in data:
            return jsonify({"error": "Falta 'message'"}), 400

        user_message = data["message"]

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "Eres un asistente útil y amable."},
                {"role": "user", "content": user_message}
            ]
        )

        bot_response = completion.choices[0].message.content
        return jsonify({"response": bot_response})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
