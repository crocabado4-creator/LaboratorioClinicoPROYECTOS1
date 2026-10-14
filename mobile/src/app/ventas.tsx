import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  useRouter,
} from "expo-router";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  obtenerPacientes,
  type Paciente,
} from "../services/pacientesService";

import {
  obtenerSolicitudes,
  type Solicitud,
} from "../services/solicitudesService";

import {
  obtenerOrdenPorId,
  obtenerVentas,
  registrarVentaYGenerarOrden,
  type Orden,
  type Venta,
} from "../services/ventasService";


type UsuarioActual = {
  id: string;
  rol: string;
  laboratorioId: string;
};


function fechaDate(
  valor: unknown
): Date | null {

  if (
    !valor ||
    typeof valor !==
      "object"
  ) {
    return null;
  }


  const fecha =
    valor as {
      toDate?: () => Date;
      seconds?: number;
    };


  if (
    typeof fecha.toDate ===
    "function"
  ) {
    return fecha.toDate();
  }


  if (
    typeof fecha.seconds ===
    "number"
  ) {
    return new Date(
      fecha.seconds *
        1000
    );
  }


  return null;
}


function fechaTexto(
  valor: unknown
): string {

  const fecha =
    fechaDate(
      valor
    );


  if (!fecha) {
    return "Sin fecha";
  }


  return fecha.toLocaleString(
    "es-BO"
  );
}


function fechaInput(
  valor: unknown
): string {

  const fecha =
    fechaDate(
      valor
    );


  if (!fecha) {
    return "";
  }


  const año =
    fecha.getFullYear();

  const mes =
    String(
      fecha.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const dia =
    String(
      fecha.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${año}-${mes}-${dia}`;
}


export default function Ventas() {

  const router =
    useRouter();


  const [
    usuario,
    setUsuario,
  ] =
    useState<UsuarioActual | null>(
      null
    );


  const [
    pacientes,
    setPacientes,
  ] =
    useState<Paciente[]>([]);


  const [
    solicitudes,
    setSolicitudes,
  ] =
    useState<Solicitud[]>([]);


  const [
    ventas,
    setVentas,
  ] =
    useState<Venta[]>([]);


  const [
    solicitudId,
    setSolicitudId,
  ] =
    useState("");


  const [
    metodoPago,
    setMetodoPago,
  ] =
    useState(
      "efectivo"
    );


  const [
    fechaDesde,
    setFechaDesde,
  ] =
    useState("");


  const [
    fechaHasta,
    setFechaHasta,
  ] =
    useState("");


  const [
    pacienteFiltro,
    setPacienteFiltro,
  ] =
    useState("");


  const [
    usuarioFiltro,
    setUsuarioFiltro,
  ] =
    useState("");


  const [
    detalleVenta,
    setDetalleVenta,
  ] =
    useState<Venta | null>(
      null
    );


  const [
    detalleOrden,
    setDetalleOrden,
  ] =
    useState<Orden | null>(
      null
    );


  const [
    cargando,
    setCargando,
  ] =
    useState(true);


  const [
    guardando,
    setGuardando,
  ] =
    useState(false);


  const cargar =
    async () => {
      try {
        setCargando(true);


        const firebaseUser =
          auth.currentUser;


        if (!firebaseUser) {
          router.replace("/");
          return;
        }


        const usuarioSnap =
          await getDoc(
            doc(
              db,
              "usuarios",
              firebaseUser.uid
            )
          );


        if (
          !usuarioSnap.exists()
        ) {
          Alert.alert(
            "Error",
            "No se encontró el usuario."
          );

          return;
        }


        const datos =
          usuarioSnap.data();


        const actual:
          UsuarioActual = {
          id:
            firebaseUser.uid,

          rol:
            String(
              datos.rol || ""
            ),

          laboratorioId:
            String(
              datos.laboratorioId ||
                ""
            ),
        };


        if (
          actual.rol !==
            "recepcionista" &&
          actual.rol !==
            "administrador"
        ) {
          Alert.alert(
            "Acceso restringido",
            "No tienes acceso al módulo de ventas."
          );

          router.back();
          return;
        }


        setUsuario(
          actual
        );


        const [
          listaPacientes,
          listaSolicitudes,
          listaVentas,
        ] =
          await Promise.all([
            obtenerPacientes(
              actual.laboratorioId
            ),

            obtenerSolicitudes(
              actual.laboratorioId
            ),

            obtenerVentas(
              actual.laboratorioId
            ),
          ]);


        setPacientes(
          listaPacientes
        );

        setSolicitudes(
          listaSolicitudes
        );

        setVentas(
          listaVentas
        );

      } catch (error) {
        console.error(
          error
        );

        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las ventas."
        );

      } finally {
        setCargando(false);
      }
    };


  useEffect(() => {
    cargar();
  }, []);


  const solicitudesPendientes =
    useMemo(
      () =>
        solicitudes.filter(
          (item) =>
            !item.ventaId &&
            !item.ordenId &&
            item.estado
              .toLowerCase() !==
              "pagada"
        ),
      [
        solicitudes,
      ]
    );


  const solicitudSeleccionada =
    useMemo(
      () =>
        solicitudes.find(
          (item) =>
            item.id ===
              solicitudId ||
            item.solicitudId ===
              solicitudId
        ) || null,
      [
        solicitudes,
        solicitudId,
      ]
    );


  const nombrePaciente =
    (
      pacienteId: string
    ) => {

      const paciente =
        pacientes.find(
          (item) =>
            item.id ===
              pacienteId ||
            item.pacienteId ===
              pacienteId
        );


      if (!paciente) {
        return pacienteId;
      }


      return `${paciente.nombres} ${paciente.apellidos}`;
    };


  const ventasFiltradas =
    useMemo(
      () =>
        ventas.filter(
          (venta) => {

            const fecha =
              fechaInput(
                venta.fecha
              );


            if (
              fechaDesde &&
              fecha <
                fechaDesde
            ) {
              return false;
            }


            if (
              fechaHasta &&
              fecha >
                fechaHasta
            ) {
              return false;
            }


            if (
              pacienteFiltro &&
              venta.pacienteId !==
                pacienteFiltro
            ) {
              return false;
            }


            if (
              usuarioFiltro &&
              !venta.empleadoId
                .toLowerCase()
                .includes(
                  usuarioFiltro
                    .trim()
                    .toLowerCase()
                )
            ) {
              return false;
            }


            return true;
          }
        ),
      [
        ventas,
        fechaDesde,
        fechaHasta,
        pacienteFiltro,
        usuarioFiltro,
      ]
    );


  const registrarVenta =
    async () => {

      if (!usuario) {
        return;
      }


      if (!solicitudId) {
        Alert.alert(
          "Falta solicitud",
          "Selecciona una solicitud."
        );

        return;
      }


      try {
        setGuardando(
          true
        );


        const resultado =
          await registrarVentaYGenerarOrden({
            laboratorioId:
              usuario.laboratorioId,

            empleadoId:
              usuario.id,

            solicitudId,

            metodoPago,
          });


        const [
          nuevasSolicitudes,
          nuevasVentas,
        ] =
          await Promise.all([
            obtenerSolicitudes(
              usuario.laboratorioId
            ),

            obtenerVentas(
              usuario.laboratorioId
            ),
          ]);


        setSolicitudes(
          nuevasSolicitudes
        );

        setVentas(
          nuevasVentas
        );


        const creada =
          nuevasVentas.find(
            (item) =>
              item.ventaId ===
                resultado.ventaId ||
              item.id ===
                resultado.ventaId
          ) || null;


        setDetalleVenta(
          creada
        );


        const orden =
          await obtenerOrdenPorId(
            resultado.ordenId,
            usuario.laboratorioId
          );


        setDetalleOrden(
          orden
        );


        setSolicitudId(
          ""
        );


        Alert.alert(
          "Correcto",
          "Venta registrada y orden generada correctamente."
        );

      } catch (error) {
        console.error(
          error
        );

        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo registrar la venta."
        );

      } finally {
        setGuardando(
          false
        );
      }
    };


  const verDetalle =
    async (
      venta: Venta
    ) => {

      setDetalleVenta(
        venta
      );

      setDetalleOrden(
        null
      );


      if (
        !usuario ||
        !venta.ordenId
      ) {
        return;
      }


      try {
        const orden =
          await obtenerOrdenPorId(
            venta.ordenId,
            usuario.laboratorioId
          );


        setDetalleOrden(
          orden
        );

      } catch (error) {
        console.error(
          error
        );
      }
    };


  if (cargando) {
    return (
      <SafeAreaView
        style={
          styles.cargando
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text>
          Cargando ventas...
        </Text>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView
      style={
        styles.container
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.contenido
        }
      >

        <Pressable
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.volver
            }
          >
            ← Volver
          </Text>
        </Pressable>


        <Text
          style={
            styles.titulo
          }
        >
          Ventas y órdenes
        </Text>


        <Text
          style={
            styles.subtitulo
          }
        >
          Registra ventas y consulta las operaciones del laboratorio.
        </Text>


        {usuario?.rol ===
          "recepcionista" && (
          <View
            style={
              styles.tarjeta
            }
          >
            <Text
              style={
                styles.tituloTarjeta
              }
            >
              Registrar venta
            </Text>


            {solicitudesPendientes
              .length ===
            0 ? (
              <Text
                style={
                  styles.textoGris
                }
              >
                No existen solicitudes pendientes.
              </Text>
            ) : (
              solicitudesPendientes.map(
                (
                  solicitud
                ) => (
                  <Pressable
                    key={
                      solicitud.id
                    }
                    style={[
                      styles.opcion,

                      solicitudId ===
                        solicitud.id &&
                        styles
                          .seleccionado,
                    ]}
                    onPress={() =>
                      setSolicitudId(
                        solicitud.id
                      )
                    }
                  >
                    <Text
                      style={
                        styles
                          .opcionTitulo
                      }
                    >
                      {
                        nombrePaciente(
                          solicitud.pacienteId
                        )
                      }
                    </Text>

                    <Text
                      style={
                        styles.textoGris
                      }
                    >
                      {
                        solicitud.analisis.length
                      }{" "}
                      análisis
                    </Text>

                    <Text
                      style={
                        styles.precio
                      }
                    >
                      Bs.{" "}
                      {
                        solicitud.total.toFixed(
                          2
                        )
                      }
                    </Text>
                  </Pressable>
                )
              )
            )}


            {solicitudSeleccionada && (
              <View
                style={
                  styles.resumen
                }
              >
                <Text
                  style={
                    styles
                      .resumenTitulo
                  }
                >
                  Nota de venta
                </Text>

                <Text>
                  Paciente:{" "}
                  {
                    nombrePaciente(
                      solicitudSeleccionada
                        .pacienteId
                    )
                  }
                </Text>


                {solicitudSeleccionada
                  .analisis.map(
                    (
                      item,
                      indice
                    ) => (
                      <Text
                        key={`${item.analisisId}-${indice}`}
                      >
                        •{" "}
                        {
                          item.nombre
                        }{" "}
                        - Bs.{" "}
                        {
                          item.subtotal.toFixed(
                            2
                          )
                        }
                      </Text>
                    )
                  )}


                <Text
                  style={
                    styles
                      .resumenTotal
                  }
                >
                  Total: Bs.{" "}
                  {
                    solicitudSeleccionada.total.toFixed(
                      2
                    )
                  }
                </Text>
              </View>
            )}


            <Text
              style={
                styles.etiqueta
              }
            >
              Método de pago
            </Text>


            <View
              style={
                styles.fila
              }
            >
              {[
                "efectivo",
                "qr",
                "transferencia",
              ].map(
                (metodo) => (
                  <Pressable
                    key={
                      metodo
                    }
                    style={[
                      styles
                        .metodo,

                      metodoPago ===
                        metodo &&
                        styles
                          .metodoActivo,
                    ]}
                    onPress={() =>
                      setMetodoPago(
                        metodo
                      )
                    }
                  >
                    <Text>
                      {metodo}
                    </Text>
                  </Pressable>
                )
              )}
            </View>


            <Pressable
              style={[
                styles.boton,

                guardando &&
                  styles
                    .desactivado,
              ]}
              onPress={
                registrarVenta
              }
              disabled={
                guardando
              }
            >
              <Text
                style={
                  styles.botonTexto
                }
              >
                {
                  guardando
                    ? "Registrando..."
                    : "Registrar venta y generar orden"
                }
              </Text>
            </Pressable>
          </View>
        )}


        <View
          style={
            styles.tarjeta
          }
        >
          <Text
            style={
              styles.tituloTarjeta
            }
          >
            Historial de ventas
          </Text>


          <TextInput
            style={
              styles.input
            }
            placeholder="Fecha desde: YYYY-MM-DD"
            value={
              fechaDesde
            }
            onChangeText={
              setFechaDesde
            }
          />


          <TextInput
            style={
              styles.input
            }
            placeholder="Fecha hasta: YYYY-MM-DD"
            value={
              fechaHasta
            }
            onChangeText={
              setFechaHasta
            }
          />


          <TextInput
            style={
              styles.input
            }
            placeholder="Filtrar por UID de usuario"
            value={
              usuarioFiltro
            }
            onChangeText={
              setUsuarioFiltro
            }
          />


          <Text
            style={
              styles.etiqueta
            }
          >
            Paciente
          </Text>


          <Pressable
            style={[
              styles.opcion,

              !pacienteFiltro &&
                styles
                  .seleccionado,
            ]}
            onPress={() =>
              setPacienteFiltro(
                ""
              )
            }
          >
            <Text>
              Todos
            </Text>
          </Pressable>


          {pacientes.map(
            (paciente) => (
              <Pressable
                key={
                  paciente.id
                }
                style={[
                  styles.opcion,

                  pacienteFiltro ===
                    paciente.id &&
                    styles
                      .seleccionado,
                ]}
                onPress={() =>
                  setPacienteFiltro(
                    paciente.id
                  )
                }
              >
                <Text>
                  {
                    paciente.nombres
                  }{" "}
                  {
                    paciente.apellidos
                  }
                </Text>
              </Pressable>
            )
          )}


          {ventasFiltradas
            .length ===
          0 ? (
            <Text
              style={
                styles.textoGris
              }
            >
              No existen ventas.
            </Text>
          ) : (
            ventasFiltradas.map(
              (
                venta
              ) => (
                <Pressable
                  key={
                    venta.id
                  }
                  style={
                    styles.venta
                  }
                  onPress={() =>
                    verDetalle(
                      venta
                    )
                  }
                >
                  <Text
                    style={
                      styles
                        .opcionTitulo
                    }
                  >
                    {
                      nombrePaciente(
                        venta.pacienteId
                      )
                    }
                  </Text>

                  <Text
                    style={
                      styles.textoGris
                    }
                  >
                    {
                      fechaTexto(
                        venta.fecha
                      )
                    }
                  </Text>

                  <Text
                    style={
                      styles.textoGris
                    }
                  >
                    Pago:{" "}
                    {
                      venta.metodoPago
                    }
                  </Text>

                  <Text
                    style={
                      styles.precio
                    }
                  >
                    Bs.{" "}
                    {
                      venta.total.toFixed(
                        2
                      )
                    }
                  </Text>
                </Pressable>
              )
            )
          )}
        </View>


        {detalleVenta && (
          <View
            style={
              styles.tarjeta
            }
          >
            <Text
              style={
                styles.tituloTarjeta
              }
            >
              Detalle de venta
            </Text>

            <Text>
              Venta:{" "}
              {
                detalleVenta.ventaId
              }
            </Text>

            <Text>
              Paciente:{" "}
              {
                nombrePaciente(
                  detalleVenta.pacienteId
                )
              }
            </Text>

            <Text>
              Estado:{" "}
              {
                detalleVenta.estado
              }
            </Text>


            {detalleVenta.analisis.map(
              (
                item,
                indice
              ) => (
                <Text
                  key={`${item.analisisId}-${indice}`}
                >
                  •{" "}
                  {
                    item.nombre
                  }{" "}
                  - Bs.{" "}
                  {
                    item.subtotal.toFixed(
                      2
                    )
                  }
                </Text>
              )
            )}


            <Text
              style={
                styles
                  .resumenTotal
              }
            >
              Total: Bs.{" "}
              {
                detalleVenta.total.toFixed(
                  2
                )
              }
            </Text>


            {detalleOrden && (
              <View
                style={
                  styles.orden
                }
              >
                <Text
                  style={
                    styles
                      .resumenTitulo
                  }
                >
                  Orden asociada
                </Text>

                <Text>
                  ID:{" "}
                  {
                    detalleOrden.ordenId
                  }
                </Text>

                <Text>
                  Estado:{" "}
                  {
                    detalleOrden.estado
                  }
                </Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}


const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#F8FAFC",
    },

    contenido: {
      padding: 18,
      paddingBottom: 60,
    },

    cargando: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      gap: 10,
    },

    volver: {
      color: "#2563EB",
      fontWeight: "700",
      marginBottom: 12,
    },

    titulo: {
      fontSize: 26,
      fontWeight: "800",
      color: "#0F172A",
    },

    subtitulo: {
      color: "#64748B",
      marginTop: 5,
      marginBottom: 18,
    },

    tarjeta: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },

    tituloTarjeta: {
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 12,
      color: "#0F172A",
    },

    opcion: {
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },

    seleccionado: {
      borderColor:
        "#0284C7",
      backgroundColor:
        "#E0F2FE",
    },

    opcionTitulo: {
      fontWeight: "700",
      color: "#0F172A",
    },

    textoGris: {
      color: "#64748B",
      marginTop: 3,
    },

    precio: {
      color: "#0369A1",
      fontWeight: "800",
      marginTop: 4,
    },

    resumen: {
      backgroundColor:
        "#F1F5F9",
      borderRadius: 10,
      padding: 12,
      marginVertical: 12,
    },

    resumenTitulo: {
      fontWeight: "800",
      marginBottom: 8,
    },

    resumenTotal: {
      fontSize: 18,
      fontWeight: "800",
      marginTop: 10,
      color: "#0369A1",
    },

    etiqueta: {
      fontWeight: "700",
      marginTop: 10,
      marginBottom: 7,
    },

    fila: {
      flexDirection:
        "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },

    metodo: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 9,
    },

    metodoActivo: {
      backgroundColor:
        "#BAE6FD",
      borderColor:
        "#0284C7",
    },

    boton: {
      backgroundColor:
        "#0284C7",
      paddingVertical: 13,
      borderRadius: 10,
      alignItems:
        "center",
      marginTop: 10,
    },

    botonTexto: {
      color: "#FFFFFF",
      fontWeight: "800",
    },

    desactivado: {
      opacity: 0.6,
    },

    input: {
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 10,
      padding: 11,
      marginBottom: 9,
    },

    venta: {
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 11,
      padding: 13,
      marginBottom: 9,
    },

    orden: {
      marginTop: 14,
      padding: 12,
      backgroundColor:
        "#ECFEFF",
      borderRadius: 10,
    },
  });