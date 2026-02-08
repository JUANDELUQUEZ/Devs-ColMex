// =============================================================================
// CONFIGURACIÓN
// =============================================================================

// CORREGIDO: Usamos un nombre estándar y claro
const API_URL = "https://devs-colmex.onrender.com/api/mensajes";

// CORREGIDO: Aumentado a 60 segundos porque Render tarda en despertar
const TIMEOUT_MS = 60000;

// =============================================================================
// INICIALIZACIÓN DEL DOCUMENTO
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const formulario = document.getElementById("contactForm"); // Asegúrate que tu form tenga este ID en el HTML

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

function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function obtenerDatosFormulario(formulario) {
  // Asegúrate de que los inputs tengan estos IDs en tu HTML
  return {
    nombre: document.getElementById("nombre").value,
    email: document.getElementById("email").value,
    mensaje: document.getElementById("mensaje").value,
  };
}

async function enviarDatosAlServidor(datos) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // CORREGIDO: Ahora sí usamos la variable correcta API_URL
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

function mostrarMensaje(mensaje, tipo = "info") {
  const emoji = {
    exito: "✅",
    error: "❌",
    info: "ℹ️",
  };

  const prefix = emoji[tipo] || "📢";
  // Usamos alert para asegurar que lo veas, pero podrías usar un div en el HTML
  alert(`${prefix} ${mensaje}`);
}

// =============================================================================
// MANEJADOR PRINCIPAL DEL FORMULARIO
// =============================================================================

async function manejarEnvioFormulario(evento) {
  evento.preventDefault();

  const formulario = evento.target;
  const datosFormulario = obtenerDatosFormulario(formulario);
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

    // Feedback visual simple (cambiar texto del botón si quieres)
    const botonSubmit = formulario.querySelector("button[type='submit']");
    const textoOriginal = botonSubmit ? botonSubmit.innerText : "";
    if (botonSubmit) {
      botonSubmit.innerText = "Enviando... (Espere unos segundos)";
      botonSubmit.disabled = true;
    }

    const respuesta = await enviarDatosAlServidor(datosFormulario);
    const resultado = await respuesta.json();

    if (respuesta.ok) {
      console.log("✅ Mensaje enviado exitosamente");
      mostrarMensaje(
        "¡Mensaje enviado con éxito! Nos pondremos en contacto pronto.",
        "exito",
      );
      formulario.reset();
    } else {
      console.error("❌ Error del servidor:", resultado);
      mostrarMensaje(
        resultado.error || "Ocurrió un error al enviar el mensaje.",
        "error",
      );
    }
  } catch (error) {
    console.error("❌ Error de conexión:", error);

    if (error.name === "AbortError") {
      mostrarMensaje(
        "El servidor está despertando. Por favor intenta de nuevo en 30 segundos.",
        "error",
      );
    } else {
      // CORREGIDO: Mensaje de error real
      mostrarMensaje(
        "No se pudo conectar con el servidor en la nube. Revisa tu internet o intenta más tarde.",
        "error",
      );
    }
  } finally {
    // Restaurar el botón pase lo que pase
    const botonSubmit = formulario.querySelector("button[type='submit']");
    if (botonSubmit) {
      botonSubmit.innerText = textoOriginal || "Enviar";
      botonSubmit.disabled = false;
    }
  }
}
