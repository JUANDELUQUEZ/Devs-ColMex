// =============================================================================
// DEPENDENCIAS Y CONFIGURACIÓN DE APLICACIÓN
// =============================================================================
/**
 * STACK TECNOLÓGICO:
 * - Express: Framework HTTP minimalista para construir APIs REST
 * - CORS: Middleware para gestionar solicitudes cross-origin (CSRF protection)
 * - Mongoose: ODM (Object Document Mapper) para MongoDB con validaciones
 * - dotenv: Carga variables de entorno desde .env (NO commitear credenciales)
 */

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * NOTA ARQUITECTÓNICA:
 * Puerto configurable por variables de entorno para soportar
 * múltiples entornos (Render, Railway, Heroku, localhost)
 */

// =============================================================================
// CONFIGURACIÓN DE MIDDLEWARE
// =============================================================================
/**
 * ORDEN CRÍTICO: El orden de middleware afecta directamente el flujo
 * 1. CORS: Debe ejecutarse primero para permitir solicitudes cross-origin
 * 2. JSON Parser: Procesa application/json en req.body
 */

app.use(cors()); // ⚠️  TODO en v2: Restricciones a orígenes específicos
app.use(express.json()); // Límite por defecto: 100kb (ajustar si hay uploads)

// =============================================================================
// CONEXIÓN A MONGODB ATLAS
// =============================================================================
/**
 * VARIABLES REQUERIDAS:
 * - MONGO_URI: Connection string (mongodb+srv://user:pass@cluster.mongodb.net/db)
 *
 * PATRONES IMPLEMENTADOS:
 * - Early validation: Verificar configuración crítica antes de iniciar
 * - Fail fast: Detener si faltan credenciales
 *
 * SEGURIDAD:
 * ⚠️  MONGO_URI contiene credenciales. NUNCA commitear al repositorio.
 * Usar variables de entorno en (Render, Railway, Heroku, AWS)
 */

if (!process.env.MONGO_URI) {
  console.error("[CRITICAL] Missing MONGO_URI in .env file");
  process.exit(1);
}

// Configuración con opciones de resiliencia
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
  })
  .then(() => {
    console.log("[DB] MongoDB connection established");
  })
  .catch((err) => {
    console.error("[DB] Connection failed:", err.message);
    // Nota: En producción, implementar retry logic más robusto
  });

// =============================================================================
// ESQUEMA DE DATOS Y MODELO (PERSISTENCE LAYER)
// =============================================================================
/**
 * PATRÓN ARQUITECTÓNICO: Document Store con ODM (Mongoose)
 *
 * VALIDACIONES:
 * - required: Enforced tanto en aplicación como en schema
 * - trim: Normaliza espacios en blanco (\"  Juan  \" -> \"Juan\")
 * - lowercase: Normalización de email
 * - immutable: La fecha no puede ser modificada post-creación
 *
 * OPTIMIZACIONES:
 * - Index en 'fecha': Accelera queries con .sort({ fecha: -1 })
 * - Lean queries: Devuelve POJOs en lugar de Mongoose documents
 *
 * MEJORAS FUTURAS (v2.0):
 * - Validación regex para email
 * - Soft delete: Agregar field 'deletedAt'
 * - Versionado de cambios
 */

const MensajeSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, "Nombre es requerido"],
    trim: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: [true, "Email es requerido"],
    trim: true,
    lowercase: true,
  },
  mensaje: {
    type: String,
    required: [true, "Mensaje es requerido"],
  },
  fecha: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
});

// Optimización: Índice para queries frecuentes
MensajeSchema.index({ fecha: -1 });

const Mensaje = mongoose.model("Mensaje", MensajeSchema);

// =============================================================================
// RUTAS API - POST /api/mensajes (CREATE)
// =============================================================================
/**
 * ENDPOINT: POST /api/mensajes
 * RESPONSABILIDAD: Persistir nuevo mensaje de contacto
 *
 * HTTP STATUS CODES:
 *   - 201 CREATED: Creación exitosa
 *   - 400 BAD REQUEST: Validación fallida
 *   - 500 INTERNAL SERVER ERROR: Error en base de datos
 *
 * ARQUITECTURA:
 * - Double validation: Schema + runtime checks
 * - Async/await: Mejor readabilidad que promise chains
 */

app.post("/api/mensajes", async (req, res) => {
  try {
    const { nombre, email, mensaje } = req.body;

    // VALIDACIÓN: Doble check para máxima seguridad
    if (!nombre?.trim() || !email?.trim() || !mensaje?.trim()) {
      return res.status(400).json({
        success: false,
        error: "Todos los campos son obligatorios",
        code: "VALIDATION_ERROR",
      });
    }

    // CREACIÓN: Instanciar documento
    const nuevoMensaje = new Mensaje({
      nombre: nombre.trim(),
      email: email.trim(),
      mensaje: mensaje.trim(),
    });

    // PERSISTENCIA: Guardar en base de datos
    const resultado = await nuevoMensaje.save();

    console.log(`[API] Message created - ID: ${resultado._id}`);

    // RESPUESTA: HTTP 201 estándar
    res.status(201).json({
      success: true,
      message: "Mensaje almacenado correctamente",
      data: {
        id: resultado._id,
        createdAt: resultado.fecha,
      },
    });
  } catch (error) {
    console.error(`[ERROR] POST /api/mensajes - ${error.message}`);
    res.status(500).json({
      success: false,
      error: "No se pudo procesar la solicitud",
      code: "DATABASE_ERROR",
    });
  }
});

// =============================================================================
// RUTAS API - GET /api/mensajes (READ - PROTEGIDA)
// =============================================================================
/**
 * ENDPOINT: GET /api/mensajes?clave=<ADMIN_SECRET>
 * RESPONSABILIDAD: Recuperar todos los mensajes (ADMIN ONLY)
 *
 * HTTP STATUS CODES:
 *   - 200 OK: Éxito
 *   - 403 FORBIDDEN: Autenticación fallida
 *   - 500 ERROR: Error BD
 *
 * SEGURIDAD:
 * ⚠️  CRÍTICO: Query param con plain text comparison
 * Vulnerabilidades:
 * - Timing attacks: Usar crypto.timingSafeEqual()
 * - Query params en logs y browser history
 * TODO v2.0: JWT tokens en Authorization header
 *
 * PERFORMANCE:
 * - .lean(): POJOs en lugar de Mongoose documents
 * - Índice en 'fecha' optimiza .sort()
 * - Grandes datasets: Implementar paginación
 */

app.get("/api/mensajes", async (req, res) => {
  try {
    // AUTENTICACIÓN: Validar credencial
    const { clave } = req.query;

    const isAuthorized = clave && clave === process.env.ADMIN_SECRET;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: "Autenticación fallida",
        code: "UNAUTHORIZED",
      });
    }

    // QUERY: Recuperar ordenados desc por fecha
    const mensajes = await Mensaje.find().sort({ fecha: -1 }).lean().exec();

    // RESPUESTA: Metadata útil
    res.status(200).json({
      success: true,
      count: mensajes.length,
      data: mensajes,
    });
  } catch (error) {
    console.error(`[ERROR] GET /api/mensajes - ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Error en la consulta",
      code: "DATABASE_ERROR",
    });
  }
});

// =============================================================================
// INICIALIZACIÓN DEL SERVIDOR
// =============================================================================
// INICIALIZACIÓN DEL SERVIDOR
// =============================================================================
/**
 * PATRÓN: Server bootstrap
 *
 * FLUJO DE STARTUP:
 * 1. Dotenv carga variables de entorno
 * 2. Middleware configurado
 * 3. Conexión MongoDB iniciada (asincrónica)
 * 4. Routes configuradas
 * 5. Server escuchando en PORT
 *
 * NOTA IMPORTANTE:
 * - Server inicia antes de que MongoDB esté ready
 * - Requests fallarán hasta que .connect() resuelva
 * - Para bloquear: Usar async IIFE o refactorizar
 *
 * PRODUCCIÓN:
 * - Monitorear logs de conexión MongoDB
 * - Implementar health checks: GET /health
 * - Agregar graceful shutdown en SIGTERM
 */

const server = app.listen(PORT, () => {
  console.log(`[APP] Server initialized - PORT ${PORT}`);
  console.log(`[TIME] ${new Date().toISOString()}`);
});

/**
 * MEJORA FUTURA: Graceful shutdown
 * process.on("SIGTERM", () => {
 *   console.log("SIGTERM received, closing gracefully...");
 *   server.close(() => {
 *     mongoose.connection.close();
 *     process.exit(0);
 *   });
 * });
 */
