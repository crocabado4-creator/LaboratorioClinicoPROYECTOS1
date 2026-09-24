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
  // =====================================================
  // USUARIO DEL SISTEMA
  // =====================================================

  const [
    usuario,
    setUsuario,
  ] = useState(null);


  // =====================================================
  // CARGA GENERAL
  // =====================================================

  const [
    cargando,
    setCargando,
  ] = useState(true);


  // =====================================================
  // MENSAJES DE ACCESO
  // =====================================================

  const [
    mensajeAcceso,
    setMensajeAcceso,
  ] = useState("");


  // =====================================================
  // ROLES VÁLIDOS
  // =====================================================

  const rolesValidos = [
    "super_admin",
    "administrador",
    "recepcionista",
    "bioquimico",
  ];


  // =====================================================
  // HU-01 + HU-03
  // CONTROL PERMANENTE DE SESIÓN
  // =====================================================

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          try {
            setCargando(
              true
            );


            // =============================================
            // NO HAY SESIÓN
            // =============================================

            if (
              !firebaseUser
            ) {
              setUsuario(
                null
              );

              return;
            }


            // =============================================
            // BUSCAR PERFIL EN FIRESTORE
            // usuarios/{UID}
            // =============================================

            const usuarioRef =
              doc(
                db,
                "usuarios",
                firebaseUser.uid
              );


            const usuarioSnap =
              await getDoc(
                usuarioRef
              );


            // =============================================
            // PERFIL NO EXISTE
            // =============================================

            if (
              !usuarioSnap.exists()
            ) {
              setUsuario(
                null
              );

              setMensajeAcceso(
                "La cuenta autenticada no tiene un perfil registrado en el sistema."
              );


              await signOut(
                auth
              );

              return;
            }


            const datos =
              usuarioSnap.data();


            // =============================================
            // USUARIO INACTIVO
            // =============================================

            if (
              datos.activo !==
              true
            ) {
              setUsuario(
                null
              );

              setMensajeAcceso(
                "Su cuenta se encuentra inactiva. Contacte al administrador correspondiente."
              );


              await signOut(
                auth
              );

              return;
            }


            // =============================================
            // VALIDAR ROL
            // =============================================

            const rol =
              typeof datos.rol ===
              "string"
                ? datos.rol
                : "";


            if (
              !rolesValidos.includes(
                rol
              )
            ) {
              setUsuario(
                null
              );

              setMensajeAcceso(
                "La cuenta no tiene un rol válido para acceder al sistema."
              );


              await signOut(
                auth
              );

              return;
            }


            // =============================================
            // VERIFICACIÓN DE CORREO
            // HU-01
            // =============================================

            if (
              datos.requiereVerificacionEmail ===
                true &&
              firebaseUser.emailVerified !==
                true
            ) {
              setUsuario(
                null
              );

              setMensajeAcceso(
                "Debe verificar su correo electrónico antes de ingresar."
              );


              await signOut(
                auth
              );

              return;
            }


            // =============================================
            // CREAR OBJETO DE SESIÓN
            // =============================================

            const usuarioSistema = {
              id:
                usuarioSnap.id,

              uid:
                usuarioSnap.id,

              nombre:
                typeof datos.nombre ===
                "string"
                  ? datos.nombre
                  : "",

              apellido:
                typeof datos.apellido ===
                "string"
                  ? datos.apellido
                  : "",

              email:
                typeof datos.email ===
                  "string" &&
                datos.email !== ""
                  ? datos.email
                  : firebaseUser.email ||
                    "",

              rol:
                rol,

              laboratorioId:
                typeof datos.laboratorioId ===
                "string"
                  ? datos.laboratorioId
                  : "",

              activo:
                datos.activo ===
                true,
            };


            // =============================================
            // MANTENER IDENTIFICADO AL USUARIO
            // HU-03
            // =============================================

            setUsuario(
              usuarioSistema
            );


            setMensajeAcceso(
              ""
            );

          } catch (error) {
            console.error(
              "Error al validar sesión:",
              error
            );


            setUsuario(
              null
            );


            setMensajeAcceso(
              "No se pudo validar la sesión."
            );


            try {
              await signOut(
                auth
              );

            } catch (
              errorCerrar
            ) {
              console.error(
                "Error al cerrar sesión inválida:",
                errorCerrar
              );
            }

          } finally {
            setCargando(
              false
            );
          }
        }
      );


    return () => {
      unsubscribe();
    };

  }, []);


  // =====================================================
  // CARGANDO SESIÓN
  // =====================================================

  if (
    cargando
  ) {
    return (
      <main
        style={{
          minHeight:
            "100vh",

          display:
            "grid",

          placeItems:
            "center",

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

            padding:
              "40px",

            borderRadius:
              "24px",

            background:
              "rgba(255,255,255,0.97)",

            textAlign:
              "center",

            boxShadow:
              "0 25px 70px rgba(0,0,0,.25)",
          }}
        >

          <div
            style={{
              width:
                "70px",

              height:
                "70px",

              display:
                "grid",

              placeItems:
                "center",

              margin:
                "0 auto 18px",

              borderRadius:
                "20px",

              background:
                "linear-gradient(135deg, #2563eb, #0ea5e9)",

              color:
                "white",

              fontSize:
                "34px",
            }}
          >
            🧪
          </div>


          <h2
            style={{
              margin:
                "0 0 7px",

              color:
                "#0f172a",
            }}
          >
            Laboratorio Clínico
          </h2>


          <p
            style={{
              margin:
                0,

              color:
                "#64748b",
            }}
          >
            Verificando sesión...
          </p>

        </div>

      </main>
    );
  }


  // =====================================================
  // ÁREA NO AUTENTICADA
  // =====================================================

  if (
    !usuario
  ) {
    return (
      <Login
        mensajeExterno={
          mensajeAcceso
        }
        onLimpiarMensaje={() =>
          setMensajeAcceso(
            ""
          )
        }
      />
    );
  }


  // =====================================================
  // ÁREA PROTEGIDA
  // =====================================================

  return (
    <Dashboard
      usuario={
        usuario
      }
      onLogout={() => {
        // ===============================================
        // Al cerrar sesión eliminamos inmediatamente
        // el usuario del estado de la aplicación.
        // ===============================================

        setUsuario(
          null
        );

        setMensajeAcceso(
          ""
        );
      }}
    />
  );
}


export default App;