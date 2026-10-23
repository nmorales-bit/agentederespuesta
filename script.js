// ===== Configuración de comportamiento =====
const TIEMPO_LIMITE_MS = 30000;        // Tiempo máximo de espera de la respuesta (30 s)
const ESPERA_ENTRE_ENVIOS_MS = 3000;   // Pausa obligatoria entre un envío y el siguiente (3 s)

// ===== Referencias al DOM =====
const zonaDeChat = document.getElementById("zona-de-chat");
const ingresoDeDatos = document.getElementById("ingreso-de-datos");
const campoMensaje = document.getElementById("campo-mensaje");
const botonEnviar = document.getElementById("boton-enviar");

// ===== Funciones de la interfaz =====

// Agrega una burbuja a la zona de chat y baja el scroll
function agregarMensaje(texto, tipo) {
  const burbuja = document.createElement("div");
  burbuja.className = `burbuja ${tipo}`;
  burbuja.textContent = texto; // textContent evita inyectar HTML
  zonaDeChat.appendChild(burbuja);
  bajarScroll();
  return burbuja;
}

// Muestra la burbuja de "cargando" (tres puntos animados)
function mostrarCargando() {
  const burbuja = document.createElement("div");
  burbuja.className = "burbuja agente cargando";
  burbuja.innerHTML = "<span></span><span></span><span></span>";
  zonaDeChat.appendChild(burbuja);
  bajarScroll();
  return burbuja;
}

function bajarScroll() {
  zonaDeChat.scrollTop = zonaDeChat.scrollHeight;
}

// Bloquea o habilita el envío
function bloquearEnvio(bloqueado) {
  botonEnviar.disabled = bloqueado;
  campoMensaje.disabled = bloqueado;
  if (!bloqueado) campoMensaje.focus();
}

// ===== Comunicación con el webhook =====

// Envía el mensaje al webhook con límite de tiempo (AbortController)
async function enviarAlWebhook(mensaje) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_MS);

  try {
    const respuesta = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje }),
      signal: controlador.signal
    });

    if (!respuesta.ok) {
      throw new Error(`El servidor respondió con estado ${respuesta.status}`);
    }
    return await leerRespuesta(respuesta);
  } finally {
    clearTimeout(temporizador); // Siempre limpiamos el temporizador
  }
}

// Lee la respuesta: acepta JSON (campos comunes) o texto plano
async function leerRespuesta(respuesta) {
  const texto = await respuesta.text();
  try {
    const datos = JSON.parse(texto);
    return datos.respuesta || datos.reply || datos.output || datos.message || datos.text || JSON.stringify(datos);
  } catch {
    return texto || "El agente no devolvió contenido.";
  }
}

// Traduce el error técnico a un mensaje claro para el usuario
function mensajeDeError(error) {
  if (error.name === "AbortError") {
    return "La espera fue demasiado larga y se canceló. Probá de nuevo.";
  }
  return "No pude comunicarme con el agente. Revisá tu conexión e intentá nuevamente.";
}

// ===== Flujo principal de envío =====
async function manejarEnvio(evento) {
  evento.preventDefault();

  const mensaje = campoMensaje.value.trim();
  if (!mensaje || botonEnviar.disabled) return;

  agregarMensaje(mensaje, "usuario");
  campoMensaje.value = "";
  bloquearEnvio(true);                    // Evita envíos múltiples
  const burbujaCargando = mostrarCargando(); // Estado: cargando

  try {
    const respuesta = await enviarAlWebhook(mensaje);
    agregarMensaje(respuesta, "agente");  // Estado: éxito
  } catch (error) {
    console.error(error);
    agregarMensaje(mensajeDeError(error), "error"); // Estado: error
  } finally {
    burbujaCargando.remove();
    // Temporizador de espera antes de permitir otro envío
    setTimeout(() => bloquearEnvio(false), ESPERA_ENTRE_ENVIOS_MS);
  }
}

// Enter envía; Shift+Enter hace salto de línea
function manejarTecla(evento) {
  if (evento.key === "Enter" && !evento.shiftKey) {
    evento.preventDefault();
    ingresoDeDatos.requestSubmit();
  }
}

// ===== Inicio =====
ingresoDeDatos.addEventListener("submit", manejarEnvio);
campoMensaje.addEventListener("keydown", manejarTecla);
agregarMensaje("¡Hola! Soy tu consultor de agente de viaje. Contame qué tipo de viaje buscás y te oriento sobre destinos.", "agente");