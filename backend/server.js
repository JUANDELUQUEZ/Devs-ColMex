// =============================================================================
// IMPORTACIONES Y CONFIGURACIÓN INICIAL
// =============================================================================

const express = require("express");
const cors = require("cors");
require("dotenv").config();

// --- ZONA DE PRUEBA DE ADN ---
try {
  const mysqlVersion = require("mysql2/package.json").version;
  console.log("🧪 PRUEBA DE ADN: Estoy usando mysql2 versión:", mysqlVersion);
} catch (error) {
  console.log(
    "🚨 ALERTA ROJA: No encuentro mysql2. Seguramente estoy usando la librería vieja.",
  );
}
// -----------------------------

const mysql = require("mysql2"); // Esta línea ya la tienes, déjala igual.

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Habilitar CORS para permitir solicitudes desde el frontend
app.use(cors());

// Parsear JSON en el cuerpo de las solicitudes
app.use(express.json());

// =============================================================================
// CONFIGURACIÓN DE BASE DE DATOS
// =============================================================================
// Actualización forzada para limpiar caché de Render - v2
// Configuración de la Base de Datos (Modo Producción)
// =============================================================================
// CONFIGURACIÓN DE BASE DE DATOS (BLINDADA) 🛡️
// =============================================================================

console.log("🔍 DIAGNÓSTICO DE VARIABLES:");
console.log(
  "   -> HOST:",
  process.env.DB_HOST ? `"${process.env.DB_HOST}"` : "❌ INDEFINIDO",
);
console.log(
  "   -> USER:",
  process.env.DB_USER ? `"${process.env.DB_USER}"` : "❌ INDEFINIDO",
);
console.log(
  "   -> PORT:",
  process.env.DB_PORT ? `"${process.env.DB_PORT}"` : "❌ INDEFINIDO",
);
console.log(
  "   -> NAME:",
  process.env.DB_NAME ? `"${process.env.DB_NAME}"` : "❌ INDEFINIDO",
);
// No imprimimos la password por seguridad, solo su longitud
console.log(
  "   -> PASS:",
  process.env.DB_PASSWORD
    ? `[OCULTO] (${process.env.DB_PASSWORD.length} caracteres)`
    : "❌ VACÍA",
);

const db = mysql.createConnection({
  host: process.env.DB_HOST ? process.env.DB_HOST.trim() : "",
  user: process.env.DB_USER ? process.env.DB_USER.trim() : "",
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.trim() : "",
  database: process.env.DB_NAME ? process.env.DB_NAME.trim() : "",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306, // Forzamos que sea un número
  ssl: {
    rejectUnauthorized: false,
  },
});

// =============================================================================
// CONEXIÓN A MYSQL Y INICIALIZACIÓN
// =============================================================================

/**
 * Conectar a la base de datos MySQL
 * Si la conexión falla, se muestra el error en consola
 * Si tiene éxito, se crea la tabla de mensajes si no existe
 */
db.connect((err) => {
  if (err) {
    console.error("❌ Error conectando a MySQL:", err.message);
    process.exit(1);
  }
  console.log("✅ Conectado a MySQL correctamente.");

  // Crear tabla de mensajes si no existe
  initializeDatabase();
});

/**
 * Inicializa la base de datos creando la tabla si no existe
 */
function initializeDatabase() {
  const sqlCreate = `
    CREATE TABLE IF NOT EXISTS mensajes_nuevos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL,
      mensaje TEXT NOT NULL,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(sqlCreate, (err) => {
    if (err) {
      console.error("❌ Error creando tabla:", err.message);
    } else {
      console.log("✅ Tabla 'mensajes_nuevos' verificada/creada.");
    }
  });
}

// =============================================================================
// FUNCIONES AUXILIARES
// =============================================================================

/**
 * Valida que los datos del formulario sean válidos
 * @param {string} nombre - Nombre del usuario
 * @param {string} email - Email del usuario
 * @param {string} mensaje - Mensaje enviado
 * @returns {boolean} True si los datos son válidos
 */
function validarDatos(nombre, email, mensaje) {
  return (
    nombre &&
    email &&
    mensaje &&
    nombre.trim() !== "" &&
    email.trim() !== "" &&
    mensaje.trim() !== ""
  );
}

// =============================================================================
// RUTAS API - POST (Crear datos)
// =============================================================================

/**
 * POST /api/mensajes
 * Recibe un nuevo mensaje de contacto y lo guarda en la base de datos
 */
app.post("/api/mensajes", (req, res) => {
  const { nombre, email, mensaje } = req.body;

  // Validar que todos los campos requeridos estén presentes
  if (!validarDatos(nombre, email, mensaje)) {
    return res.status(400).json({
      error: "Todos los campos son obligatorios y no pueden estar vacíos.",
    });
  }

  // Insertar el mensaje en la base de datos
  const query =
    "INSERT INTO mensajes_nuevos (nombre, email, mensaje) VALUES (?, ?, ?)";

  db.query(
    query,
    [nombre.trim(), email.trim(), mensaje.trim()],
    (err, result) => {
      if (err) {
        console.error("❌ Error al insertar mensaje:", err.message);
        return res.status(500).json({
          error: "Error interno del servidor. No se pudo guardar el mensaje.",
        });
      }

      console.log(
        "✅ Mensaje guardado exitosamente (ID:",
        result.insertId + ")",
      );
      res.status(201).json({
        message: "Mensaje guardado con éxito.",
        id: result.insertId,
      });
    },
  );
});

// =============================================================================
// RUTAS API - GET (Leer datos)
// =============================================================================
/**
 * GET /api/mensajes
 * PROTEGIDO: Solo permite ver mensajes si se envía la clave correcta
 */
app.get("/api/mensajes", (req, res) => {
  // 1. Buscamos la clave en la URL (ej: ?clave=JuanElMejorDev2026)
  const { clave } = req.query;

  // 2. Verificamos si la clave coincide con la del archivo .env
  if (clave !== process.env.ADMIN_SECRET) {
    return res
      .status(403)
      .json({ error: "Acceso denegado. No tienes la llave." });
  }

  // 3. Si la clave es correcta, procedemos a buscar en la Base de Datos
  const query = "SELECT * FROM mensajes_nuevos ORDER BY fecha DESC"; // Asegúrate que la tabla sea la correcta

  db.query(query, (err, resultados) => {
    if (err) {
      console.error("❌ Error al obtener mensajes:", err.message);
      return res.status(500).json({
        error: "Error interno del servidor.",
      });
    }
    res.status(200).json(resultados);
  });
});

// =============================================================================
// INICIAR SERVIDOR
// =============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 SERVIDOR INICIADO CORRECTAMENTE   ║
║   http://localhost:${PORT}             ║
╚════════════════════════════════════════╝
  `);
});
