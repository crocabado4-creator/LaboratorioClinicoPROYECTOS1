const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function validarPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

async function obtenerUsuario(uid) {
  const documento = await db
    .collection("usuarios")
    .doc(uid)
    .get();

  if (!documento.exists) {
    throw new HttpsError(
      "not-found",
      "El usuario no existe."
    );
  }

  return documento.data();
}

// =====================================================
// 1. CAMBIAR CONTRASEÑA POR SUPERADMIN
// FUNCIÓN EXISTENTE PARA WEB
// =====================================================

exports.cambiarPasswordPorSuperAdmin = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión."
      );
    }

    const usuarioActual = await obtenerUsuario(
      request.auth.uid
    );

    if (
      usuarioActual.rol !== "super_admin" ||
      usuarioActual.activo !== true
    ) {
      throw new HttpsError(
        "permission-denied",
        "Solo el SuperAdmin puede cambiar contraseñas."
      );
    }

    const { usuarioId, nuevaPassword } =
      request.data || {};

    if (
      typeof usuarioId !== "string" ||
      !usuarioId.trim()
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Selecciona un administrador válido."
      );
    }

    if (!validarPassword(nuevaPassword)) {
      throw new HttpsError(
        "invalid-argument",
        "La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo."
      );
    }

    if (request.auth.uid === usuarioId) {
      throw new HttpsError(
        "permission-denied",
        "No puedes cambiar tu propia contraseña."
      );
    }

    const usuarioObjetivo = await obtenerUsuario(
      usuarioId
    );

    if (usuarioObjetivo.rol !== "administrador") {
      throw new HttpsError(
        "permission-denied",
        "Solo puedes cambiar contraseñas de administradores."
      );
    }

    try {
      await admin.auth().updateUser(
        usuarioId,
        {
          password: nuevaPassword,
        }
      );

      await admin.auth().revokeRefreshTokens(
        usuarioId
      );

      return {
        correcto: true,
        mensaje:
          "Contraseña actualizada correctamente.",
      };
    } catch (error) {
      console.error(
        "Error al cambiar contraseña:",
        error
      );

      throw new HttpsError(
        "internal",
        "No se pudo cambiar la contraseña."
      );
    }
  }
);

// =====================================================
// 2. CAMBIAR CONTRASEÑA SEGÚN EL ROL
// SUPERADMIN -> ADMINISTRADOR
// ADMINISTRADOR -> RECEPCIONISTA / BIOQUIMICO
// =====================================================

exports.cambiarPasswordUsuario = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    // ================================================
    // VALIDAR SESIÓN
    // ================================================

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión."
      );
    }

    const uidActual = request.auth.uid;

    const uidObjetivo =
      request.data?.uidObjetivo;

    const nuevaPassword =
      request.data?.nuevaPassword;

    // ================================================
    // VALIDAR DATOS
    // ================================================

    if (
      typeof uidObjetivo !== "string" ||
      !uidObjetivo.trim()
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Selecciona un usuario válido."
      );
    }

    if (!validarPassword(nuevaPassword)) {
      throw new HttpsError(
        "invalid-argument",
        "La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo."
      );
    }

    if (uidActual === uidObjetivo) {
      throw new HttpsError(
        "permission-denied",
        "No puedes cambiar tu propia contraseña desde este módulo."
      );
    }

    // ================================================
    // OBTENER USUARIOS
    // ================================================

    const actual = await obtenerUsuario(
      uidActual
    );

    const objetivo = await obtenerUsuario(
      uidObjetivo
    );

    if (actual.activo !== true) {
      throw new HttpsError(
        "permission-denied",
        "Tu cuenta está inactiva."
      );
    }

    const rolActual = String(
      actual.rol || ""
    )
      .trim()
      .toLowerCase();

    const rolObjetivo = String(
      objetivo.rol || ""
    )
      .trim()
      .toLowerCase();

    let autorizado = false;

    // ================================================
    // SUPERADMIN -> ADMINISTRADOR
    // ================================================

    if (
      rolActual === "super_admin" &&
      rolObjetivo === "administrador"
    ) {
      autorizado = true;
    }

    // ================================================
    // ADMINISTRADOR -> PERSONAL DE SU LABORATORIO
    // ================================================

    if (
      rolActual === "administrador" &&
      (
        rolObjetivo === "recepcionista" ||
        rolObjetivo === "bioquimico"
      ) &&
      typeof actual.laboratorioId === "string" &&
      actual.laboratorioId.trim() !== "" &&
      actual.laboratorioId ===
        objetivo.laboratorioId
    ) {
      autorizado = true;
    }

    if (!autorizado) {
      throw new HttpsError(
        "permission-denied",
        "No tienes permisos para cambiar esta contraseña."
      );
    }

    // ================================================
    // ACTUALIZAR CONTRASEÑA
    // ================================================

    try {
      await admin.auth().updateUser(
        uidObjetivo,
        {
          password: nuevaPassword,
        }
      );

      await admin.auth().revokeRefreshTokens(
        uidObjetivo
      );

      // ==============================================
      // REGISTRAR AUDITORÍA
      // ==============================================

      try {
        await db
          .collection("auditoria")
          .add({
            usuarioId: uidActual,

            usuarioObjetivoId: uidObjetivo,

            accion: "CAMBIO_PASSWORD",

            modulo:
              rolActual === "super_admin"
                ? "administradores"
                : "personal",

            laboratorioId:
              objetivo.laboratorioId || "",

            fecha:
              admin.firestore.FieldValue.serverTimestamp(),
          });
      } catch (error) {
        console.error(
          "Error registrando auditoría:",
          error
        );
      }

      return {
        ok: true,
        mensaje:
          "Contraseña cambiada correctamente.",
      };
    } catch (error) {
      console.error(
        "Error cambiando contraseña:",
        error
      );

      throw new HttpsError(
        "internal",
        "No se pudo cambiar la contraseña."
      );
    }
  }
);