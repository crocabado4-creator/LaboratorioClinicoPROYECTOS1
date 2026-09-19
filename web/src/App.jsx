import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "./firebase/firebase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const verificarSesion = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!firebaseUser) {
          setUsuario(null);
          localStorage.removeItem("usuario");
          setCargando(false);
          return;
        }

        try {
          const usuarioRef = doc(
            db,
            "usuarios",
            firebaseUser.uid
          );

          const usuarioSnap = await getDoc(usuarioRef);

          if (!usuarioSnap.exists()) {
            await signOut(auth);

            setUsuario(null);
            localStorage.removeItem("usuario");
            setCargando(false);

            return;
          }

          const datos = {
            id: usuarioSnap.id,
            ...usuarioSnap.data(),
          };

          if (datos.activo !== true) {
            await signOut(auth);

            setUsuario(null);
            localStorage.removeItem("usuario");
            setCargando(false);

            return;
          }

          const datosUsuario = {
            id: datos.id,
            nombre: datos.nombre,
            apellido: datos.apellido,
            email: datos.email,
            rol: datos.rol,
            laboratorioId: datos.laboratorioId,
          };

          setUsuario(datosUsuario);

          localStorage.setItem(
            "usuario",
            JSON.stringify(datosUsuario)
          );

        } catch (error) {
          console.error(
            "Error al recuperar la sesión:",
            error
          );

          setUsuario(null);
        }

        setCargando(false);
      }
    );

    return () => verificarSesion();
  }, []);

  const iniciarSesion = (datosUsuario) => {
    setUsuario(datosUsuario);
  };

  const cerrarSesion = () => {
    setUsuario(null);
  };

  if (cargando) {
    return <p>Cargando...</p>;
  }

  if (!usuario) {
    return (
      <Login
        onLogin={iniciarSesion}
      />
    );
  }

  return (
    <Dashboard
      usuario={usuario}
      onLogout={cerrarSesion}
    />
  );
}

export default App;