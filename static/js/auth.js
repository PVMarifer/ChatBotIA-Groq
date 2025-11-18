document.addEventListener("DOMContentLoaded", () => {

    // Detectamos en cuál página estamos
    const path = window.location.pathname;

    if (path.includes("login")) {
        initLogin();
    } else if (path.includes("registro")) {
        initRegistro();
    } else if (path.includes("contrasenna")) {
        initContrasenna();
    }
});

// ------------------------
// LOGIN
// ------------------------
function initLogin() {
    const form = document.querySelector("form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const correo = document.getElementById("correo").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!correo || !password) {
            alert("Por favor complete los campos.");
            return;
        }

        // Simulación
        console.log("Intentando iniciar sesión con:", correo, password);

        // Aquí va fetch("/login", {...}) cuando lo conectemos con Flask

        alert("Inicio de sesión exitoso (simulado).");
        window.location.href = "/"; // Cambia a donde quieras
    });
}


// ------------------------
// REGISTRO
// ------------------------
function initRegistro() {
    const form = document.querySelector("form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nombre = document.getElementById("nombre").value.trim();
        const correo = document.getElementById("correo").value.trim();
        const password = document.getElementById("password").value.trim();
        const confirmar = document.getElementById("confirmar").value.trim();

        if (!nombre || !correo || !password || !confirmar) {
            alert("Complete todos los campos.");
            return;
        }

        if (password !== confirmar) {
            alert("Las contraseñas no coinciden.");
            return;
        }

        console.log("Registrando usuario:", nombre, correo);

        // Aquí irá fetch("/registro", {...})

        alert("Registro completado (simulado).");
        window.location.href = "/login.html";
    });
}


// ------------------------
// RECUPERAR CONTRASEÑA
// ------------------------
function initContrasenna() {
    const form = document.querySelector("form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const correo = document.getElementById("correo").value.trim();

        if (!correo) {
            alert("Ingrese su correo.");
            return;
        }

        console.log("Solicitud de recuperación enviada a:", correo);

        // Aquí irá fetch("/contrasenna", ...)

        alert("Si el correo existe, se enviará un enlace para recuperar la contraseña.");
        window.location.href = "/login.html";
    });
}
