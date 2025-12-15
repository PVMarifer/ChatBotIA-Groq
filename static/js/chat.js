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
    const logoutBtn = document.getElementById("logout-btn");
    const tasksPendientes = document.getElementById("tasks-pendientes");
    const tasksProgreso = document.getElementById("tasks-progreso");
    const tasksCompletadas = document.getElementById("tasks-completadas");

    // -----------------------
    // STORAGE POR USUARIO
    // -----------------------
    if (typeof USER_ID === "undefined" || USER_ID === null) {
        console.error("USER_ID no definido. Asegurate de inyectar USER_ID desde Flask en el HTML.");
    }

    const storageKey = `chats_${USER_ID}`;
    const userDataKey = `user_data_${USER_ID}`;

    let chats = JSON.parse(localStorage.getItem(storageKey)) || {};
    let currentChatId = null;
    let user_data = JSON.parse(localStorage.getItem(userDataKey)) || { tasks: [] };

    function saveChats() { localStorage.setItem(storageKey, JSON.stringify(chats)); }
    function saveUserData() { localStorage.setItem(userDataKey, JSON.stringify(user_data)); }

    // 
    // SIDEBAR / BTN-HAMBURGER
    // 
    hamburgerBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });

    // 
    // HISTORIAL / CHATS
    // 
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

        if (!chats[id] || !Array.isArray(chats[id])) {
            chats[id] = [];
            saveChats();
        }

        chats[id].forEach(msg => {
            appendMessage(
                msg.role === "user" ? "Tú" : "IA",
                msg.content,
                msg.role === "user" ? "user-message" : "bot-message"
            );
        });

        updateHistory();
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
                trashBtn.innerHTML = '🗑️';
                trashBtn.classList.add("history-trash-btn");
                trashBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    Swal.fire({
                        title: '¿Eliminar chat?',
                        text: "Esto no se puede deshacer",
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Sí, eliminar',
                        cancelButtonText: 'Cancelar'
                    }).then(r => {
                        if (r.isConfirmed) {
                            delete chats[id];
                            saveChats();
                            updateHistory();
                            if (currentChatId === id) {
                                chatBox.innerHTML = "";
                                currentChatId = null;
                            }
                            Swal.fire("Eliminado", "El chat fue eliminado", "success");
                        }
                    });
                });

                li.appendChild(trashBtn);
                historyList.appendChild(li);
            });
    }

    // 
    // RENDER MENSAJES
    // 
    function appendMessage(sender, text, cssClass) {
        let contenido = "";
        try { contenido = marked.parse((text ?? "").toString()); }
        catch (e) { contenido = (text ?? "").toString(); }

        const div = document.createElement("div");
        div.classList.add(cssClass);
        div.innerHTML = `
            <b>${sender}:</b>
            <div class="message-content">${contenido}</div>
        `;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // 
    // ENVÍO DE MENSAJES
    // 
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

            if (!chats[currentChatId] || !Array.isArray(chats[currentChatId])) {
                chats[currentChatId] = [];
            }

            chats[currentChatId].push({ role: "user", content: msg });
            appendMessage("IA", data.response, "bot-message");
            chats[currentChatId].push({ role: "bot", content: data.response });

            saveChats();
        } catch (error) {
            appendMessage("Error", error.toString(), "error-message");
        }
    }

    sendBtn.addEventListener("click", sendMessage);
    userInput.addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });
    newChatBtn.addEventListener("click", newChat);

    // 
    // TAREAS Y RECORDATORIOS
    // 

    const alarmaSonido = new Audio("/static/sounds/alarma.mp3");
    if (Notification.permission !== "granted") Notification.requestPermission();

    function lanzarNotificacion(titulo) {
        if (Notification.permission === "granted") {
            new Notification("⏰ Recordatorio", { body: titulo });
        }
    }

    function activarEfectosRecordatorio(titulo) {
        try { alarmaSonido.currentTime = 0; alarmaSonido.play(); } catch (e) { }
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
                <button id="mini-warning-close">✖</button>`;
            tiempoRestante--;
        }

        actualizarWidget();
        const intervalo = setInterval(actualizarWidget, 1000);

        setTimeout(() => {
            const btn = document.getElementById("mini-warning-close");
            if (btn) btn.addEventListener("click", () => { box.style.display = "none"; clearInterval(intervalo); });
        }, 50);
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

addTaskBtn.addEventListener("click", () => {
    Swal.fire({
        title: 'Nueva tarea',
        html: `
            <input id="task-title" class="swal2-input" placeholder="Título">
            <input id="task-date" type="date" class="swal2-input">
            <input id="task-hour" type="number" min="0" max="23" class="swal2-input" placeholder="Hora (0-23)">
            <input id="task-minute" type="number" min="0" max="59" class="swal2-input" placeholder="Minutos (0-59)">
        `,
        showCloseButton: true,
        closeButtonHtml: '✖',
        confirmButtonText: 'Agregar',
        focusConfirm: false,
        preConfirm: () => {
            const t = document.getElementById('task-title').value.trim();
            const d = document.getElementById('task-date').value;
            const hVal = document.getElementById('task-hour').value;
            const mVal = document.getElementById('task-minute').value;
            const h = parseInt(hVal, 10);
            const m = parseInt(mVal, 10);

            if (!t || !d || hVal === "" || mVal === "") {
                Swal.showValidationMessage("Completa todos los campos");
                return false;
            }

            if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
                Swal.showValidationMessage("Hora o minutos inválidos");
                return false;
            }

            const fechaSeleccionada = new Date(`${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
            const ahora = new Date();
            if (fechaSeleccionada < ahora) {
                Swal.showValidationMessage("No puedes poner tareas en el pasado");
                return false;
            }

            return { t, d, h, m };
        },
        didOpen: () => {
            const inputs = Swal.getPopup().querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('keydown', e => {
                    if (e.key === 'Enter') Swal.clickConfirm();
                });
            });
        }
    }).then(r => {
        if (r.isConfirmed && r.value) {
            const { t, d, h, m } = r.value;
            const date = new Date(`${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
            user_data.tasks.push({ 
                titulo: t,
                fecha: date.toISOString(),
                estado: "pendiente"
            });
            saveUserData();
            scheduleReminder(t, date);
            Swal.fire("Listo", `Tarea para ${date.toLocaleString()}`, "success");
        }
    });
});

     // 
    // PANEL DE TAREAS
    // 

    viewTasksBtn.addEventListener("click", () => {
        renderTasks();
        tasksPanel.classList.add("tasks-sidebar-open");
        hamburgerBtn.style.visibility = "hidden";
        logoutBtn.style.visibility = "hidden";
    });

    closeTasksBtn.addEventListener("click", () => {
        tasksPanel.classList.remove("tasks-sidebar-open");
        hamburgerBtn.style.visibility = "visible";
        logoutBtn.style.visibility = "visible";
    });

function renderTasks() {
    const tasksPendientes = document.getElementById("tasks-pendientes");
    const tasksProgreso = document.getElementById("tasks-progreso");
    const tasksCompletadas = document.getElementById("tasks-completadas");

    tasksPendientes.innerHTML = "";
    tasksProgreso.innerHTML = "";
    tasksCompletadas.innerHTML = "";

    user_data.tasks.forEach((task, index) => {
        const li = document.createElement("li");

        li.innerHTML = `
            <div class="task-info">
                <strong>${task.titulo}</strong><br>
                <small>${new Date(task.fecha).toLocaleString()}</small>
            </div>
            <div class="task-actions">
                <i class="fa-solid fa-clock kanban-icon" data-action="pendiente" title="Pendiente"></i>
                <i class="fa-solid fa-spinner kanban-icon" data-action="progreso" title="En progreso"></i>
                <i class="fa-solid fa-check kanban-icon" data-action="completada" title="Completada"></i>
                <i class="fa-solid fa-trash-can kanban-icon" data-delete title="Eliminar"></i>
            </div>
        `;

        // Eventos de cambio de estado
        li.querySelectorAll(".kanban-icon[data-action]").forEach(icon => {
            icon.addEventListener("click", () => {
                task.estado = icon.dataset.action;
                saveUserData();
                renderTasks();
            });
        });

        // Evento eliminar
        li.querySelector(".kanban-icon[data-delete]").addEventListener("click", () => {
            user_data.tasks.splice(index, 1);
            saveUserData();
            renderTasks();
        });

        // Agregar a la columna correspondiente
        if (task.estado === "pendiente") tasksPendientes.appendChild(li);
        else if (task.estado === "progreso") tasksProgreso.appendChild(li);
        else tasksCompletadas.appendChild(li);
    });
}

    // 
    // INICIALIZACIÓN
    // 
    function init() {
        if (Object.keys(chats).length === 0) newChat();
        else {
            const ids = Object.keys(chats).sort((a,b)=>b-a);
            currentChatId = ids[0];
            loadChat(currentChatId);
        }

        const now = Date.now();
        user_data.tasks.forEach(t => {
            const when = new Date(t.fecha);
            if (!t.hecho && when.getTime() > now) scheduleReminder(t.titulo, when);
        });
    }

    init();

    // 
    // ACCIÓN DE LOGOUT
    // 
    logoutBtn.addEventListener("click", () => {
        Swal.fire({
            title: "¿Cerrar sesión?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, salir",
            cancelButtonText: "Cancelar"
        }).then(result => {
            if (result.isConfirmed) {
                window.location.href = "/logout";
            }
        });
    });

});
