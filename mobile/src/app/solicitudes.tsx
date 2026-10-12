import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { router } from "expo-router";

import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  doc,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { db } from "../firebase/firebase";

import BuscadorPacientes, {
  PacienteBuscador,
} from "../components/BuscadorPacientes";

import { generarPDFAnalisis } from "../services/pdfService";

type Paciente = PacienteBuscador & {
  laboratorioId?: string;
};

type Analisis = {
  id: string;
  analisisId?: string;
  nombre: string;
  tipo?: string;
  precio: number;
  activo?: boolean;
  laboratorioId?: string;
};

type AnalisisSeleccionado = {
  analisisId: string;
  nombre: string;
  tipo: string;
  precio: number;
  cantidad: number;
};

type Solicitud = {
  id: string;
  solicitudId?: string;
  pacienteId: string;
  laboratorioId: string;
  estado: string;
  total: number;
  analisis: AnalisisSeleccionado[];
  fecha?: any;
};

export default function SolicitudesScreen() {
  const [laboratorioId, setLaboratorioId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [analisis, setAnalisis] = useState<Analisis[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);

  const [pacienteId, setPacienteId] = useState("");
  const [busquedaAnalisis, setBusquedaAnalisis] = useState("");

  const [seleccionados, setSeleccionados] = useState<
    AnalisisSeleccionado[]
  >([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarInformacion();
  }, []);

  async function cargarInformacion() {
    try {
      setCargando(true);
      setError("");

      const usuario = getAuth().currentUser;

      if (!usuario) {
        setError("Debes iniciar sesión.");
        return;
      }

      setUsuarioId(usuario.uid);

      const usuarioRef = doc(db, "usuarios", usuario.uid);
      const usuarioSnap = await getDoc(usuarioRef);

      if (!usuarioSnap.exists()) {
        setError("No existe tu usuario en Firestore.");
        return;
      }

      const datosUsuario = usuarioSnap.data();

      if (datosUsuario.activo !== true) {
        setError("Tu usuario está inactivo.");
        return;
      }

      const idLaboratorio = String(
        datosUsuario.laboratorioId || ""
      );

      if (!idLaboratorio) {
        setError("Tu usuario no tiene un laboratorio asignado.");
        return;
      }

      setLaboratorioId(idLaboratorio);

      await cargarDatosLaboratorio(idLaboratorio);
    } catch (e: any) {
      console.error("Error cargando solicitudes:", e);

      setError(
        e?.message || "No se pudo cargar la información."
      );
    } finally {
      setCargando(false);
    }
  }

  async function cargarDatosLaboratorio(idLaboratorio: string) {
    const pacientesQuery = query(
      collection(db, "pacientes"),
      where("laboratorioId", "==", idLaboratorio)
    );

    const analisisQuery = query(
      collection(db, "analisis"),
      where("laboratorioId", "==", idLaboratorio)
    );

    const solicitudesQuery = query(
      collection(db, "solicitudes"),
      where("laboratorioId", "==", idLaboratorio)
    );

    const [
      pacientesSnap,
      analisisSnap,
      solicitudesSnap,
    ] = await Promise.all([
      getDocs(pacientesQuery),
      getDocs(analisisQuery),
      getDocs(solicitudesQuery),
    ]);

    const listaPacientes: Paciente[] =
      pacientesSnap.docs.map((documento) => ({
        ...documento.data(),
        id: documento.id,
      }));

    const listaAnalisis: Analisis[] =
      analisisSnap.docs.map((documento) => {
        const datos = documento.data();

        return {
          ...datos,
          id: documento.id,
          nombre: String(datos.nombre || ""),
          tipo: String(datos.tipo || ""),
          precio: Number(datos.precio || 0),
          activo: datos.activo,
        };
      });

    const listaSolicitudes: Solicitud[] =
      solicitudesSnap.docs.map((documento) => {
        const datos = documento.data();

        return {
          ...datos,
          id: documento.id,
          pacienteId: String(datos.pacienteId || ""),
          laboratorioId: String(datos.laboratorioId || ""),
          estado: String(datos.estado || "pendiente"),
          total: Number(datos.total || 0),
          analisis: Array.isArray(datos.analisis)
            ? datos.analisis
            : [],
        };
      });

    setPacientes(listaPacientes);

    setAnalisis(
      listaAnalisis.filter(
        (item) => item.activo !== false
      )
    );

    setSolicitudes(listaSolicitudes);
  }

  const analisisFiltrados = useMemo(() => {
    const texto = busquedaAnalisis
      .toLowerCase()
      .trim();

    if (!texto) {
      return analisis;
    }

    return analisis.filter((item) => {
      const nombre = String(item.nombre || "")
        .toLowerCase();

      const tipo = String(item.tipo || "")
        .toLowerCase();

      return (
        nombre.includes(texto) ||
        tipo.includes(texto)
      );
    });
  }, [analisis, busquedaAnalisis]);

  const total = useMemo(() => {
    return seleccionados.reduce(
      (suma, item) =>
        suma + item.precio * item.cantidad,
      0
    );
  }, [seleccionados]);

  function agregarAnalisis(item: Analisis) {
    const id = item.analisisId || item.id;

    const existe = seleccionados.some(
      (seleccionado) =>
        seleccionado.analisisId === id
    );

    if (existe) {
      Alert.alert(
        "Aviso",
        "Este análisis ya está seleccionado."
      );
      return;
    }

    setSeleccionados((actuales) => [
      ...actuales,
      {
        analisisId: id,
        nombre: item.nombre,
        tipo: item.tipo || "",
        precio: Number(item.precio || 0),
        cantidad: 1,
      },
    ]);

    Keyboard.dismiss();
  }

  function quitarAnalisis(id: string) {
    setSeleccionados((actuales) =>
      actuales.filter(
        (item) => item.analisisId !== id
      )
    );
  }

  function obtenerPaciente(id: string) {
    return pacientes.find(
      (item) =>
        String(item.pacienteId || item.id) ===
        String(id)
    );
  }

  function obtenerNombrePaciente(id: string) {
    const paciente = obtenerPaciente(id);

    if (!paciente) {
      return "Paciente no encontrado";
    }

    return `${paciente.nombres || ""} ${
      paciente.apellidos || ""
    }`.trim();
  }

  async function registrarSolicitud() {
    if (!pacienteId) {
      Alert.alert(
        "Aviso",
        "Selecciona un paciente."
      );
      return;
    }

    if (seleccionados.length === 0) {
      Alert.alert(
        "Aviso",
        "Selecciona al menos un análisis."
      );
      return;
    }

    if (!laboratorioId || !usuarioId) {
      Alert.alert(
        "Error",
        "No se identificó el laboratorio o usuario."
      );
      return;
    }

    try {
      setGuardando(true);

      const datosSolicitud = {
        laboratorioId,
        pacienteId,
        empleadoId: usuarioId,
        usuarioId,
        analisis: seleccionados,
        total,
        estado: "pendiente",
        fecha: serverTimestamp(),
        fechaCreacion: serverTimestamp(),
      };

      const referencia = await addDoc(
        collection(db, "solicitudes"),
        datosSolicitud
      );

      Alert.alert(
        "Correcto",
        `Solicitud registrada.\nCódigo: ${referencia.id}`
      );

      setPacienteId("");
      setSeleccionados([]);
      setBusquedaAnalisis("");

      await cargarDatosLaboratorio(laboratorioId);
    } catch (e: any) {
      console.error("Error registrando solicitud:", e);

      Alert.alert(
        "Error",
        e?.message || "No se pudo registrar la solicitud."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function imprimirSolicitud(solicitud: Solicitud) {
    try {
      const paciente = obtenerPaciente(
        solicitud.pacienteId
      );

      await generarPDFAnalisis({
        codigo: solicitud.solicitudId || solicitud.id,
        laboratorio: "Laboratorio Clínico",
        paciente: obtenerNombrePaciente(
          solicitud.pacienteId
        ),
        ci: paciente?.ci || "",
        estado: solicitud.estado,
        analisis: solicitud.analisis,
      });
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.message || "No se pudo generar el PDF."
      );
    }
  }

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color="#0F766E"
        />

        <Text style={styles.cargando}>
          Cargando solicitudes...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.error}>
          {error}
        </Text>

        <TouchableOpacity
          style={styles.boton}
          onPress={cargarInformacion}
        >
          <Text style={styles.botonTexto}>
            Reintentar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={styles.contenido}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.encabezado}>
        <TouchableOpacity
          onPress={() => router.back()}
        >
          <Text style={styles.volver}>
            ← Volver
          </Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>
          Solicitudes de análisis
        </Text>

        <Text style={styles.subtitulo}>
          Registra solicitudes y busca pacientes
          por nombre, apellido o carnet.
        </Text>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.seccionTitulo}>
          1. Seleccionar paciente
        </Text>

        <BuscadorPacientes
          pacientes={pacientes}
          pacienteId={pacienteId}
          onSeleccionar={setPacienteId}
        />
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.seccionTitulo}>
          2. Seleccionar análisis
        </Text>

        <TextInput
          style={styles.input}
          value={busquedaAnalisis}
          onChangeText={setBusquedaAnalisis}
          placeholder="Buscar análisis por nombre o tipo..."
          placeholderTextColor="#94A3B8"
        />

        {analisisFiltrados.length === 0 ? (
          <Text style={styles.vacio}>
            No se encontraron análisis.
          </Text>
        ) : (
          <View>
            {analisisFiltrados.map((item) => (
              <View
                key={item.id}
                style={styles.fila}
              >
                <View style={styles.datos}>
                  <Text style={styles.nombre}>
                    {item.nombre}
                  </Text>

                  <Text style={styles.descripcion}>
                    {item.tipo || "Sin tipo"}
                  </Text>

                  <Text style={styles.precio}>
                    Bs {item.precio.toFixed(2)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.botonAgregar}
                  onPress={() =>
                    agregarAnalisis(item)
                  }
                >
                  <Text style={styles.botonTexto}>
                    + Agregar
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.seccionTitulo}>
          3. Detalle de solicitud
        </Text>

        {seleccionados.length === 0 ? (
          <Text style={styles.vacio}>
            Todavía no seleccionaste análisis.
          </Text>
        ) : (
          seleccionados.map((item) => (
            <View
              key={item.analisisId}
              style={styles.fila}
            >
              <View style={styles.datos}>
                <Text style={styles.nombre}>
                  {item.nombre}
                </Text>

                <Text style={styles.precio}>
                  Bs {item.precio.toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.botonQuitar}
                onPress={() =>
                  quitarAnalisis(item.analisisId)
                }
              >
                <Text style={styles.botonTexto}>
                  Quitar
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={styles.total}>
          Total: Bs {total.toFixed(2)}
        </Text>

        <TouchableOpacity
          style={[
            styles.boton,
            guardando && styles.botonDeshabilitado,
          ]}
          disabled={guardando}
          onPress={registrarSolicitud}
        >
          {guardando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.botonTexto}>
              Registrar solicitud
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tarjeta}>
        <View style={styles.filaTitulo}>
          <Text style={styles.seccionTitulo}>
            Solicitudes registradas
          </Text>

          <TouchableOpacity
            onPress={() =>
              cargarDatosLaboratorio(
                laboratorioId
              ).catch((e) =>
                Alert.alert(
                  "Error",
                  e?.message ||
                    "No se pudo actualizar."
                )
              )
            }
          >
            <Text style={styles.actualizar}>
              Actualizar
            </Text>
          </TouchableOpacity>
        </View>

        {solicitudes.length === 0 ? (
          <Text style={styles.vacio}>
            No hay solicitudes registradas.
          </Text>
        ) : (
          solicitudes.map((solicitud) => (
            <View
              key={solicitud.id}
              style={styles.solicitud}
            >
              <Text style={styles.codigo}>
                Solicitud: {solicitud.solicitudId || solicitud.id}
              </Text>

              <Text style={styles.nombre}>
                {obtenerNombrePaciente(
                  solicitud.pacienteId
                )}
              </Text>

              <Text style={styles.descripcion}>
                Estado: {solicitud.estado}
              </Text>

              <Text style={styles.precio}>
                Total: Bs {solicitud.total.toFixed(2)}
              </Text>

              <TouchableOpacity
                style={styles.botonPDF}
                onPress={() =>
                  imprimirSolicitud(solicitud)
                }
              >
                <Text style={styles.botonTexto}>
                  Generar PDF de análisis
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  contenido: {
    padding: 16,
    paddingBottom: 40,
  },
  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 20,
  },
  cargando: {
    marginTop: 12,
    color: "#475569",
  },
  error: {
    color: "#DC2626",
    textAlign: "center",
    marginBottom: 20,
  },
  encabezado: {
    backgroundColor: "#0F766E",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  volver: {
    color: "#CCFBF1",
    fontWeight: "700",
    marginBottom: 15,
  },
  titulo: {
    fontSize: 23,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitulo: {
    color: "#CCFBF1",
    marginTop: 8,
    lineHeight: 20,
  },
  tarjeta: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  seccionTitulo: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    color: "#0F172A",
  },
  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  datos: {
    flex: 1,
    marginRight: 10,
  },
  nombre: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  descripcion: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 4,
  },
  precio: {
    color: "#0F766E",
    fontWeight: "700",
    marginTop: 5,
  },
  boton: {
    backgroundColor: "#0F766E",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 15,
  },
  botonAgregar: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    padding: 10,
  },
  botonQuitar: {
    backgroundColor: "#DC2626",
    borderRadius: 8,
    padding: 10,
  },
  botonPDF: {
    backgroundColor: "#475569",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
  },
  botonTexto: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  botonDeshabilitado: {
    opacity: 0.6,
  },
  total: {
    textAlign: "right",
    fontSize: 20,
    fontWeight: "800",
    color: "#0F766E",
    marginTop: 20,
  },
  vacio: {
    color: "#64748B",
    textAlign: "center",
    padding: 16,
  },
  filaTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actualizar: {
    color: "#2563EB",
    fontWeight: "700",
  },
  solicitud: {
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  codigo: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 8,
  },
});