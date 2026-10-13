const express = require("express");
const cors = require("cors");

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

// =====================================================
// CONFIGURACIÓN DE FIREBASE ADMIN
// =====================================================

const serviceAccount = require("./serviceAccountKey.json");

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const auth = getAuth();
const db = getFirestore();

// =====================================================
// CONFIGURACIÓN DE EXPRESS
// =====================================================

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8081",
    "http://127.0.0.1:8081"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// =====================================================
// COMPROBAR QUE EL BACKEND FUNCIONA
// =====================================================

app.get("/", (req, res) => {
  return res.status(200).json({
    correcto: true,
    mensaje: "Backend del Laboratorio Clínico funcionando correctamente"
  });
});

// =====================================================
// VERIFICAR ADMINISTRADOR
// =====================================================

async function verificarAdministrador(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        correcto: false,
        error: "No se recibió el token de autenticación."
      });
    }

    const token = authorization.substring(7);

    const sesion = await auth.verifyIdToken(token, true);

    const administradorDoc = await db
      .collection("usuarios")
      .doc(sesion.uid)
      .get();

    if (!administradorDoc.exists) {
      return res.status(403).json({
        correcto: false,
        error: "El administrador no existe en Firestore."
      });
    }

    const administrador = administradorDoc.data();

    if (administrador.activo !== true) {
      return res.status(403).json({
        correcto: false,
        error: "La cuenta del administrador está inactiva."
      });
    }

    if (
      administrador.rol !== "super_admin" &&
      administrador.rol !== "administrador"
    ) {
      return res.status(403).json({
        correcto: false,
        error: "No tienes permisos para cambiar contraseñas."
      });
    }

    req.administrador = {
      uid: sesion.uid,
      rol: administrador.rol,
      laboratorioId: administrador.laboratorioId || ""
    };

    next();

  } catch (error) {
    console.error("Error al verificar administrador:", error);

    return res.status(401).json({
      correcto: false,
      error: "Sesión inválida o expirada. Inicia sesión nuevamente."
    });
  }
}

// =====================================================
// CAMBIAR CONTRASEÑA DEL PERSONAL
// =====================================================

app.post("/cambiar-password", verificarAdministrador, async (req, res) => {
  try {
    const { usuarioId, nuevaPassword } = req.body || {};

    const administrador = req.administrador;

    // =================================================
    // VALIDAR DATOS
    // =================================================

    if (
      typeof usuarioId !== "string" ||
      usuarioId.trim() === ""
    ) {
      return res.status(400).json({
        correcto: false,
        error: "No se recibió el UID del empleado."
      });
    }

    if (typeof nuevaPassword !== "string") {
      return res.status(400).json({
        correcto: false,
        error: "Debes ingresar una contraseña."
      });
    }

    const passwordValido =
      nuevaPassword.length >= 8 &&
      /[A-Z]/.test(nuevaPassword) &&
      /[a-z]/.test(nuevaPassword) &&
      /[0-9]/.test(nuevaPassword) &&
      /[^A-Za-z0-9]/.test(nuevaPassword);

    if (!passwordValido) {
      return res.status(400).json({
        correcto: false,
        error:
          "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial."
      });
    }

    const uidEmpleado = usuarioId.trim();

    // =================================================
    // IMPEDIR CAMBIAR LA PROPIA CONTRASEÑA
    // =================================================

    if (administrador.uid === uidEmpleado) {
      return res.status(403).json({
        correcto: false,
        error:
          "No puedes cambiar tu propia contraseña desde este módulo."
      });
    }

    // =================================================
    // BUSCAR EMPLEADO EN FIRESTORE
    // =================================================

    const empleadoDoc = await db
      .collection("usuarios")
      .doc(uidEmpleado)
      .get();

    if (!empleadoDoc.exists) {
      return res.status(404).json({
        correcto: false,
        error:
          "El empleado no existe en Firestore. Verifica que el UID sea correcto."
      });
    }

    const empleado = empleadoDoc.data();

    if (empleado.activo !== true) {
      return res.status(403).json({
        correcto: false,
        error: "El empleado está inactivo."
      });
    }

    // =================================================
    // PERMISOS DEL SUPER ADMINISTRADOR
    // =================================================

    if (administrador.rol === "super_admin") {
      if (empleado.rol !== "administrador") {
        return res.status(403).json({
          correcto: false,
          error:
            "El Super Administrador solo puede cambiar contraseñas de administradores."
        });
      }
    }

    // =================================================
    // PERMISOS DEL ADMINISTRADOR
    // =================================================

    if (administrador.rol === "administrador") {
      const rolesPermitidos = [
        "recepcionista",
        "bioquimico",
        "bioquímico"
      ];

      if (!rolesPermitidos.includes(empleado.rol)) {
        return res.status(403).json({
          correcto: false,
          error:
            "Solo puedes cambiar contraseñas de recepcionistas y bioquímicos."
        });
      }

      if (
        !administrador.laboratorioId ||
        administrador.laboratorioId !== empleado.laboratorioId
      ) {
        return res.status(403).json({
          correcto: false,
          error:
            "El empleado no pertenece a tu laboratorio."
        });
      }
    }

    // =================================================
    // VERIFICAR CUENTA EN FIREBASE AUTHENTICATION
    // =================================================

    let cuentaFirebase;

    try {
      cuentaFirebase = await auth.getUser(uidEmpleado);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        return res.status(404).json({
          correcto: false,
          error:
            "El empleado existe en Firestore, pero no tiene una cuenta en Firebase Authentication."
        });
      }

      throw error;
    }

    if (cuentaFirebase.disabled) {
      return res.status(403).json({
        correcto: false,
        error:
          "La cuenta del empleado está deshabilitada en Firebase Authentication."
      });
    }

    // =================================================
    // ACTUALIZAR CONTRASEÑA EN FIREBASE AUTHENTICATION
    // =================================================

    await auth.updateUser(uidEmpleado, {
      password: nuevaPassword
    });

    // =================================================
    // CERRAR SESIONES ANTERIORES DEL EMPLEADO
    // =================================================

    await auth.revokeRefreshTokens(uidEmpleado);

    console.log(
      "Contraseña actualizada correctamente para UID:",
      uidEmpleado
    );

    // =================================================
    // RESPUESTA CORRECTA
    // =================================================

    return res.status(200).json({
      correcto: true,
      mensaje: "Contraseña actualizada correctamente."
    });

  } catch (error) {
    console.error("Error al cambiar contraseña:", error);

    if (error.code === "auth/user-not-found") {
      return res.status(404).json({
        correcto: false,
        error: "El usuario no existe en Firebase Authentication."
      });
    }

    if (error.code === "auth/invalid-password") {
      return res.status(400).json({
        correcto: false,
        error: "La nueva contraseña no es válida."
      });
    }

    if (
      error.code === "auth/id-token-expired" ||
      error.code === "auth/id-token-revoked"
    ) {
      return res.status(401).json({
        correcto: false,
        error: "La sesión expiró. Inicia sesión nuevamente."
      });
    }

    return res.status(500).json({
      correcto: false,
      error: "No se pudo cambiar la contraseña en Firebase Authentication."
    });
  }
});

// =====================================================
// RUTA NO ENCONTRADA
// =====================================================

app.use((req, res) => {
  return res.status(404).json({
    correcto: false,
    error: "La ruta solicitada no existe."
  });
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log("LABORATORIO CLÍNICO - BACKEND");
  console.log(`Servidor funcionando en el puerto ${PORT}`);
  console.log("========================================");
});