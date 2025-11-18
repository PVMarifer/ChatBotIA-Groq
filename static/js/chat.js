document.addEventListener("DOMContentLoaded", () => {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const historyList = document.getElementById("history");
    const newChatBtn = document.getElementById("new-chat-btn");
    const addTaskBtn = document.getElementById("add-task-btn");
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const sidebar = document.querySelector(".sidebar");
    const viewTasksBtn = document.getElementById("view-tasks-btn");
    const tasksPanel = document.getElementById("tasks-panel");
    const tasksList = document.getElementById("tasks-list");
    const closeTasksBtn = document.querySelector(".close-tasks-btn");

    let chats = JSON.parse(localStorage.getItem("chats")) || {};
    let currentChatId = null;
    let user_data = JSON.parse(localStorage.getItem("user_data")) || { tasks: [] };

    /* ---------------------------
       Sidebar izquierda- Menú hamburguesa
    ----------------------------*/
    hamburgerBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });

    /* ---------------------------
       Chats
    ----------------------------*/
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
            appendMessage(
                msg.role === "user" ? "Tú" : "IA",
                msg.content,
                msg.role === "user" ? "user-message" : "bot-message"
            );
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
        Object.keys(chats)
            .sort((a, b) => b - a)
            .forEach(id => {
                const li = document.createElement("li");
                const firstMsg = chats[id][0]?.content?.slice(0, 30) || "Nuevo chat";
                li.textContent = firstMsg;

                li.onclick = () => loadChat(id);

                const trashBtn = document.createElement("button");
                trashBtn.textContent = "🗑️";
                trashBtn.classList.add("history-trash-btn");

                trashBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    Swal.fire({
                        title: '¿Eliminar chat?',
                        icon: 'warning',
                        showCancelButton: true
                    }).then(r => {
                        if (r.isConfirmed) {
                            delete chats[id];
                            saveChats();
                            updateHistory();
                            chatBox.innerHTML = "";
                        }
                    });
                });

                li.appendChild(trashBtn);
                historyList.appendChild(li);
            });
    }

function appendMessage(sender, text, cssClass) {
    let contenido = "";

    try {
        contenido = marked.parse((text ?? "").toString());
    } catch (e) {
        contenido = (text ?? "").toString();
    }

    const div = document.createElement("div");
    div.classList.add(cssClass);
    div.innerHTML = `
        <b>${sender}:</b>
        <div class="message-content">${contenido}</div>
    `;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}


    async function sendMessage() {
        const msg = userInput.value.trim();
        if (!msg) return;

        if (!currentChatId) newChat();

        appendMessage("Tú", msg, "user-message");
        userInput.value = "";

        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg }),
            });

            const data = await response.json();
            appendMessage("IA", data.response, "bot-message");

            chats[currentChatId].push({ role: "user", content: msg });
            chats[currentChatId].push({ role: "bot", content: data.response });
            saveChats();
        } catch (error) {
            appendMessage("Error", error.toString(), "error-message");
        }
    }

    sendBtn.addEventListener("click", sendMessage);
    userInput.addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });
    newChatBtn.addEventListener("click", newChat);

    /* ---------------------------
       TAREAS Y RECORDATORIOS
    ----------------------------*/
addTaskBtn.addEventListener("click", () => {
    Swal.fire({
        title: 'Nueva tarea',
        html: `
            <style>
                .swal2-input { text-align: center; width: 80% !important; margin: 8px auto !important; }
            </style>
            <input id="task-title" class="swal2-input" placeholder="Título">
            <input id="task-date" type="date" class="swal2-input">
            <input id="task-hour" type="number" min="0" max="23" class="swal2-input" placeholder="Hora (0-23)">
            <input id="task-minute" type="number" min="0" max="59" class="swal2-input" placeholder="Minutos (0-59)">
        `,
        confirmButtonText: 'Agregar',
        preConfirm: () => {
            const t = document.getElementById('task-title').value.trim();
            const d = document.getElementById('task-date').value;
            const h = parseInt(document.getElementById('task-hour').value);
            const m = parseInt(document.getElementById('task-minute').value);

            if (!t || !d || isNaN(h) || isNaN(m)) 
                return Swal.showValidationMessage("Completa todos los campos");

            if (h < 0 || h > 23) 
                return Swal.showValidationMessage("Hora inválida (0–23)");

            if (m < 0 || m > 59) 
                return Swal.showValidationMessage("Minutos inválidos (0–59)");

            return { t, d, h, m };
        },
        didOpen: () => {
            const inputs = Swal.getPopup().querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        Swal.clickConfirm();
                    }
                });
            });
        }
    }).then(r => {
        if (r.isConfirmed) {
            const { t, d, h, m } = r.value;
            const date = new Date(`${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);

            user_data.tasks.push({ titulo: t, fecha: date.toISOString(), hecho: false });
            saveUserData();
            scheduleReminder(t, date);

            Swal.fire("Listo", `Tarea para ${date.toLocaleString()}`, "success");
        }
    });
});


    /* ---------------------------
       MINI WIDGET CON CUENTA REGRESIVA
    ----------------------------*/
    const alarmaSonido = new Audio("/static/sounds/alarma.mp3");

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    function lanzarNotificacion(titulo) {
        if (Notification.permission === "granted") {
            new Notification("⏰ Recordatorio", { body: titulo });
        }
    }

    function activarEfectosRecordatorio(titulo) {
        try { alarmaSonido.currentTime = 0; alarmaSonido.play(); } catch (e) {}
        if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
        lanzarNotificacion(titulo);
    }

    function mostrarMiniWidget(titulo, segundos = 60) {
        const box = document.getElementById("mini-warning");
        if (!box) return;

        box.style.display = "block";
        let tiempoRestante = segundos;

        function actualizarWidget() {
            if (tiempoRestante <= 0) {
                box.style.display = "none";
                clearInterval(intervalo);
                return;
            }
            box.innerHTML = `⚠ Falta 1 minuto para: <b>${titulo}</b> (${tiempoRestante}s)
                <button onclick="document.getElementById('mini-warning').style.display='none'; clearInterval(intervalo);">Cerrar</button>`;
            tiempoRestante--;
        }

        actualizarWidget();
        const intervalo = setInterval(actualizarWidget, 1000);
    }

    function scheduleReminder(titulo, when) {
        const now = Date.now();
        const eventTime = when.getTime();
        const delay = eventTime - now;
        if (delay <= 0) return;

        const warningDelay = delay - 60000;
        if (warningDelay > 0) {
            setTimeout(() => mostrarMiniWidget(titulo, 60), warningDelay);
        } else {
            mostrarMiniWidget(titulo, Math.floor(delay / 1000));
        }

        setTimeout(() => {
            activarEfectosRecordatorio(titulo);
            Swal.fire("⏰ Recordatorio", titulo, "info");
            appendMessage("IA", `⏰ Recordatorio: ${titulo}`, "bot-message");
        }, delay);
    }

    /* ---------------------------
       PANEL DE TAREAS
    ----------------------------*/
    viewTasksBtn.addEventListener("click", () => {
        renderTasks();
        tasksPanel.classList.add("tasks-sidebar-open");
    });

    closeTasksBtn.addEventListener("click", () => {
        tasksPanel.classList.remove("tasks-sidebar-open");
    });

    function renderTasks() {
        tasksList.innerHTML = "";
        const activos = user_data.tasks.filter(t => !t.hecho);

        if (activos.length === 0) {
            tasksList.innerHTML = "<li>No hay tareas</li>";
            return;
        }

        activos.forEach(task => {
            const li = document.createElement("li");
            const fecha = new Date(task.fecha).toLocaleString();
            li.innerHTML = `
                <strong>${task.titulo}</strong><br>
                <small>${fecha}</small>
                <button class="delete-btn">🗑️</button>
            `;
            li.querySelector(".delete-btn").addEventListener("click", () => {
                user_data.tasks = user_data.tasks.filter(t => t !== task);
                saveUserData();
                renderTasks();
            });
            tasksList.appendChild(li);
        });
    }
    updateHistory();
});
