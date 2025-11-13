from groq import Groq

#client = Groq(api_key="")

print("chatbot: Escribe 'quit', 'bye' o 'exit' para detener el modelo.\n")

while True:
    user_input = input("Tú: ")
    if user_input.lower() in ["quit", "exit", "bye"]:
        print("\nchatbot: ¡Adiós!")
        break

    print("Chatbot: ", end="", flush=True)

    # Crear stream de respuesta
    stream = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "You are a helpful chatbot."},
            {"role": "user", "content": user_input}
        ],
        stream=True
    )

    # Leer la respuesta en streaming
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)

    print() 
