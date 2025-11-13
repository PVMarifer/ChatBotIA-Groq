document.addEventListener("DOMContentLoaded", () => {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const historyList = document.getElementById("history");
    const newChatBtn = document.getElementById("new-chat-btn");
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const sidebar = document.querySelector(".sidebar");

    let chats = JSON.parse(localStorage.getItem("chats")) || {};
    let currentChatId = null;

    // Crear nuevo chat automáticamente
    function newChat() {
        currentChatId = Date.now().toString();
        chats[currentChatId] = [];
        updateHistory();
        chatBox.innerHTML = "";
        saveChats();
    }

    // Cargar chat desde historial
    function loadChat(id) {
        currentChatId = id;
        chatBox.innerHTML = "";
        chats[id].forEach(msg => {
            appendMessage(msg.role === "user" ? "Tú" : "IA", msg.content, msg.role === "user" ? "user-message" : "bot-message");
        });
        updateHistory();
    }

    // Guardar chats
    function saveChats() {
        localStorage.setItem("chats", JSON.stringify(chats));
    }

    // Actualizar historial con basurero
    function updateHistory() {
        historyList.innerHTML = "";
        Object.keys(chats).sort((a,b)=>b-a).forEach(id=>{
            const li = document.createElement("li");
            const firstMsg = chats[id][0]?.content?.slice(0,30) || "Nuevo chat";
            li.textContent = firstMsg;

            const trashBtn = document.createElement("button");
            trashBtn.textContent = "🗑️";
            trashBtn.classList.add("history-trash-btn");
            trashBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                Swal.fire({
                    title: '¿Deseas eliminar este chat?',
                    text: "¡No podrás recuperar este historial!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'Sí, borrar',
                    cancelButtonText: 'Cancelar'
                }).then((result) => {
                    if(result.isConfirmed){
                        delete chats[id];
                        if(currentChatId === id){
                            chatBox.innerHTML = "";
                            currentChatId = null;
                        }
                        saveChats();
                        updateHistory();
                        Swal.fire('¡Borrado!', 'El chat ha sido eliminado.', 'success');
                    }
                });
            });
            li.appendChild(trashBtn);

            li.onclick = () => loadChat(id);
            if(id === currentChatId) li.classList.add("active");
            historyList.appendChild(li);
        });
    }

    // Enviar mensaje con historial concatenado
    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        if (!currentChatId) newChat();

        // Mostrar mensaje del usuario
        appendMessage("Tú", message, "user-message");
        userInput.value = "";

        // Construir prompt concatenando todo el historial
        const lastMessages = chats[currentChatId]; // todo el historial del chat actual
        const historyPrompt = lastMessages.map(msg => (msg.role === "user" ? "Tú: " : "IA: ") + msg.content).join("\n");
        const fullPrompt = historyPrompt + "\nTú: " + message;

        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: fullPrompt }),
            });

            const data = await response.json();
            appendMessage("IA", data.response, "bot-message");

            // Guardar en historial
            chats[currentChatId].push({ role: "user", content: message });
            chats[currentChatId].push({ role: "bot", content: data.response });
            saveChats();
            updateHistory();
        } catch (error) {
            appendMessage("Error", error, "error-message");
        }
    }

    // Mostrar mensaje en chat
    function appendMessage(sender, text, cssClass) {
        const div = document.createElement("div");
        div.classList.add(cssClass);
        div.innerHTML = `<b>${sender}:</b><div class="message-content">${marked.parse(text)}</div>`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Eventos
    newChatBtn.addEventListener("click", newChat);
    userInput.addEventListener("keydown", (e) => { if(e.key==="Enter") sendMessage(); });
    sendBtn.addEventListener("click", sendMessage);
    hamburgerBtn.addEventListener("click", () => sidebar.classList.toggle("hidden"));

    // Cargar historial al iniciar
    if(Object.keys(chats).length > 0) loadChat(Object.keys(chats)[0]);
    else newChat();
});
