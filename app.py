from flask import Flask, render_template, request, jsonify
from groq import Groq

app = Flask(__name__)

# Inicializa el cliente de Groq
client = Groq(api_key="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") 
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        user_message = data.get("message", "")

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