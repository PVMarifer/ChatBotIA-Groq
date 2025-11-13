document.addEventListener("DOMContentLoaded", () => {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const historyList = document.getElementById("history");
    const newChatBtn = document.getElementById("new-chat-btn");
    const addTaskBtn = document.getElementById("add-task-btn");
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const sidebar = document.querySelector(".sidebar");

    let chats = JSON.parse(localStorage.getItem("chats")) || {};
    let currentChatId = null;
    let user_data = JSON.parse(localStorage.getItem("user_data")) || { tasks: [] };

    // -------------------- Chats --------------------
    function newChat() {
        currentChatId = Date.now().toString();
        chats[currentChatId] = [];
        chatBox.innerHTML = "";
        updateHistory();
        saveChats();
    }

    function loadChat(id) {
        currentChatId = id;
        chatBox.innerHTML = "";
        chats[id].forEach(msg => {
            appendMessage(msg.role === "user" ? "Tú" : "IA", msg.content, msg.role === "user" ? "user-message" : "bot-message");
        });
        updateHistory();
    }

    function saveChats() {
        localStorage.setItem("chats", JSON.stringify(chats));
    }

    function saveUserData() {
        localStorage.setItem("user_data", JSON.stringify(user_data));
    }

    function updateHistory() {
        historyList.innerHTML = "";
        Object.keys(chats).sort((a,b)=>b-a).forEach(id=>{
            const li = document.createElement("li");
            const firstMsg = chats[id][0]?.content?.slice(0,30) || "Nuevo chat";
            li.textContent = firstMsg;
            li.onclick = () => loadChat(id);

            // Botón basurero
            const trashBtn = document.createElement("button");
            trashBtn.textContent = '🗑️';
            trashBtn.classList.add('history-trash-btn');
            trashBtn.addEventListener('click', (e) => {
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
                    if (result.isConfirmed) {
                        delete chats[id];
                        if(currentChatId === id) chatBox.innerHTML = "";
                        currentChatId = null;
                        saveChats();
                        updateHistory();
                        Swal.fire('¡Borrado!', 'El chat ha sido eliminado.', 'success');
                    }
                });
            });

            li.appendChild(trashBtn);
            if(id===currentChatId) li.classList.add("active");
            historyList.appendChild(li);
        });
    }

    function appendMessage(sender, text, cssClass) {
        const div = document.createElement("div");
        div.classList.add(cssClass);
        div.innerHTML = `<b>${sender}:</b><div class="message-content">${marked.parse(text)}</div>`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        if (!currentChatId) newChat();

        appendMessage("Tú", message, "user-message");
        userInput.value = "";

        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
            });

            const data = await response.json();
            appendMessage("IA", data.response, "bot-message");

            chats[currentChatId].push({ role: "user", content: message });
            chats[currentChatId].push({ role: "bot", content: data.response });
            saveChats();
            updateHistory();
        } catch (error) {
            appendMessage("Error", error, "error-message");
        }
    }

    // -------------------- Eventos --------------------
    newChatBtn.addEventListener("click", newChat);
    sendBtn.addEventListener("click", sendMessage);
    userInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

    hamburgerBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });

    // -------------------- Tareas / Recordatorios --------------------
    addTaskBtn.addEventListener("click", () => {
        Swal.fire({
            title: 'Nueva tarea',
            html:
                '<input id="task-title" class="swal2-input" placeholder="Título de la tarea">' +
                '<input id="task-date" type="date" class="swal2-input">' +
                '<input id="task-hour" type="number" class="swal2-input" placeholder="Hora (0-23)" min="0" max="23">' +
                '<input id="task-minute" type="number" class="swal2-input" placeholder="Minutos (0-59)" min="0" max="59">',
            confirmButtonText: 'Agregar',
            focusConfirm: false,
            preConfirm: () => {
                const titulo = document.getElementById('task-title').value.trim();
                const dateStr = document.getElementById('task-date').value;
                const hour = parseInt(document.getElementById('task-hour').value);
                const minute = parseInt(document.getElementById('task-minute').value);

                if(!titulo || !dateStr || isNaN(hour) || isNaN(minute)){
                    Swal.showValidationMessage('Debes completar todos los campos correctamente');
                    return false;
                }

                if(hour < 0 || hour > 23 || minute < 0 || minute > 59){
                    Swal.showValidationMessage('Hora o minutos inválidos (Hora:0-23, Minutos:0-59)');
                    return false;
                }

                return { titulo, dateStr, hour, minute };
            }
        }).then((result) => {
            if(result.isConfirmed){
                const { titulo, dateStr, hour, minute } = result.value;
                addTask(titulo, dateStr, hour, minute);
            }
        });
    });

    function addTask(titulo, dateStr, hour, minute) {
        const now = new Date();
        const taskDate = new Date(dateStr + "T00:00:00");
        taskDate.setHours(hour, minute, 0, 0);

        if(taskDate.getTime() <= now.getTime()) {
            Swal.fire('Error', 'La fecha y hora seleccionada ya pasó', 'error');
            return;
        }

        user_data.tasks.push({ titulo, fecha: taskDate.toISOString(), hecho: false });
        saveUserData();

        // Confirmación de creación
        Swal.fire('Tarea agregada', `✅ "${titulo}" programada para ${taskDate.toLocaleString()}`, 'success');

        appendMessage("IA", `✅ He agregado la tarea "${titulo}" para ${taskDate.toLocaleString()}.`, "bot-message");

        scheduleReminder(titulo, taskDate);
    }

    function scheduleReminder(titulo, taskDate) {
        const delay = taskDate.getTime() - new Date().getTime();
        setTimeout(() => {
            // SweetAlert de alarma
            Swal.fire({
                title: '⏰ Recordatorio',
                text: `"${titulo}" ahora.`,
                icon: 'info',
                confirmButtonText: 'Entendido'
            });
            appendMessage("IA", `⏰ Recordatorio: "${titulo}" ahora.`, "bot-message");
        }, delay);
    }

    // -------------------- Inicialización --------------------
    if(Object.keys(chats).length > 0){
        const firstId = Object.keys(chats)[0];
        loadChat(firstId);
    } else {
        newChat();
    }
});
