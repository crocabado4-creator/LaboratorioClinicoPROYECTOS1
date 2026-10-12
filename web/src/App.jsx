import {
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "./firebase/firebase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";


function App() {
  const [usuario, setUsuario] =
    useState(null);

  const [cargando, setCargando] =
    useState(true);

  const [
    mensajeAcceso,
    setMensajeAcceso,
  ] = useState("");


  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          setCargando(true);

          try {
            // ==========================================
            // NO HAY SESIÓN
            // ==========================================

            if (!firebaseUser) {
              setUsuario(null);
              return;
            }


            // ==========================================
            // BUSCAR USUARIO EN FIRESTORE
            // ==========================================

            const usuarioRef = doc(
              db,
              "usuarios",
              firebaseUser.uid
            );

            const usuarioSnap =
              await getDoc(usuarioRef);


            // ==========================================
            // EL USUARIO DEBE EXISTIR EN FIRESTORE
            // ==========================================

            if (!usuarioSnap.exists()) {
              setUsuario(null);

              setMensajeAcceso(
                "El usuario no está registrado en el sistema."
              );

              await signOut(auth);

              return;
            }


            const datos =
              usuarioSnap.data();


            // ==========================================
            // VALIDAR ESTADO
            // ==========================================

            if (datos.activo !== true) {
              setUsuario(null);

              setMensajeAcceso(
                "La cuenta está desactivada."
              );

              await signOut(auth);

              return;
            }


            // ==========================================
            // NORMALIZAR ROL
            // ==========================================

            const rol =
              String(
                datos.rol || ""
              )
                .trim()
                .toLowerCase();


            const rolesValidos = [
              "super_admin",
              "administrador",
              "recepcionista",
              "bioquimico",
            ];


            if (
              !rolesValidos.includes(
                rol
              )
            ) {
              setUsuario(null);

              setMensajeAcceso(
                "El usuario no tiene un rol válido."
              );

              await signOut(auth);

              return;
            }


            // ==========================================
            // SESIÓN CORRECTA
            //
            // NO bloqueamos por emailVerified.
            // Firebase Authentication ya validó
            // correo + contraseña.
            // ==========================================

            const usuarioSistema = {
              id:
                usuarioSnap.id,

              uid:
                firebaseUser.uid,

              nombre:
                String(
                  datos.nombre || ""
                ).trim(),

              apellido:
                String(
                  datos.apellido || ""
                ).trim(),

              email:
                String(
                  datos.email ||
                  firebaseUser.email ||
                  ""
                )
                  .trim()
                  .toLowerCase(),

              rol,

              laboratorioId:
                String(
                  datos.laboratorioId ||
                  ""
                ).trim(),

              activo: true,
            };


            setUsuario(
              usuarioSistema
            );

            setMensajeAcceso("");

          } catch (error) {
            console.error(
              "ERROR DE LOGIN:",
              error
            );

            setUsuario(null);

            setMensajeAcceso(
              error?.message ||
              "No se pudo validar la sesión."
            );

          } finally {
            setCargando(false);
          }
        }
      );


    return () => {
      unsubscribe();
    };
  }, []);


  // ==============================================
  // CARGANDO
  // ==============================================

  if (cargando) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "linear-gradient(135deg, #0f172a 0%, #172554 45%, #2563eb 100%)",
          fontFamily:
            "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            width:
              "min(420px, 90%)",
            padding: "40px",
            borderRadius: "24px",
            background:
              "rgba(255,255,255,0.97)",
            textAlign: "center",
            boxShadow:
              "0 25px 70px rgba(0,0,0,.25)",
          }}
        >
          <div
            style={{
              width: "70px",
              height: "70px",
              display: "grid",
              placeItems: "center",
              margin:
                "0 auto 18px",
              borderRadius: "20px",
              background:
                "linear-gradient(135deg, #2563eb, #0ea5e9)",
              color: "white",
              fontSize: "34px",
            }}
          >
            🧪
          </div>

          <h2
            style={{
              margin:
                "0 0 7px",
              color: "#0f172a",
            }}
          >
            Laboratorio Clínico
          </h2>

          <p
            style={{
              margin: 0,
              color: "#64748b",
            }}
          >
            Verificando sesión...
          </p>
        </div>
      </main>
    );
  }


  // ==============================================
  // LOGIN
  // ==============================================

  if (!usuario) {
    return (
      <Login
        mensajeExterno={
          mensajeAcceso
        }
        onLimpiarMensaje={() =>
          setMensajeAcceso("")
        }
      />
    );
  }


  // ==============================================
  // DASHBOARD
  // ==============================================

  return (
    <Dashboard
      usuario={usuario}
      onLogout={async () => {
        try {
          await signOut(auth);
        } finally {
          setUsuario(null);
          setMensajeAcceso("");
        }
      }}
    />
  );
}


export default App;