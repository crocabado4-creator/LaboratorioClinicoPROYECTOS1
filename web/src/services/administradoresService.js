import { getFunctions, httpsCallable } from "firebase/functions";

import {
  deleteApp,
  getApp,
  initializeApp,
} from "firebase/app";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendEmailVerification,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

// =====================================================
// LIMPIAR TEXTO
// =====================================================

function limpiarTexto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

// =====================================================
// VALIDAR CONTRASEÑA
// =====================================================

export function passwordSeguro(password) {
  if (typeof password !== "string") {
    return false;
  }

  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

// =====================================================
// VALIDAR SUPER ADMIN
// =====================================================

async function validarSuperAdmin() {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    throw new Error("No existe una sesión autenticada.");
  }

  const usuarioRef = doc(db, "usuarios", firebaseUser.uid);
  const usuarioSnap = await getDoc(usuarioRef);

  if (!usuarioSnap.exists()) {
    throw new Error("El usuario autenticado no existe en el sistema.");
  }

  const datos = usuarioSnap.data();

  if (datos.activo !== true) {
    throw new Error("La cuenta autenticada se encuentra inactiva.");
  }

  if (datos.rol !== "super_admin") {
    throw new Error(
      "No tienes autorización para administrar estas cuentas."
    );
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || "",
  };
}

// =====================================================
// VALIDAR LABORATORIO
// =====================================================

async function validarLaboratorio(
  laboratorioId,
  permitirInactivo = false
) {
  if (
    typeof laboratorioId !== "string" ||
    laboratorioId.trim() === ""
  ) {
    throw new Error("Selecciona un laboratorio.");
  }

  const laboratorioRef = doc(db, "laboratorios", laboratorioId);
  const laboratorioSnap = await getDoc(laboratorioRef);

  if (!laboratorioSnap.exists()) {
    throw new Error("El laboratorio seleccionado no existe.");
  }

  const laboratorio = laboratorioSnap.data();

  if (!permitirInactivo && laboratorio.activo !== true) {
    throw new Error(
      "No se puede asignar un administrador a un laboratorio inactivo."
    );
  }

  return {
    id: laboratorioSnap.id,
    ...laboratorio,
  };
}

// =====================================================
// OBTENER ADMINISTRADORES
// =====================================================

export async function obtenerAdministradores() {
  await validarSuperAdmin();

  const consulta = query(
    collection(db, "usuarios"),
    where("rol", "==", "administrador")
  );

  const snapshot = await getDocs(consulta);

  const administradores = snapshot.docs.map((documento) => {
    const datos = documento.data();

    return {
      id: documento.id,
      uid: documento.id,
      nombre: limpiarTexto(datos.nombre),
      apellido: limpiarTexto(datos.apellido),
      email: limpiarTexto(datos.email),
      rol: "administrador",
      laboratorioId: limpiarTexto(datos.laboratorioId),
      activo: datos.activo === true,
      fechaRegistro: datos.fechaRegistro || null,
      requiereVerificacionEmail:
        datos.requiereVerificacionEmail === true,
    };
  });

  return administradores.sort((a, b) => {
    const nombreA = `${a.nombre} ${a.apellido}`.trim();
    const nombreB = `${b.nombre} ${b.apellido}`.trim();

    return nombreA.localeCompare(nombreB, "es");
  });
}

// =====================================================
// OBTENER LABORATORIOS
// =====================================================

export async function obtenerLaboratoriosAdministradores() {
  await validarSuperAdmin();

  const snapshot = await getDocs(
    collection(db, "laboratorios")
  );

  const laboratorios = snapshot.docs.map((documento) => {
    const datos = documento.data();

    return {
      id: documento.id,
      laboratorioId: datos.laboratorioId || documento.id,
      nombre: limpiarTexto(datos.nombre),
      nombreVisible: limpiarTexto(datos.nombreVisible),
      logoUrl: limpiarTexto(datos.logoUrl),
      colorPrimario: limpiarTexto(datos.colorPrimario),
      colorSecundario: limpiarTexto(datos.colorSecundario),
      direccion: limpiarTexto(datos.direccion),
      activo: datos.activo === true,
    };
  });

  return laboratorios.sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es")
  );
}

// =====================================================
// CREAR ADMINISTRADOR
// =====================================================

export async function crearAdministrador(datos) {
  await validarSuperAdmin();

  const nombre = limpiarTexto(datos?.nombre);
  const apellido = limpiarTexto(datos?.apellido);
  const email = limpiarTexto(datos?.email).toLowerCase();

  const password =
    typeof datos?.password === "string"
      ? datos.password
      : "";

  const laboratorioId = limpiarTexto(datos?.laboratorioId);

  const requiereVerificacionEmail =
    datos?.requiereVerificacionEmail === true;

  // VALIDACIONES

  if (!nombre) {
    throw new Error("Ingresa el nombre.");
  }

  if (!apellido) {
    throw new Error("Ingresa el apellido.");
  }

  if (!email) {
    throw new Error("Ingresa el correo electrónico.");
  }

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!correoValido.test(email)) {
    throw new Error("El correo electrónico no es válido.");
  }

  if (!passwordSeguro(password)) {
    throw new Error(
      "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial."
    );
  }

  // VALIDAR LABORATORIO

  await validarLaboratorio(laboratorioId);

  // VALIDAR CORREO

  const consultaEmail = query(
    collection(db, "usuarios"),
    where("email", "==", email)
  );

  const emailSnapshot = await getDocs(consultaEmail);

  if (!emailSnapshot.empty) {
    throw new Error(
      "Ya existe un usuario registrado con ese correo."
    );
  }

  // CREAR APLICACIÓN SECUNDARIA
  // EVITA CERRAR LA SESIÓN DEL SUPERADMIN

  const appPrincipal = getApp();

  const nombreAppSecundaria =
    `crear-administrador-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  let appSecundaria = null;
  let authSecundario = null;
  let usuarioCreado = null;

  try {
    appSecundaria = initializeApp(
      appPrincipal.options,
      nombreAppSecundaria
    );

    authSecundario = getAuth(appSecundaria);

    // CREAR CUENTA EN AUTHENTICATION

    const credencial = await createUserWithEmailAndPassword(
      authSecundario,
      email,
      password
    );

    usuarioCreado = credencial.user;

    // VERIFICACIÓN OPCIONAL

    if (requiereVerificacionEmail) {
      await sendEmailVerification(usuarioCreado);
    }

    // REGISTRAR EN FIRESTORE

    const administradorRef = doc(
      db,
      "usuarios",
      usuarioCreado.uid
    );

    await setDoc(administradorRef, {
      nombre,
      apellido,
      email,
      rol: "administrador",
      laboratorioId,
      activo: true,
      fechaRegistro: serverTimestamp(),
      requiereVerificacionEmail,
    });

    return {
      uid: usuarioCreado.uid,
      email,
      laboratorioId,
      verificacionEnviada: requiereVerificacionEmail,
    };

  } catch (error) {
    // REVERTIR CUENTA SI FALLÓ EL REGISTRO

    if (usuarioCreado) {
      try {
        await deleteUser(usuarioCreado);
      } catch (errorEliminar) {
        console.error(
          "No se pudo revertir la cuenta creada:",
          errorEliminar
        );
      }
    }

    if (error?.code === "auth/email-already-in-use") {
      throw new Error(
        "Ese correo ya está registrado en Firebase Authentication."
      );
    }

    if (error?.code === "auth/invalid-email") {
      throw new Error("El correo electrónico no es válido.");
    }

    if (error?.code === "auth/weak-password") {
      throw new Error(
        "La contraseña no cumple los requisitos de seguridad."
      );
    }

    if (error?.code === "auth/network-request-failed") {
      throw new Error(
        "No se pudo conectar con Firebase. Verifica tu conexión a Internet."
      );
    }

    if (error?.code === "permission-denied") {
      throw new Error(
        "No tienes permisos para registrar el administrador."
      );
    }

    throw error;

  } finally {
    if (authSecundario) {
      try {
        await signOut(authSecundario);
      } catch {
        // No afecta la sesión principal.
      }
    }

    if (appSecundaria) {
      try {
        await deleteApp(appSecundaria);
      } catch {
        // Aplicación temporal finalizada.
      }
    }
  }
}

// =====================================================
// ACTUALIZAR ADMINISTRADOR
// =====================================================

export async function actualizarAdministrador(
  administradorId,
  datos
) {
  await validarSuperAdmin();

  if (
    typeof administradorId !== "string" ||
    administradorId.trim() === ""
  ) {
    throw new Error("Administrador inválido.");
  }

  const nombre = limpiarTexto(datos?.nombre);
  const apellido = limpiarTexto(datos?.apellido);
  const laboratorioId = limpiarTexto(datos?.laboratorioId);

  if (!nombre) {
    throw new Error("Ingresa el nombre.");
  }

  if (!apellido) {
    throw new Error("Ingresa el apellido.");
  }

  await validarLaboratorio(laboratorioId);

  const administradorRef = doc(
    db,
    "usuarios",
    administradorId
  );

  const administradorSnap = await getDoc(administradorRef);

  if (!administradorSnap.exists()) {
    throw new Error("El administrador no existe.");
  }

  if (administradorSnap.data().rol !== "administrador") {
    throw new Error(
      "La cuenta seleccionada no corresponde a un Administrador."
    );
  }

  await updateDoc(administradorRef, {
    nombre,
    apellido,
    laboratorioId,
  });

  return true;
}

// =====================================================
// ACTIVAR / DESACTIVAR ADMINISTRADOR
// =====================================================

export async function cambiarEstadoAdministrador(
  administradorId,
  nuevoEstado
) {
  await validarSuperAdmin();

  if (
    typeof administradorId !== "string" ||
    administradorId.trim() === ""
  ) {
    throw new Error("Administrador inválido.");
  }

  if (typeof nuevoEstado !== "boolean") {
    throw new Error("Estado inválido.");
  }

  const administradorRef = doc(
    db,
    "usuarios",
    administradorId
  );

  const administradorSnap = await getDoc(administradorRef);

  if (!administradorSnap.exists()) {
    throw new Error("El administrador no existe.");
  }

  const datos = administradorSnap.data();

  if (datos.rol !== "administrador") {
    throw new Error(
      "La cuenta seleccionada no corresponde a un Administrador."
    );
  }

  if (nuevoEstado === true) {
    await validarLaboratorio(datos.laboratorioId);
  }

  await updateDoc(administradorRef, {
    activo: nuevoEstado,
  });

  return true;
}

// =====================================================
// RESTABLECER CONTRASEÑA
// SUPERADMIN ESTABLECE UNA NUEVA CONTRASEÑA
// =====================================================

export async function restablecerPasswordUsuario(usuarioId, nuevaPassword) {
  if (!auth.currentUser) {
    throw new Error("Debes iniciar sesión.");
  }

  const token = await auth.currentUser.getIdToken();

  let respuesta;

  try {
    respuesta = await fetch("http://localhost:3001/cambiar-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        usuarioId,
        nuevaPassword
      })
    });
  } catch {
    throw new Error("No se pudo conectar con el backend. Verifica que esté encendido.");
  }

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(datos.error || "No se pudo cambiar la contraseña.");
  }

  return datos;
}