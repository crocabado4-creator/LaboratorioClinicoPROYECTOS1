import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";

function Dashboard({ usuario, onLogout }) {
  const cerrarSesion = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("usuario");
      onLogout();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <div>
      <h1>Laboratorio Clínico</h1>

      <h2>Dashboard</h2>

      <p>
        Bienvenido: {usuario.nombre} {usuario.apellido}
      </p>

      <p>
        Correo: {usuario.email}
      </p>

      <p>
        Rol: {usuario.rol}
      </p>

      <p>
        Laboratorio: {usuario.laboratorioId}
      </p>

      <button onClick={cerrarSesion}>
        Cerrar sesión
      </button>
    </div>
  );
}

export default Dashboard;