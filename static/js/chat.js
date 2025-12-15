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
    const closeTasksBtn = document.querySelector(".close-tasks-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const tasksPendientes = document.getElementById("tasks-pendientes");
    const tasksProgreso = document.getElementById("tasks-progreso");
    const tasksCompletadas = document.getElementById("tasks-completadas");
    const tareasBox = document.getElementById("tareas-box"); 

    // 
    //  MEMORIA POR USUARIO
    // 
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
    //  SIDEBAR / BTN-HAMBURGER
    // 
    hamburgerBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });

    // 
    //  CHAT / HISTORIAL
    // 
    function newChat() {
        currentChatId = Date.now().toString();
        chats[currentChatId] = [];
        chatBox.innerHTML = "";
        mostrarSugerenciasIniciales();
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
            appendMessage(msg.role === "user" ? "Tú" : "IA", msg.content, msg.role === "user" ? "user-message" : "bot-message");
        });
        updateHistory();
    }

    function updateHistory() {
        historyList.innerHTML = "";
        Object.keys(chats).sort((a, b) => b - a).forEach(id => {
            const li = document.createElement("li");
            const firstMsg = chats[id][0]?.content?.slice(0, 30) || "Nuevo chat";
            li.textContent = firstMsg;
            li.onclick = () => loadChat(id);

            const trashBtn = document.createElement("button");
            trashBtn.innerHTML = '🗑️';
            trashBtn.classList.add("history-trash-btn");
            trashBtn.addEventListener("click", e => {
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

    function appendMessage(sender, text, cssClass) {
        let contenido = "";
        try { contenido = marked.parse((text ?? "").toString()); }
        catch { contenido = (text ?? "").toString(); }

        const div = document.createElement("div");
        div.classList.add(cssClass);
        div.innerHTML = `<b>${sender}:</b><div class="message-content">${contenido}</div>`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // 
    //  ENVÍO DE MENSAJES AL CHAT
    // 
    async function sendMessage() {
        const msg = userInput.value.trim();
        if (!msg) return;
        if (!currentChatId) newChat();

        appendMessage("Tú", msg, "user-message");
        userInput.value = "";
        const msgLower = msg.toLowerCase();

        try {
            if (msgLower.includes("resúmeme") || msgLower.includes("resumelo")) return resumirTareas();
            if (msgLower.includes("tareas")) return mostrarTareasInteractivas();

            // MENSAJE NORMAL
            const response = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg })
            });
            const data = await response.json();
            if (!chats[currentChatId] || !Array.isArray(chats[currentChatId])) chats[currentChatId] = [];
            chats[currentChatId].push({ role: "user", content: msg });

            // Filtrar tareas completadas
            let respuesta = data.response;
            user_data.tasks.filter(t => t.estado === "completada").forEach(tc => {
                const regex = new RegExp(tc.titulo ?? tc, "gi");
                respuesta = respuesta.replace(regex, "");
            });

            appendMessage("IA", respuesta, "bot-message");
            chats[currentChatId].push({ role: "bot", content: respuesta });
            saveChats();

        } catch (error) {
            appendMessage("Error", error.toString(), "error-message");
        }
    }

    function resumirTareas() {
        const pendientes = user_data.tasks.filter(t => t.estado === "pendiente").sort((a,b) => new Date(a.fecha)-new Date(b.fecha));
        let resumen = pendientes.length === 0
            ? "No tienes tareas pendientes."
            : "Estas son tus tareas pendientes:\n" + pendientes.map(t => `- ${t.titulo} (para ${new Date(t.fecha).toLocaleDateString()})`).join("\n");
        appendMessage("IA", resumen, "bot-message");
        chats[currentChatId].push({ role: "bot", content: resumen });
        saveChats();
    }

    function mostrarTareasInteractivas() {
        const tareasPendientes = user_data.tasks.filter(t => t.estado === "pendiente");
        const colorTurquesa = "#1abc9c";

        if (tareasPendientes.length === 0) {
            appendMessage("IA", "No tienes tareas pendientes.", "bot-message");
        } else {
            tareasPendientes.forEach(t => {
                const fecha = new Date(t.fecha).toLocaleString();
                const div = document.createElement("div");
                div.classList.add("bot-message");
                Object.assign(div.style, {
                    background: colorTurquesa, color: "#fff", padding: "6px 10px",
                    margin: "4px 0", borderRadius: "5px", display: "flex",
                    justifyContent: "space-between", alignItems: "center"
                });
                const p = document.createElement("div");
                p.textContent = `${t.titulo} (para ${fecha})`;
                div.appendChild(p);

                const btn = document.createElement("button");
                Object.assign(btn.style, { background: "#16a085", color: "#fff", border: "none", borderRadius: "3px", padding: "2px 6px", cursor: "pointer" });
                btn.title = "Marcar como hecha"; btn.textContent = "✅";
                btn.addEventListener("click", async () => {
                    t.estado = "completada";
                    saveUserData();
                    renderTasks();
                    div.remove();
                    try { await fetch("/actualizar_tarea", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ titulo: t.titulo, estado: "completada" }) }); }
                    catch(err){console.error(err);}
                });
                div.appendChild(btn);
                chatBox.appendChild(div);
                chatBox.scrollTop = chatBox.scrollHeight;
            });
        }
    }

    // 
    //  ALERTAS / RECORDATORIOS
    // 
    const alarmaSonido = new Audio("/static/sounds/alarma.mp3");
    if (Notification.permission !== "granted") Notification.requestPermission();

    function lanzarNotificacion(titulo) {
        if (Notification.permission === "granted") new Notification("⏰ Recordatorio", { body: titulo });
    }

    function activarEfectosRecordatorio(titulo) {
        try { alarmaSonido.currentTime = 0; alarmaSonido.play(); } catch {}
        if (navigator.vibrate) navigator.vibrate([300,150,300]);
        lanzarNotificacion(titulo);
    }

    function mostrarMiniWidget(titulo, segundos = 60) {
    const box = document.getElementById("mini-warning");
    if (!box) return;
    box.innerHTML = ''; 
    box.style.display = "block";

    const mensaje = document.createElement("span");
    mensaje.innerHTML = `⚠ Falta 1 minuto para: <b>${titulo}</b> (<span id="tiempo-restante">${segundos}</span>s)`;
    box.appendChild(mensaje);

    const btn = document.createElement("button");
    btn.textContent = "✖";
    btn.id = "mini-warning-close";
    Object.assign(btn.style, { marginLeft: "10px", cursor: "pointer" });
    btn.addEventListener("click", () => {
        box.style.display = "none";
        clearInterval(intervalo);
    });
    box.appendChild(btn);

    let tiempoRestante = segundos;
    const intervalo = setInterval(() => {
        tiempoRestante--;
        if (tiempoRestante <= 0) {
            box.style.display = "none";
            clearInterval(intervalo);
            return;
        }
        document.getElementById("tiempo-restante").textContent = tiempoRestante;
    }, 1000);
}
    function scheduleReminder(titulo, when) {
        const now=Date.now(); const eventTime=when.getTime(); const delay=eventTime-now; if(delay<=0) return;
        const warningDelay = delay-60000;
        if(warningDelay>0) setTimeout(()=>mostrarMiniWidget(titulo,60), warningDelay);
        else mostrarMiniWidget(titulo, Math.floor(delay/1000));
        setTimeout(()=>{ activarEfectosRecordatorio(titulo); Swal.fire("⏰ Recordatorio", titulo, "info"); appendMessage("IA", `⏰ Recordatorio: ${titulo}`, "bot-message"); }, delay);
    }

    // 
    //  CREAR NUEVA TAREA
    // 
    addTaskBtn.addEventListener("click", crearNuevaTarea);
    function crearNuevaTarea() {
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
                const h = parseInt(hVal,10), m=parseInt(mVal,10);
                if(!t||!d||hVal===""||mVal===""){Swal.showValidationMessage("Completa todos los campos"); return false;}
                if(isNaN(h)||isNaN(m)||h<0||h>23||m<0||m>59){Swal.showValidationMessage("Hora o minutos inválidos"); return false;}
                const fechaSeleccionada = new Date(`${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
                if(fechaSeleccionada<new Date()){Swal.showValidationMessage("No puedes poner tareas en el pasado"); return false;}
                return {t,d,h,m};
            },
            didOpen: ()=>{
                Swal.getPopup().querySelectorAll('input').forEach(input=>{
                    input.addEventListener('keydown',e=>{if(e.key==='Enter') Swal.clickConfirm();});
                });
            }
        }).then(r=>{
            if(r.isConfirmed && r.value){
                const {t,d,h,m}=r.value;
                const date=new Date(`${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
                user_data.tasks.push({titulo:t,fecha:date.toISOString(),estado:"pendiente"});
                saveUserData(); scheduleReminder(t,date);
                Swal.fire("Listo",`Tarea para ${date.toLocaleString()}`,"success");
            }
        });
    }

    // 
    //  PANEL DE TAREAS
    // 
    viewTasksBtn.addEventListener("click",()=>{
        renderTasks(); tasksPanel.classList.add("tasks-sidebar-open"); hamburgerBtn.style.visibility="hidden"; logoutBtn.style.visibility="hidden";
    });
    closeTasksBtn.addEventListener("click",()=>{
        tasksPanel.classList.remove("tasks-sidebar-open"); hamburgerBtn.style.visibility="visible"; logoutBtn.style.visibility="visible";
    });

    function renderTasks(){
        tasksPendientes.innerHTML=""; tasksProgreso.innerHTML=""; tasksCompletadas.innerHTML="";
        user_data.tasks.forEach((task,index)=>{
            const li=document.createElement("li");
            li.innerHTML=`<div class="task-info"><strong>${task.titulo}</strong><br><small>${new Date(task.fecha).toLocaleString()}</small></div>
                          <div class="task-actions">
                          <i class="fa-solid fa-clock kanban-icon" data-action="pendiente" title="Pendiente"></i>
                          <i class="fa-solid fa-spinner kanban-icon" data-action="progreso" title="En progreso"></i>
                          <i class="fa-solid fa-check kanban-icon" data-action="completada" title="Completada"></i>
                          <i class="fa-solid fa-trash-can kanban-icon" data-delete title="Eliminar"></i>
                          </div>`;
            li.querySelectorAll(".kanban-icon[data-action]").forEach(icon=>{
                icon.addEventListener("click",()=>{task.estado=icon.dataset.action; saveUserData(); renderTasks();});
            });
            li.querySelector(".kanban-icon[data-delete]").addEventListener("click",()=>{
                user_data.tasks.splice(index,1); saveUserData(); renderTasks();
            });
            if(task.estado==="pendiente") tasksPendientes.appendChild(li);
            else if(task.estado==="progreso") tasksProgreso.appendChild(li);
            else tasksCompletadas.appendChild(li);
        });
    }

    // 
    //  SUGERENCIAS INICIALES
    // 
    function mostrarSugerenciasIniciales(){
        const sugerencias=[
            {texto:"Ver tareas pendientes", accion:()=>sendMessageConTexto("tareas")},
            {texto:"Resumir pendientes", accion:()=>sendMessageConTexto("resúmeme")},
            {texto:"Sugerencias para mis pendientes", accion:()=>appendMessage("IA","💡 Podrías priorizar tus tareas más urgentes primero.","bot-message")}
        ];
        sugerencias.forEach(s=>{
            const div=document.createElement("div");
            div.classList.add("bot-message");
            Object.assign(div.style,{background:"#1abc9c", color:"#fff", padding:"6px 10px", margin:"4px 0", borderRadius:"5px", cursor:"pointer"});
            div.textContent=s.texto;
            div.addEventListener("click",s.accion);
            chatBox.appendChild(div);
        });
        chatBox.scrollTop=chatBox.scrollHeight;
    }
    function sendMessageConTexto(texto){ userInput.value=texto; sendMessage(); }

    // 
    //  INICIALIZACIÓN
    // 
    function init(){
        if(Object.keys(chats).length===0) newChat();
        else{ const ids=Object.keys(chats).sort((a,b)=>b-a); currentChatId=ids[0]; loadChat(currentChatId);}
        mostrarSugerenciasIniciales();
        const now=Date.now();
        user_data.tasks.forEach(t=>{ const when=new Date(t.fecha); if(!t.hecho && when.getTime()>now) scheduleReminder(t.titulo,when); });
    }
    init();

    // 
    //  BOTONES / EVENTOS
    // 
    sendBtn.addEventListener("click",sendMessage);
    userInput.addEventListener("keydown",e=>{if(e.key==="Enter") sendMessage();});
    newChatBtn.addEventListener("click",newChat);

    // 
    //  LOGOUT
    // 
    logoutBtn.addEventListener("click",()=>{
        Swal.fire({
            title:"¿Cerrar sesión?",
            icon:"warning",
            showCancelButton:true,
            confirmButtonText:"Sí, salir",
            cancelButtonText:"Cancelar"
        }).then(result=>{ if(result.isConfirmed){ window.location.href="/logout"; } });
    });

    // 
    //  ALERTAS  PERIÓDICAS
    // 
    function revisarTareas(){
        const ahora=new Date();
        const proximas=user_data.tasks.filter(t=>t.estado==="pendiente").filter(t=>new Date(t.fecha)-ahora<=60*60*1000);
        proximas.forEach(t=>{ const fecha=new Date(t.fecha).toLocaleTimeString(); appendMessage("IA",`📌 Atención: Tienes próxima tarea "${t.titulo}" a las ${fecha}`,"bot-message"); });
    }
    setInterval(revisarTareas,60000);
});
