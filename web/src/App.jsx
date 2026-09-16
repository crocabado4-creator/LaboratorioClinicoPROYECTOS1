import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "./firebase/firebase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const verificarSesion = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUsuario(null);
        localStorage.removeItem("usuario");
        setCargando(false);
        return;
      }

      try {
        const consulta = query(
          collection(db, "usuarios"),
          where("email", "==", firebaseUser.email)
        );

        const resultado = await getDocs(consulta);

        if (resultado.empty) {
          await signOut(auth);
          setUsuario(null);
          setCargando(false);
          return;
        }

        const documento = resultado.docs[0];

        const datos = {
          id: documento.id,
          ...documento.data(),
        };

        if (datos.activo !== true) {
          await signOut(auth);
          setUsuario(null);
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
        console.error("Error al recuperar la sesión:", error);
        setUsuario(null);
      }

      setCargando(false);
    });

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
    return <Login onLogin={iniciarSesion} />;
  }

  return (
    <Dashboard
      usuario={usuario}
      onLogout={cerrarSesion}
    />
  );
}

export default App;