// =============================================================================
// CONFIGURACIÓN
// =============================================================================

const API_URL = "http://localhost:3000/api/mensajes";
const TIMEOUT_MS = 5000; // Tiempo máximo de espera en milisegundos

// =============================================================================
// INICIALIZACIÓN DEL DOCUMENTO
// =============================================================================

/**
 * Se ejecuta cuando el DOM está completamente cargado
 * Inicializa los eventos del formulario de contacto
 */
document.addEventListener("DOMContentLoaded", () => {
  const formulario = document.getElementById("contactForm");

  if (!formulario) {
    console.warn("⚠️  Formulario de contacto no encontrado en el DOM");
    return;
  }

  // Asignar evento de envío del formulario
  formulario.addEventListener("submit", manejarEnvioFormulario);
});

// =============================================================================
// FUNCIONES AUXILIARES
// =============================================================================

/**
 * Valida los datos del formulario
 * @param {Object} datos - Objeto con nombre, email y mensaje
 * @returns {Object} { valido: boolean, errores: string[] }
 */
function validarDatos(datos) {
  const errores = [];

  if (!datos.nombre || datos.nombre.trim() === "") {
    errores.push("El nombre es requerido");
  }

  if (!datos.email || datos.email.trim() === "") {
    errores.push("El email es requerido");
  } else if (!validarEmail(datos.email)) {
    errores.push("El email no es válido");
  }

  if (!datos.mensaje || datos.mensaje.trim() === "") {
    errores.push("El mensaje es requerido");
  } else if (datos.mensaje.trim().length < 10) {
    errores.push("El mensaje debe tener al menos 10 caracteres");
  }

  return {
    valido: errores.length === 0,
    errores: errores,
  };
}

/**
 * Valida el formato de un email
 * @param {string} email - Email a validar
 * @returns {boolean} True si el email es válido
 */
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Obtiene los datos del formulario
 * @param {HTMLFormElement} formulario - Elemento del formulario
 * @returns {Object} Objeto con nombre, email y mensaje
 */
function obtenerDatosFormulario(formulario) {
  return {
    nombre: document.getElementById("nombre").value,
    email: document.getElementById("email").value,
    mensaje: document.getElementById("mensaje").value,
  };
}

/**
 * Envía los datos al servidor
 * @param {Object} datos - Datos para enviar
 * @returns {Promise<Response>} Respuesta del servidor
 */
async function enviarDatosAlServidor(datos) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(datos),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return respuesta;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Muestra un mensaje al usuario
 * @param {string} mensaje - Texto del mensaje
 * @param {string} tipo - Tipo de mensaje: 'exito', 'error', 'info'
 */
function mostrarMensaje(mensaje, tipo = "info") {
  const emoji = {
    exito: "✅",
    error: "❌",
    info: "ℹ️",
  };

  const prefix = emoji[tipo] || "📢";
  console.log(`${prefix} ${mensaje}`);
  alert(`${prefix} ${mensaje}`);
}

// =============================================================================
// MANEJADOR PRINCIPAL DEL FORMULARIO
// =============================================================================

/**
 * Maneja el envío del formulario de contacto
 * @param {Event} evento - Evento del formulario
 */
async function manejarEnvioFormulario(evento) {
  evento.preventDefault();

  const formulario = evento.target;

  // Obtener datos del formulario
  const datosFormulario = obtenerDatosFormulario(formulario);

  // Validar datos
  const validacion = validarDatos(datosFormulario);

  if (!validacion.valido) {
    mostrarMensaje(
      `Errores encontrados:\n• ${validacion.errores.join("\n• ")}`,
      "error",
    );
    return;
  }

  try {
    console.log("📤 Enviando mensaje al servidor...");

    // Enviar datos al servidor
    const respuesta = await enviarDatosAlServidor(datosFormulario);
    const resultado = await respuesta.json();

    // Procesar respuesta del servidor
    if (respuesta.ok) {
      console.log("✅ Mensaje enviado exitosamente");
      mostrarMensaje(
        "¡Mensaje enviado con éxito! Nos pondremos en contacto pronto.",
        "exito",
      );
      formulario.reset(); // Limpiar formulario
    } else {
      console.error("❌ Error del servidor:", resultado);
      mostrarMensaje(
        resultado.error ||
          "Ocurrió un error al enviar el mensaje. Intenta nuevamente.",
        "error",
      );
    }
  } catch (error) {
    console.error("❌ Error de conexión:", error);

    if (error.name === "AbortError") {
      mostrarMensaje(
        "La solicitud tardó demasiado. Verifica tu conexión a internet e intenta nuevamente.",
        "error",
      );
    } else {
      mostrarMensaje(
        "No se pudo conectar con el servidor. Verifica que el backend (puerto 3000) esté encendido.",
        "error",
      );
    }
  }
}
