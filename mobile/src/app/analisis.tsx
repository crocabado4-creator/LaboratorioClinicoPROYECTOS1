import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
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
  obtenerPermisosRol,
} from "../services/rolesService";

import {
  actualizarAnalisis,
  actualizarParametroAnalisis,
  cambiarEstadoAnalisis,
  crearAnalisis,
  crearParametroAnalisis,
  eliminarParametroAnalisis,
  eliminarRangoReferencia,
  guardarConfiguracionAnalisis,
  guardarRangoReferencia,
  obtenerAnalisis,
  type AnalisisClinico,
  type ConfiguracionAnalisis,
  type DatosAnalisis,
  type ParametroAnalisis,
  type RangoReferencia,
} from "../services/analisisService";


type UsuarioActual = {
  id: string;
  rol: string;
  laboratorioId: string;
};


type FormularioAnalisis = {
  nombre: string;
  descripcion: string;
  precio: string;
  unidad: string;
  tipo: string;
  activo: boolean;
};


type FormularioParametro = {
  nombre: string;
  unidad: string;
  descripcion: string;
};


type FormularioRango = {
  tipo: "numerico" | "texto";
  minimo: string;
  maximo: string;
  textoReferencia: string;
  observaciones: string;
};


const formularioRangoInicial:
  FormularioRango = {
    tipo: "numerico",
    minimo: "",
    maximo: "",
    textoReferencia: "",
    observaciones: "",
  };


const formularioParametroInicial:
  FormularioParametro = {
    nombre: "",
    unidad: "",
    descripcion: "",
  };


const formularioInicial:
  FormularioAnalisis = {
    nombre: "",
    descripcion: "",
    precio: "",
    unidad: "",
    tipo: "",
    activo: true,
  };


const configuracionInicial:
  ConfiguracionAnalisis = {
    tipoMuestra: "",
    preparacionPaciente: "",
    requiereAyuno: false,
    horasAyuno: 0,
    tiempoEntrega: "",
    instrucciones: "",
  };


export default function Analisis() {
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
    permisos,
    setPermisos,
  ] =
    useState<string[]>([]);


  const [
    analisis,
    setAnalisis,
  ] =
    useState<AnalisisClinico[]>([]);


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


  const [
    busqueda,
    setBusqueda,
  ] =
    useState("");


  const [
    modalFormulario,
    setModalFormulario,
  ] =
    useState(false);


  const [
    modalDetalle,
    setModalDetalle,
  ] =
    useState(false);


  const [
    modalConfiguracion,
    setModalConfiguracion,
  ] =
    useState(false);


  const [
    modalParametros,
    setModalParametros,
  ] =
    useState(false);


  const [
    modalParametro,
    setModalParametro,
  ] =
    useState(false);


  const [
    modalRango,
    setModalRango,
  ] =
    useState(false);


  const [
    seleccionado,
    setSeleccionado,
  ] =
    useState<AnalisisClinico | null>(
      null
    );


  const [
    editandoId,
    setEditandoId,
  ] =
    useState<string | null>(
      null
    );


  const [
    parametroSeleccionado,
    setParametroSeleccionado,
  ] =
    useState<ParametroAnalisis | null>(
      null
    );


  const [
    editandoParametro,
    setEditandoParametro,
  ] =
    useState(false);


  const [
    formulario,
    setFormulario,
  ] =
    useState<FormularioAnalisis>(
      formularioInicial
    );


  const [
    configuracion,
    setConfiguracion,
  ] =
    useState<ConfiguracionAnalisis>(
      configuracionInicial
    );


  const [
    formularioParametro,
    setFormularioParametro,
  ] =
    useState<FormularioParametro>(
      formularioParametroInicial
    );


  const [
    formularioRango,
    setFormularioRango,
  ] =
    useState<FormularioRango>(
      formularioRangoInicial
    );


  const puedeCrear =
    permisos.includes(
      "analisis.crear"
    );


  const puedeEditar =
    permisos.includes(
      "analisis.editar"
    );


  const puedeVer =
    permisos.includes(
      "analisis.ver"
    ) ||
    puedeCrear ||
    puedeEditar;


  const cargarPantalla =
    useCallback(
      async () => {
        try {
          setCargando(
            true
          );


          const firebaseUser =
            auth.currentUser;


          if (!firebaseUser) {
            Alert.alert(
              "Sesión no disponible",
              "Debes iniciar sesión nuevamente."
            );

            router.replace(
              "/"
            );

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
            throw new Error(
              "No se encontró el usuario en Firestore."
            );
          }


          const datosUsuario =
            usuarioSnap.data();


          if (
            datosUsuario.activo !==
            true
          ) {
            throw new Error(
              "El usuario está inactivo."
            );
          }


          const rol =
            typeof datosUsuario.rol ===
              "string"
              ? datosUsuario.rol.trim()
              : "";


          const laboratorioId =
            typeof datosUsuario.laboratorioId ===
              "string"
              ? datosUsuario.laboratorioId.trim()
              : "";


          if (!rol) {
            throw new Error(
              "El usuario no tiene rol asignado."
            );
          }


          if (!laboratorioId) {
            throw new Error(
              "El usuario no está asociado a un laboratorio."
            );
          }


          const permisosRol =
            await obtenerPermisosRol(
              rol
            );


          const listaPermisos =
            Array.isArray(
              permisosRol
            )
              ? permisosRol
              : [];


          const tieneAcceso =
            listaPermisos.some(
              (permiso) =>
                [
                  "analisis.crear",
                  "analisis.editar",
                  "analisis.ver",
                ].includes(
                  permiso
                )
            );


          if (!tieneAcceso) {
            throw new Error(
              "No tienes permiso para consultar análisis clínicos."
            );
          }


          const usuarioActual:
            UsuarioActual = {
              id:
                usuarioSnap.id,

              rol,

              laboratorioId,
            };


          setUsuario(
            usuarioActual
          );


          setPermisos(
            listaPermisos
          );


          const resultado =
            await obtenerAnalisis(
              laboratorioId
            );


          setAnalisis(
            resultado
          );

        } catch (error) {
          console.error(
            "Error cargando análisis:",
            error
          );


          Alert.alert(
            "Error",
            mensajeError(
              error,
              "No se pudo cargar el catálogo de análisis."
            )
          );

        } finally {
          setCargando(
            false
          );
        }
      },
      [
        router,
      ]
    );


  useEffect(() => {
    cargarPantalla();
  }, [cargarPantalla]);


  const analisisFiltrados =
    useMemo(
      () => {
        const texto =
          normalizarTexto(
            busqueda
          );


        if (!texto) {
          return analisis;
        }


        return analisis.filter(
          (item) =>
            normalizarTexto(
              item.nombre
            ).includes(
              texto
            ) ||
            normalizarTexto(
              item.tipo
            ).includes(
              texto
            ) ||
            normalizarTexto(
              item.descripcion
            ).includes(
              texto
            )
        );
      },
      [
        analisis,
        busqueda,
      ]
    );


  const totalActivos =
    analisis.filter(
      (item) =>
        item.activo ===
        true
    ).length;


  const abrirNuevo =
    () => {
      if (!puedeCrear) {
        Alert.alert(
          "Acceso denegado",
          "No tienes permiso para registrar análisis."
        );

        return;
      }


      setSeleccionado(
        null
      );


      setEditandoId(
        null
      );


      setFormulario(
        formularioInicial
      );


      setModalFormulario(
        true
      );
    };


  const abrirEditar =
    (
      item:
        AnalisisClinico
    ) => {
      if (!puedeEditar) {
        Alert.alert(
          "Acceso denegado",
          "No tienes permiso para modificar análisis."
        );

        return;
      }


      setSeleccionado(
        item
      );


      setEditandoId(
        item.id
      );


      setFormulario({
        nombre:
          item.nombre,

        descripcion:
          item.descripcion,

        precio:
          String(
            item.precio
          ),

        unidad:
          item.unidad,

        tipo:
          item.tipo,

        activo:
          item.activo,
      });


      setModalFormulario(
        true
      );
    };


  const abrirDetalle =
    (
      item:
        AnalisisClinico
    ) => {
      setSeleccionado(
        item
      );


      setModalDetalle(
        true
      );
    };


  const abrirConfiguracion =
    (
      item:
        AnalisisClinico
    ) => {
      if (!puedeEditar) {
        Alert.alert(
          "Acceso denegado",
          "No tienes permiso para configurar análisis."
        );

        return;
      }


      setSeleccionado(
        item
      );


      setConfiguracion({
        ...configuracionInicial,
        ...item.configuracion,
      });


      setModalConfiguracion(
        true
      );
    };


  const cerrarConfiguracion =
    () => {
      if (guardando) {
        return;
      }


      setModalConfiguracion(
        false
      );


      setSeleccionado(
        null
      );


      setConfiguracion(
        configuracionInicial
      );
    };


  const cambiarConfiguracion =
    (
      campo:
        keyof ConfiguracionAnalisis,
      valor:
        string |
        number |
        boolean
    ) => {
      setConfiguracion(
        (actual) => ({
          ...actual,
          [campo]:
            valor,
        })
      );
    };


  const guardarConfiguracion =
    async () => {
      if (
        !usuario ||
        !seleccionado
      ) {
        Alert.alert(
          "Error",
          "No se pudo identificar el análisis seleccionado."
        );

        return;
      }


      if (
        !configuracion.tipoMuestra.trim()
      ) {
        Alert.alert(
          "Revisa los datos",
          "El tipo de muestra es obligatorio."
        );

        return;
      }


      if (
        !configuracion.tiempoEntrega.trim()
      ) {
        Alert.alert(
          "Revisa los datos",
          "El tiempo de entrega es obligatorio."
        );

        return;
      }


      if (
        configuracion.requiereAyuno &&
        (
          Number.isNaN(
            Number(
              configuracion.horasAyuno
            )
          ) ||
          Number(
            configuracion.horasAyuno
          ) < 1 ||
          Number(
            configuracion.horasAyuno
          ) > 48
        )
      ) {
        Alert.alert(
          "Revisa los datos",
          "Las horas de ayuno deben estar entre 1 y 48."
        );

        return;
      }


      try {
        setGuardando(
          true
        );


        await guardarConfiguracionAnalisis(
          seleccionado.id,
          usuario.laboratorioId,
          {
            ...configuracion,

            horasAyuno:
              configuracion.requiereAyuno
                ? Number(
                    configuracion.horasAyuno
                  )
                : 0,
          }
        );


        const resultado =
          await obtenerAnalisis(
            usuario.laboratorioId
          );


        setAnalisis(
          resultado
        );


        setModalConfiguracion(
          false
        );


        setSeleccionado(
          null
        );


        setConfiguracion(
          configuracionInicial
        );


        Alert.alert(
          "Correcto",
          "Configuración guardada correctamente."
        );

      } catch (error) {
        console.error(
          "Error guardando configuración:",
          error
        );


        Alert.alert(
          "Error",
          mensajeError(
            error,
            "No se pudo guardar la configuración."
          )
        );

      } finally {
        setGuardando(
          false
        );
      }
    };


  const abrirParametros =
    (
      item:
        AnalisisClinico
    ) => {
      if (!puedeEditar) {
        Alert.alert(
          "Acceso denegado",
          "No tienes permiso para administrar parámetros."
        );

        return;
      }


      setSeleccionado(
        item
      );


      setParametroSeleccionado(
        null
      );


      setModalParametros(
        true
      );
    };


  const cerrarParametros =
    () => {
      if (guardando) {
        return;
      }


      setModalParametros(
        false
      );


      setParametroSeleccionado(
        null
      );


      setSeleccionado(
        null
      );
    };


  const abrirNuevoParametro =
    () => {
      setEditandoParametro(
        false
      );


      setParametroSeleccionado(
        null
      );


      setFormularioParametro(
        formularioParametroInicial
      );


      setModalParametro(
        true
      );
    };


  const abrirEditarParametro =
    (
      parametro:
        ParametroAnalisis
    ) => {
      setEditandoParametro(
        true
      );


      setParametroSeleccionado(
        parametro
      );


      setFormularioParametro({
        nombre:
          parametro.nombre,

        unidad:
          parametro.unidad,

        descripcion:
          parametro.descripcion,
      });


      setModalParametro(
        true
      );
    };


  const cerrarParametro =
    () => {
      if (guardando) {
        return;
      }


      setModalParametro(
        false
      );


      setParametroSeleccionado(
        null
      );


      setEditandoParametro(
        false
      );


      setFormularioParametro(
        formularioParametroInicial
      );
    };


  const cambiarCampoParametro =
    (
      campo:
        keyof FormularioParametro,
      valor: string
    ) => {
      setFormularioParametro(
        (actual) => ({
          ...actual,
          [campo]:
            valor,
        })
      );
    };


  const guardarParametro =
    async () => {
      if (
        !usuario ||
        !seleccionado
      ) {
        Alert.alert(
          "Error",
          "No se pudo identificar el análisis."
        );

        return;
      }


      if (
        !formularioParametro.nombre.trim()
      ) {
        Alert.alert(
          "Revisa los datos",
          "El nombre del parámetro es obligatorio."
        );

        return;
      }


      if (
        !formularioParametro.unidad.trim()
      ) {
        Alert.alert(
          "Revisa los datos",
          "La unidad del parámetro es obligatoria."
        );

        return;
      }


      try {
        setGuardando(
          true
        );


        if (
          editandoParametro &&
          parametroSeleccionado
        ) {
          await actualizarParametroAnalisis(
            seleccionado.id,
            usuario.laboratorioId,
            parametroSeleccionado.parametroId,
            {
              nombre:
                formularioParametro.nombre,

              unidad:
                formularioParametro.unidad,

              descripcion:
                formularioParametro.descripcion,
            }
          );

        } else {
          await crearParametroAnalisis(
            seleccionado.id,
            usuario.laboratorioId,
            {
              nombre:
                formularioParametro.nombre,

              unidad:
                formularioParametro.unidad,

              descripcion:
                formularioParametro.descripcion,
            }
          );
        }


        const resultado =
          await obtenerAnalisis(
            usuario.laboratorioId
          );


        setAnalisis(
          resultado
        );


        const actualizado =
          resultado.find(
            (item) =>
              item.id ===
              seleccionado.id
          ) ||
          null;


        setSeleccionado(
          actualizado
        );


        setModalParametro(
          false
        );


        setParametroSeleccionado(
          null
        );


        setEditandoParametro(
          false
        );


        setFormularioParametro(
          formularioParametroInicial
        );


        Alert.alert(
          "Correcto",
          editandoParametro
            ? "Parámetro actualizado correctamente."
            : "Parámetro registrado correctamente."
        );

      } catch (error) {
        console.error(
          "Error guardando parámetro:",
          error
        );


        Alert.alert(
          "Error",
          mensajeError(
            error,
            "No se pudo guardar el parámetro."
          )
        );

      } finally {
        setGuardando(
          false
        );
      }
    };


  const confirmarEliminarParametro =
    (
      parametro:
        ParametroAnalisis
    ) => {
      if (
        !usuario ||
        !seleccionado
      ) {
        return;
      }


      pedirConfirmacion(
        "Eliminar parámetro",
        `¿Deseas eliminar "${parametro.nombre}"?`,
        "Eliminar",
        true,
        async () => {
          try {
            setGuardando(
              true
            );


            await eliminarParametroAnalisis(
              seleccionado.id,
              usuario.laboratorioId,
              parametro.parametroId
            );


            const resultado =
              await obtenerAnalisis(
                usuario.laboratorioId
              );


            setAnalisis(
              resultado
            );


            const actualizado =
              resultado.find(
                (item) =>
                  item.id ===
                  seleccionado.id
              ) ||
              null;


            setSeleccionado(
              actualizado
            );


            Alert.alert(
              "Correcto",
              "Parámetro eliminado correctamente."
            );

          } catch (error) {
            Alert.alert(
              "Error",
              mensajeError(
                error,
                "No se pudo eliminar el parámetro."
              )
            );

          } finally {
            setGuardando(
              false
            );
          }
        }
      );
    };


  const abrirRango =
    (
      parametro:
        ParametroAnalisis
    ) => {
      setParametroSeleccionado(
        parametro
      );


      const rango =
        parametro.rangoReferencia;


      if (!rango) {
        setFormularioRango(
          formularioRangoInicial
        );

      } else {
        setFormularioRango({
          tipo:
            rango.tipo,

          minimo:
            rango.minimo !==
              null
              ? String(
                  rango.minimo
                )
              : "",

          maximo:
            rango.maximo !==
              null
              ? String(
                  rango.maximo
                )
              : "",

          textoReferencia:
            rango.textoReferencia,

          observaciones:
            rango.observaciones,
        });
      }


      setModalRango(
        true
      );
    };


  const cerrarRango =
    () => {
      if (guardando) {
        return;
      }


      setModalRango(
        false
      );


      setParametroSeleccionado(
        null
      );


      setFormularioRango(
        formularioRangoInicial
      );
    };


  const cambiarCampoRango =
    (
      campo:
        keyof FormularioRango,
      valor: string
    ) => {
      setFormularioRango(
        (actual) => ({
          ...actual,
          [campo]:
            valor,
        })
      );
    };


  const guardarRango =
    async () => {
      if (
        !usuario ||
        !seleccionado ||
        !parametroSeleccionado
      ) {
        Alert.alert(
          "Error",
          "No se pudo identificar el parámetro."
        );

        return;
      }


      if (
        formularioRango.tipo ===
        "numerico"
      ) {
        if (
          formularioRango.minimo.trim() ===
          "" ||
          formularioRango.maximo.trim() ===
          ""
        ) {
          Alert.alert(
            "Revisa los datos",
            "Debes indicar el valor mínimo y máximo."
          );

          return;
        }
      } else {
        if (
          !formularioRango.textoReferencia.trim()
        ) {
          Alert.alert(
            "Revisa los datos",
            "Debes indicar la referencia cualitativa."
          );

          return;
        }
      }


      const rango:
        RangoReferencia = {
          tipo:
            formularioRango.tipo,

          minimo:
            formularioRango.tipo ===
            "numerico"
              ? Number(
                  formularioRango.minimo.replace(
                    ",",
                    "."
                  )
                )
              : null,

          maximo:
            formularioRango.tipo ===
            "numerico"
              ? Number(
                  formularioRango.maximo.replace(
                    ",",
                    "."
                  )
                )
              : null,

          textoReferencia:
            formularioRango.tipo ===
            "texto"
              ? formularioRango.textoReferencia
              : "",

          observaciones:
            formularioRango.observaciones,
        };


      try {
        setGuardando(
          true
        );


        await guardarRangoReferencia(
          seleccionado.id,
          usuario.laboratorioId,
          parametroSeleccionado.parametroId,
          rango
        );


        const resultado =
          await obtenerAnalisis(
            usuario.laboratorioId
          );


        setAnalisis(
          resultado
        );


        const actualizado =
          resultado.find(
            (item) =>
              item.id ===
              seleccionado.id
          ) ||
          null;


        setSeleccionado(
          actualizado
        );


        setModalRango(
          false
        );


        setParametroSeleccionado(
          null
        );


        setFormularioRango(
          formularioRangoInicial
        );


        Alert.alert(
          "Correcto",
          "Rango de referencia guardado correctamente."
        );

      } catch (error) {
        console.error(
          "Error guardando rango:",
          error
        );


        Alert.alert(
          "Error",
          mensajeError(
            error,
            "No se pudo guardar el rango de referencia."
          )
        );

      } finally {
        setGuardando(
          false
        );
      }
    };


  const confirmarEliminarRango =
    () => {
      if (
        !usuario ||
        !seleccionado ||
        !parametroSeleccionado
      ) {
        return;
      }


      pedirConfirmacion(
        "Eliminar rango",
        "¿Deseas eliminar el rango de referencia de este parámetro?",
        "Eliminar",
        true,
        async () => {
          try {
            setGuardando(
              true
            );


            await eliminarRangoReferencia(
              seleccionado.id,
              usuario.laboratorioId,
              parametroSeleccionado.parametroId
            );


            const resultado =
              await obtenerAnalisis(
                usuario.laboratorioId
              );


            setAnalisis(
              resultado
            );


            const actualizado =
              resultado.find(
                (item) =>
                  item.id ===
                  seleccionado.id
              ) ||
              null;


            setSeleccionado(
              actualizado
            );


            setModalRango(
              false
            );


            setParametroSeleccionado(
              null
            );


            setFormularioRango(
              formularioRangoInicial
            );


            Alert.alert(
              "Correcto",
              "Rango de referencia eliminado correctamente."
            );

          } catch (error) {
            Alert.alert(
              "Error",
              mensajeError(
                error,
                "No se pudo eliminar el rango de referencia."
              )
            );

          } finally {
            setGuardando(
              false
            );
          }
        }
      );
    };


  const cerrarFormulario =
    () => {
      if (guardando) {
        return;
      }


      setModalFormulario(
        false
      );


      setSeleccionado(
        null
      );


      setEditandoId(
        null
      );


      setFormulario(
        formularioInicial
      );
    };


  const cambiarCampo =
    (
      campo:
        keyof FormularioAnalisis,
      valor:
        string |
        boolean
    ) => {
      setFormulario(
        (actual) => ({
          ...actual,
          [campo]:
            valor,
        })
      );
    };


  const validarFormulario =
    (): string => {
      if (
        !formulario.nombre.trim()
      ) {
        return "El nombre del análisis es obligatorio.";
      }


      if (
        !formulario.descripcion.trim()
      ) {
        return "La descripción es obligatoria.";
      }


      if (
        !formulario.tipo.trim()
      ) {
        return "El tipo de análisis es obligatorio.";
      }


      if (
        formulario.precio.trim() ===
        ""
      ) {
        return "El precio es obligatorio.";
      }


      const precio =
        Number(
          formulario.precio.replace(
            ",",
            "."
          )
        );


      if (
        Number.isNaN(
          precio
        ) ||
        precio < 0
      ) {
        return "El precio no es válido.";
      }


      return "";
    };


  const guardar =
    async () => {
      const error =
        validarFormulario();


      if (error) {
        Alert.alert(
          "Revisa los datos",
          error
        );

        return;
      }


      if (!usuario) {
        Alert.alert(
          "Error",
          "No se pudo identificar el laboratorio."
        );

        return;
      }


      const datos:
        DatosAnalisis = {
          nombre:
            formulario.nombre,

          descripcion:
            formulario.descripcion,

          precio:
            Number(
              formulario.precio.replace(
                ",",
                "."
              )
            ),

          unidad:
            formulario.unidad,

          tipo:
            formulario.tipo,

          activo:
            formulario.activo,
        };


      try {
        setGuardando(
          true
        );


        if (editandoId) {
          if (!puedeEditar) {
            throw new Error(
              "No tienes permiso para modificar análisis."
            );
          }


          await actualizarAnalisis(
            editandoId,
            usuario.laboratorioId,
            datos
          );


          Alert.alert(
            "Correcto",
            "Análisis actualizado correctamente."
          );

        } else {
          if (!puedeCrear) {
            throw new Error(
              "No tienes permiso para registrar análisis."
            );
          }


          await crearAnalisis(
            usuario.laboratorioId,
            datos
          );


          Alert.alert(
            "Correcto",
            "Análisis registrado correctamente."
          );
        }


        setModalFormulario(
          false
        );


        setSeleccionado(
          null
        );


        setEditandoId(
          null
        );


        setFormulario(
          formularioInicial
        );


        const resultado =
          await obtenerAnalisis(
            usuario.laboratorioId
          );


        setAnalisis(
          resultado
        );

      } catch (error) {
        console.error(
          "Error guardando análisis:",
          error
        );


        Alert.alert(
          "Error",
          mensajeError(
            error,
            "No se pudo guardar el análisis."
          )
        );

      } finally {
        setGuardando(
          false
        );
      }
    };


  const cambiarEstado =
    (
      item:
        AnalisisClinico
    ) => {
      if (!puedeEditar) {
        Alert.alert(
          "Acceso denegado",
          "No tienes permiso para modificar análisis."
        );

        return;
      }


      if (!usuario) {
        return;
      }


      const nuevoEstado =
        !item.activo;


      pedirConfirmacion(
        nuevoEstado
          ? "Activar análisis"
          : "Desactivar análisis",

        nuevoEstado
          ? `¿Deseas activar "${item.nombre}"?`
          : `¿Deseas desactivar "${item.nombre}"?`,

        nuevoEstado
          ? "Activar"
          : "Desactivar",

        !nuevoEstado,

        async () => {
          try {
            setGuardando(
              true
            );


            await cambiarEstadoAnalisis(
              item.id,
              usuario.laboratorioId,
              nuevoEstado
            );


            const resultado =
              await obtenerAnalisis(
                usuario.laboratorioId
              );


            setAnalisis(
              resultado
            );


            Alert.alert(
              "Correcto",
              nuevoEstado
                ? "Análisis activado correctamente."
                : "Análisis desactivado correctamente."
            );

          } catch (error) {
            Alert.alert(
              "Error",
              mensajeError(
                error,
                "No se pudo modificar el estado."
              )
            );

          } finally {
            setGuardando(
              false
            );
          }
        }
      );
    };


  if (cargando) {
    return (
      <SafeAreaView
        style={
          styles.loadingPage
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#F8FAFC"
        />


        <ActivityIndicator
          size="large"
          color="#0E7490"
        />


        <Text
          style={
            styles.loadingTitle
          }
        >
          Análisis clínicos
        </Text>


        <Text
          style={
            styles.loadingText
          }
        >
          Cargando catálogo...
        </Text>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView
      style={
        styles.page
      }
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F8FAFC"
      />


      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            style={
              styles.backButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backText
              }
            >
              ← Volver
            </Text>
          </Pressable>


          <View
            style={
              styles.headerRow
            }
          >
            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.eyebrow
                }
              >
                CATÁLOGO
              </Text>


              <Text
                style={
                  styles.title
                }
              >
                Análisis clínicos
              </Text>


              <Text
                style={
                  styles.subtitle
                }
              >
                Administra los servicios clínicos disponibles en tu laboratorio.
              </Text>
            </View>


            {puedeCrear && (
              <Pressable
                style={
                  styles.newButton
                }
                onPress={
                  abrirNuevo
                }
              >
                <Text
                  style={
                    styles.newButtonText
                  }
                >
                  + Nuevo
                </Text>
              </Pressable>
            )}
          </View>
        </View>


        <View
          style={
            styles.statsRow
          }
        >
          <Estadistica
            titulo="TOTAL"
            valor={
              analisis.length
            }
          />


          <Estadistica
            titulo="ACTIVOS"
            valor={
              totalActivos
            }
          />


          <Estadistica
            titulo="INACTIVOS"
            valor={
              analisis.length -
              totalActivos
            }
          />
        </View>


        <View
          style={
            styles.searchCard
          }
        >
          <Text
            style={
              styles.searchTitle
            }
          >
            Buscar en el catálogo
          </Text>


          <TextInput
            style={
              styles.searchInput
            }
            value={
              busqueda
            }
            onChangeText={
              setBusqueda
            }
            placeholder="Nombre, tipo o descripción..."
            placeholderTextColor="#94A3B8"
          />


          <Text
            style={
              styles.resultText
            }
          >
            {analisisFiltrados.length} resultado
            {analisisFiltrados.length ===
            1
              ? ""
              : "s"}
          </Text>
        </View>


        <Text
          style={
            styles.listTitle
          }
        >
          Servicios registrados
        </Text>


        {!puedeVer ? (
          <Vacio
            icono="🔒"
            titulo="Sin acceso"
            texto="No tienes permiso para consultar análisis clínicos."
          />

        ) : analisisFiltrados.length ===
          0 ? (
          <Vacio
            icono="🔬"
            titulo="Sin resultados"
            texto="No existen análisis que coincidan con la búsqueda."
          />

        ) : (
          analisisFiltrados.map(
            (item) => (
              <View
                key={
                  item.id
                }
                style={
                  styles.analysisCard
                }
              >
                <View
                  style={
                    styles.analysisTop
                  }
                >
                  <View
                    style={
                      styles.iconBox
                    }
                  >
                    <Text
                      style={
                        styles.iconText
                      }
                    >
                      🧪
                    </Text>
                  </View>


                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <View
                      style={
                        styles.nameRow
                      }
                    >
                      <Text
                        style={
                          styles.analysisName
                        }
                      >
                        {item.nombre}
                      </Text>


                      <View
                        style={[
                          styles.status,

                          item.activo
                            ? styles.statusActive
                            : styles.statusInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,

                            item.activo
                              ? styles.statusTextActive
                              : styles.statusTextInactive,
                          ]}
                        >
                          {item.activo
                            ? "Activo"
                            : "Inactivo"}
                        </Text>
                      </View>
                    </View>


                    <Text
                      style={
                        styles.analysisType
                      }
                    >
                      {item.tipo}
                    </Text>


                    <Text
                      style={
                        styles.analysisDescription
                      }
                      numberOfLines={
                        2
                      }
                    >
                      {item.descripcion}
                    </Text>
                  </View>
                </View>


                <View
                  style={
                    styles.priceRow
                  }
                >
                  <Text
                    style={
                      styles.priceLabel
                    }
                  >
                    Precio
                  </Text>


                  <Text
                    style={
                      styles.priceValue
                    }
                  >
                    Bs{" "}
                    {item.precio.toFixed(
                      2
                    )}
                  </Text>
                </View>


                <View
                  style={
                    styles.actions
                  }
                >
                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.detailButton,
                    ]}
                    onPress={() =>
                      abrirDetalle(
                        item
                      )
                    }
                  >
                    <Text
                      style={
                        styles.detailButtonText
                      }
                    >
                      Ver detalle
                    </Text>
                  </Pressable>


                  {puedeEditar && (
                    <>
                      <Pressable
                        style={[
                          styles.actionButton,
                          styles.configButton,
                        ]}
                        onPress={() =>
                          abrirConfiguracion(
                            item
                          )
                        }
                      >
                        <Text
                          style={
                            styles.configButtonText
                          }
                        >
                          Configurar
                        </Text>
                      </Pressable>


                      <Pressable
                        style={[
                          styles.actionButton,
                          styles.parametersButton,
                        ]}
                        onPress={() =>
                          abrirParametros(
                            item
                          )
                        }
                      >
                        <Text
                          style={
                            styles.parametersButtonText
                          }
                        >
                          Parámetros
                        </Text>
                      </Pressable>


                      <Pressable
                        style={[
                          styles.actionButton,
                          styles.editButton,
                        ]}
                        onPress={() =>
                          abrirEditar(
                            item
                          )
                        }
                      >
                        <Text
                          style={
                            styles.editButtonText
                          }
                        >
                          Editar
                        </Text>
                      </Pressable>


                      <Pressable
                        style={[
                          styles.actionButton,

                          item.activo
                            ? styles.disableButton
                            : styles.enableButton,
                        ]}
                        onPress={() =>
                          cambiarEstado(
                            item
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.stateButtonText,

                            item.activo
                              ? styles.disableButtonText
                              : styles.enableButtonText,
                          ]}
                        >
                          {item.activo
                            ? "Desactivar"
                            : "Activar"}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            )
          )
        )}
      </ScrollView>


      <Modal
        visible={
          modalFormulario
        }
        transparent
        animationType="slide"
        onRequestClose={
          cerrarFormulario
        }
      >
        <KeyboardAvoidingView
          style={
            styles.modalOverlay
          }
          behavior={
            Platform.OS ===
            "ios"
              ? "padding"
              : undefined
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.modalEyebrow
                  }
                >
                  {editandoId
                    ? "ACTUALIZAR"
                    : "NUEVO SERVICIO"}
                </Text>


                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  {editandoId
                    ? "Editar análisis"
                    : "Registrar análisis"}
                </Text>
              </View>


              <Pressable
                style={
                  styles.closeButton
                }
                onPress={
                  cerrarFormulario
                }
                disabled={
                  guardando
                }
              >
                <Text
                  style={
                    styles.closeText
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>


            <ScrollView
              contentContainerStyle={
                styles.formContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              <Campo
                label="Nombre *"
                value={
                  formulario.nombre
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "nombre",
                    valor
                  )
                }
                placeholder="Ej. Hemograma completo"
                editable={
                  !guardando
                }
              />


              <Campo
                label="Descripción *"
                value={
                  formulario.descripcion
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "descripcion",
                    valor
                  )
                }
                placeholder="Descripción del análisis"
                multiline
                editable={
                  !guardando
                }
              />


              <Campo
                label="Tipo *"
                value={
                  formulario.tipo
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "tipo",
                    valor
                  )
                }
                placeholder="Ej. Hematología"
                editable={
                  !guardando
                }
              />


              <Campo
                label="Precio *"
                value={
                  formulario.precio
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "precio",
                    valor
                  )
                }
                placeholder="Ej. 80"
                keyboardType="decimal-pad"
                editable={
                  !guardando
                }
              />


              <Campo
                label="Unidad general"
                value={
                  formulario.unidad
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampo(
                    "unidad",
                    valor
                  )
                }
                placeholder="Opcional"
                editable={
                  !guardando
                }
              />


              <View
                style={
                  styles.switchRow
                }
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={
                      styles.switchTitle
                    }
                  >
                    Disponible
                  </Text>


                  <Text
                    style={
                      styles.switchSubtitle
                    }
                  >
                    Permite usar este análisis dentro del catálogo.
                  </Text>
                </View>


                <Switch
                  value={
                    formulario.activo
                  }
                  onValueChange={(
                    valor
                  ) =>
                    cambiarCampo(
                      "activo",
                      valor
                    )
                  }
                  disabled={
                    guardando
                  }
                />
              </View>


              <View
                style={
                  styles.formActions
                }
              >
                <Pressable
                  style={
                    styles.cancelButton
                  }
                  onPress={
                    cerrarFormulario
                  }
                  disabled={
                    guardando
                  }
                >
                  <Text
                    style={
                      styles.cancelText
                    }
                  >
                    Cancelar
                  </Text>
                </Pressable>


                <Pressable
                  style={[
                    styles.saveButton,

                    guardando &&
                      styles.disabledButton,
                  ]}
                  onPress={
                    guardar
                  }
                  disabled={
                    guardando
                  }
                >
                  {guardando ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={
                        styles.saveText
                      }
                    >
                      {editandoId
                        ? "Guardar cambios"
                        : "Registrar"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      <Modal
        visible={
          modalParametros
        }
        transparent
        animationType="slide"
        onRequestClose={
          cerrarParametros
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.modalEyebrow
                  }
                >
                  PARÁMETROS
                </Text>


                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  {seleccionado?.nombre ||
                    "Análisis clínico"}
                </Text>


                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Define los valores que serán registrados posteriormente en los resultados.
                </Text>
              </View>


              <Pressable
                style={
                  styles.closeButton
                }
                onPress={
                  cerrarParametros
                }
                disabled={
                  guardando
                }
              >
                <Text
                  style={
                    styles.closeText
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>


            <View
              style={
                styles.parametersToolbar
              }
            >
              <Text
                style={
                  styles.parametersCount
                }
              >
                {seleccionado?.parametros.length ||
                  0} parámetro
                {(seleccionado?.parametros.length ||
                  0) ===
                1
                  ? ""
                  : "s"}
              </Text>


              <Pressable
                style={
                  styles.addParameterButton
                }
                onPress={
                  abrirNuevoParametro
                }
                disabled={
                  guardando
                }
              >
                <Text
                  style={
                    styles.addParameterText
                  }
                >
                  + Nuevo
                </Text>
              </Pressable>
            </View>


            <ScrollView
              contentContainerStyle={
                styles.parametersContent
              }
              showsVerticalScrollIndicator={
                false
              }
            >
              {!seleccionado ||
              seleccionado.parametros.length ===
                0 ? (
                <Vacio
                  icono="🧬"
                  titulo="Sin parámetros"
                  texto="Este análisis todavía no tiene parámetros registrados."
                />
              ) : (
                seleccionado.parametros.map(
                  (parametro) => (
                    <View
                      key={
                        parametro.parametroId
                      }
                      style={
                        styles.parameterCard
                      }
                    >
                      <View
                        style={
                          styles.parameterTop
                        }
                      >
                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            style={
                              styles.parameterName
                            }
                          >
                            {parametro.nombre}
                          </Text>


                          <Text
                            style={
                              styles.parameterUnit
                            }
                          >
                            Unidad:{" "}
                            {parametro.unidad}
                          </Text>


                          {parametro.descripcion ? (
                            <Text
                              style={
                                styles.parameterDescription
                              }
                            >
                              {parametro.descripcion}
                            </Text>
                          ) : null}


                          <View
                            style={
                              styles.rangePreview
                            }
                          >
                            <Text
                              style={
                                styles.rangePreviewLabel
                              }
                            >
                              Rango de referencia
                            </Text>


                            <Text
                              style={
                                styles.rangePreviewValue
                              }
                            >
                              {formatearRango(
                                parametro
                              )}
                            </Text>
                          </View>
                        </View>
                      </View>


                      <View
                        style={
                          styles.parameterActions
                        }
                      >
                        <Pressable
                          style={[
                            styles.parameterActionButton,
                            styles.rangeButton,
                          ]}
                          onPress={() =>
                            abrirRango(
                              parametro
                            )
                          }
                          disabled={
                            guardando
                          }
                        >
                          <Text
                            style={
                              styles.rangeButtonText
                            }
                          >
                            Rango
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.parameterActionButton,
                            styles.parameterEditButton,
                          ]}
                          onPress={() =>
                            abrirEditarParametro(
                              parametro
                            )
                          }
                          disabled={
                            guardando
                          }
                        >
                          <Text
                            style={
                              styles.parameterEditText
                            }
                          >
                            Editar
                          </Text>
                        </Pressable>


                        <Pressable
                          style={[
                            styles.parameterActionButton,
                            styles.parameterDeleteButton,
                          ]}
                          onPress={() =>
                            confirmarEliminarParametro(
                              parametro
                            )
                          }
                          disabled={
                            guardando
                          }
                        >
                          <Text
                            style={
                              styles.parameterDeleteText
                            }
                          >
                            Eliminar
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )
                )
              )}
            </ScrollView>


            <Pressable
              style={
                styles.closeDetailButton
              }
              onPress={
                cerrarParametros
              }
              disabled={
                guardando
              }
            >
              <Text
                style={
                  styles.closeDetailText
                }
              >
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>


      <Modal
        visible={
          modalParametro
        }
        transparent
        animationType="fade"
        onRequestClose={
          cerrarParametro
        }
      >
        <KeyboardAvoidingView
          style={
            styles.modalOverlay
          }
          behavior={
            Platform.OS ===
            "ios"
              ? "padding"
              : undefined
          }
        >
          <View
            style={[
              styles.modalCard,
              styles.parameterFormModal,
            ]}
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.modalEyebrow
                  }
                >
                  {editandoParametro
                    ? "ACTUALIZAR"
                    : "NUEVO PARÁMETRO"}
                </Text>


                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  {editandoParametro
                    ? "Editar parámetro"
                    : "Registrar parámetro"}
                </Text>
              </View>


              <Pressable
                style={
                  styles.closeButton
                }
                onPress={
                  cerrarParametro
                }
                disabled={
                  guardando
                }
              >
                <Text
                  style={
                    styles.closeText
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>


            <ScrollView
              contentContainerStyle={
                styles.formContent
              }
              keyboardShouldPersistTaps="handled"
            >
              <Campo
                label="Nombre *"
                value={
                  formularioParametro.nombre
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampoParametro(
                    "nombre",
                    valor
                  )
                }
                placeholder="Ej. Hemoglobina"
                editable={
                  !guardando
                }
              />


              <Campo
                label="Unidad *"
                value={
                  formularioParametro.unidad
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampoParametro(
                    "unidad",
                    valor
                  )
                }
                placeholder="Ej. g/dL, mg/dL, %"
                editable={
                  !guardando
                }
              />


              <Campo
                label="Descripción"
                value={
                  formularioParametro.descripcion
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampoParametro(
                    "descripcion",
                    valor
                  )
                }
                placeholder="Información adicional del parámetro"
                multiline
                editable={
                  !guardando
                }
              />


              <View
                style={
                  styles.formActions
                }
              >
                <Pressable
                  style={
                    styles.cancelButton
                  }
                  onPress={
                    cerrarParametro
                  }
                  disabled={
                    guardando
                  }
                >
                  <Text
                    style={
                      styles.cancelText
                    }
                  >
                    Cancelar
                  </Text>
                </Pressable>


                <Pressable
                  style={[
                    styles.saveButton,

                    guardando &&
                      styles.disabledButton,
                  ]}
                  onPress={
                    guardarParametro
                  }
                  disabled={
                    guardando
                  }
                >
                  {guardando ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={
                        styles.saveText
                      }
                    >
                      {editandoParametro
                        ? "Guardar cambios"
                        : "Registrar"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      <Modal
        visible={
          modalRango
        }
        transparent
        animationType="slide"
        onRequestClose={
          cerrarRango
        }
      >
        <KeyboardAvoidingView
          style={
            styles.modalOverlay
          }
          behavior={
            Platform.OS ===
            "ios"
              ? "padding"
              : undefined
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.modalEyebrow
                  }
                >
                  RANGO DE REFERENCIA
                </Text>


                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  {parametroSeleccionado?.nombre ||
                    "Parámetro"}
                </Text>


                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Unidad:{" "}
                  {parametroSeleccionado?.unidad ||
                    "Sin unidad"}
                </Text>
              </View>


              <Pressable
                style={
                  styles.closeButton
                }
                onPress={
                  cerrarRango
                }
                disabled={
                  guardando
                }
              >
                <Text
                  style={
                    styles.closeText
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>


            <ScrollView
              contentContainerStyle={
                styles.formContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              <Text
                style={
                  styles.fieldLabel
                }
              >
                Tipo de referencia
              </Text>


              <View
                style={
                  styles.rangeTypeRow
                }
              >
                <Pressable
                  style={[
                    styles.rangeTypeButton,

                    formularioRango.tipo ===
                      "numerico" &&
                      styles.rangeTypeButtonActive,
                  ]}
                  onPress={() =>
                    cambiarCampoRango(
                      "tipo",
                      "numerico"
                    )
                  }
                  disabled={
                    guardando
                  }
                >
                  <Text
                    style={[
                      styles.rangeTypeText,

                      formularioRango.tipo ===
                        "numerico" &&
                        styles.rangeTypeTextActive,
                    ]}
                  >
                    Numérico
                  </Text>
                </Pressable>


                <Pressable
                  style={[
                    styles.rangeTypeButton,

                    formularioRango.tipo ===
                      "texto" &&
                      styles.rangeTypeButtonActive,
                  ]}
                  onPress={() =>
                    cambiarCampoRango(
                      "tipo",
                      "texto"
                    )
                  }
                  disabled={
                    guardando
                  }
                >
                  <Text
                    style={[
                      styles.rangeTypeText,

                      formularioRango.tipo ===
                        "texto" &&
                        styles.rangeTypeTextActive,
                    ]}
                  >
                    Cualitativo
                  </Text>
                </Pressable>
              </View>


              {formularioRango.tipo ===
              "numerico" ? (
                <>
                  <Campo
                    label="Valor mínimo *"
                    value={
                      formularioRango.minimo
                    }
                    onChangeText={(
                      valor
                    ) =>
                      cambiarCampoRango(
                        "minimo",
                        valor
                      )
                    }
                    placeholder="Ej. 12"
                    keyboardType="decimal-pad"
                    editable={
                      !guardando
                    }
                  />


                  <Campo
                    label="Valor máximo *"
                    value={
                      formularioRango.maximo
                    }
                    onChangeText={(
                      valor
                    ) =>
                      cambiarCampoRango(
                        "maximo",
                        valor
                      )
                    }
                    placeholder="Ej. 16"
                    keyboardType="decimal-pad"
                    editable={
                      !guardando
                    }
                  />
                </>

              ) : (
                <Campo
                  label="Referencia cualitativa *"
                  value={
                    formularioRango.textoReferencia
                  }
                  onChangeText={(
                    valor
                  ) =>
                    cambiarCampoRango(
                      "textoReferencia",
                      valor
                    )
                  }
                  placeholder="Ej. Negativo, No reactivo"
                  editable={
                    !guardando
                  }
                />
              )}


              <Campo
                label="Observaciones"
                value={
                  formularioRango.observaciones
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarCampoRango(
                    "observaciones",
                    valor
                  )
                }
                placeholder="Información adicional"
                multiline
                editable={
                  !guardando
                }
              />


              <View
                style={
                  styles.formActions
                }
              >
                {parametroSeleccionado?.rangoReferencia && (
                  <Pressable
                    style={
                      styles.deleteRangeButton
                    }
                    onPress={
                      confirmarEliminarRango
                    }
                    disabled={
                      guardando
                    }
                  >
                    <Text
                      style={
                        styles.deleteRangeText
                      }
                    >
                      Eliminar rango
                    </Text>
                  </Pressable>
                )}


                <Pressable
                  style={[
                    styles.saveButton,

                    guardando &&
                      styles.disabledButton,
                  ]}
                  onPress={
                    guardarRango
                  }
                  disabled={
                    guardando
                  }
                >
                  {guardando ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={
                        styles.saveText
                      }
                    >
                      Guardar rango
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      <Modal
        visible={
          modalConfiguracion
        }
        transparent
        animationType="slide"
        onRequestClose={
          cerrarConfiguracion
        }
      >
        <KeyboardAvoidingView
          style={
            styles.modalOverlay
          }
          behavior={
            Platform.OS ===
            "ios"
              ? "padding"
              : undefined
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.modalEyebrow
                  }
                >
                  CONFIGURACIÓN
                </Text>


                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  {seleccionado?.nombre ||
                    "Análisis clínico"}
                </Text>
              </View>


              <Pressable
                style={
                  styles.closeButton
                }
                onPress={
                  cerrarConfiguracion
                }
                disabled={
                  guardando
                }
              >
                <Text
                  style={
                    styles.closeText
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>


            <ScrollView
              contentContainerStyle={
                styles.formContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              <Campo
                label="Tipo de muestra *"
                value={
                  configuracion.tipoMuestra
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarConfiguracion(
                    "tipoMuestra",
                    valor
                  )
                }
                placeholder="Ej. Sangre, orina, suero"
                editable={
                  !guardando
                }
              />


              <Campo
                label="Preparación del paciente"
                value={
                  configuracion.preparacionPaciente
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarConfiguracion(
                    "preparacionPaciente",
                    valor
                  )
                }
                placeholder="Indicaciones previas para el paciente"
                multiline
                editable={
                  !guardando
                }
              />


              <View
                style={
                  styles.switchRow
                }
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={
                      styles.switchTitle
                    }
                  >
                    Requiere ayuno
                  </Text>


                  <Text
                    style={
                      styles.switchSubtitle
                    }
                  >
                    Activa esta opción si el paciente debe cumplir ayuno.
                  </Text>
                </View>


                <Switch
                  value={
                    configuracion.requiereAyuno
                  }
                  onValueChange={(
                    valor
                  ) =>
                    cambiarConfiguracion(
                      "requiereAyuno",
                      valor
                    )
                  }
                  disabled={
                    guardando
                  }
                />
              </View>


              {configuracion.requiereAyuno && (
                <Campo
                  label="Horas de ayuno *"
                  value={
                    String(
                      configuracion.horasAyuno ||
                      ""
                    )
                  }
                  onChangeText={(
                    valor
                  ) =>
                    cambiarConfiguracion(
                      "horasAyuno",
                      valor ===
                        ""
                        ? 0
                        : Number(
                            valor.replace(
                              ",",
                              "."
                            )
                          )
                    )
                  }
                  placeholder="Ej. 8"
                  keyboardType="decimal-pad"
                  editable={
                    !guardando
                  }
                />
              )}


              <Campo
                label="Tiempo de entrega *"
                value={
                  configuracion.tiempoEntrega
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarConfiguracion(
                    "tiempoEntrega",
                    valor
                  )
                }
                placeholder="Ej. 24 horas"
                editable={
                  !guardando
                }
              />


              <Campo
                label="Instrucciones"
                value={
                  configuracion.instrucciones
                }
                onChangeText={(
                  valor
                ) =>
                  cambiarConfiguracion(
                    "instrucciones",
                    valor
                  )
                }
                placeholder="Instrucciones para el procesamiento"
                multiline
                editable={
                  !guardando
                }
              />


              <View
                style={
                  styles.formActions
                }
              >
                <Pressable
                  style={
                    styles.cancelButton
                  }
                  onPress={
                    cerrarConfiguracion
                  }
                  disabled={
                    guardando
                  }
                >
                  <Text
                    style={
                      styles.cancelText
                    }
                  >
                    Cancelar
                  </Text>
                </Pressable>


                <Pressable
                  style={[
                    styles.saveButton,

                    guardando &&
                      styles.disabledButton,
                  ]}
                  onPress={
                    guardarConfiguracion
                  }
                  disabled={
                    guardando
                  }
                >
                  {guardando ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={
                        styles.saveText
                      }
                    >
                      Guardar configuración
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      <Modal
        visible={
          modalDetalle
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setModalDetalle(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={[
              styles.modalCard,
              styles.detailModal,
            ]}
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.modalEyebrow
                  }
                >
                  DETALLE
                </Text>


                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Información del análisis
                </Text>
              </View>


              <Pressable
                style={
                  styles.closeButton
                }
                onPress={() =>
                  setModalDetalle(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.closeText
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>


            {seleccionado && (
              <ScrollView
                contentContainerStyle={
                  styles.detailContent
                }
                showsVerticalScrollIndicator={
                  false
                }
              >
                <View
                  style={
                    styles.detailHero
                  }
                >
                  <Text
                    style={
                      styles.detailHeroIcon
                    }
                  >
                    🧪
                  </Text>


                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.detailName
                      }
                    >
                      {seleccionado.nombre}
                    </Text>


                    <Text
                      style={
                        styles.detailType
                      }
                    >
                      {seleccionado.tipo}
                    </Text>
                  </View>
                </View>


                <Detalle
                  label="Descripción"
                  value={
                    seleccionado.descripcion
                  }
                />


                <Detalle
                  label="Precio"
                  value={`Bs ${seleccionado.precio.toFixed(
                    2
                  )}`}
                />


                <Detalle
                  label="Unidad general"
                  value={
                    seleccionado.unidad ||
                    "Sin información"
                  }
                />


                <Detalle
                  label="Estado"
                  value={
                    seleccionado.activo
                      ? "Activo"
                      : "Inactivo"
                  }
                />


                <Detalle
                  label="Tipo de muestra"
                  value={
                    seleccionado.configuracion.tipoMuestra ||
                    "Sin configurar"
                  }
                />


                <Detalle
                  label="Tiempo de entrega"
                  value={
                    seleccionado.configuracion.tiempoEntrega ||
                    "Sin configurar"
                  }
                />


                <Detalle
                  label="Ayuno"
                  value={
                    seleccionado.configuracion.requiereAyuno
                      ? `${seleccionado.configuracion.horasAyuno} hora(s)`
                      : "No requiere"
                  }
                />


                <Detalle
                  label="Identificador"
                  value={
                    seleccionado.analisisId
                  }
                />


                <Pressable
                  style={
                    styles.closeDetailButton
                  }
                  onPress={() =>
                    setModalDetalle(
                      false
                    )
                  }
                >
                  <Text
                    style={
                      styles.closeDetailText
                    }
                  >
                    Cerrar
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


function Estadistica({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <View
      style={
        styles.statCard
      }
    >
      <Text
        style={
          styles.statLabel
        }
      >
        {titulo}
      </Text>


      <Text
        style={
          styles.statValue
        }
      >
        {valor}
      </Text>
    </View>
  );
}


type CampoProps = {
  label: string;
  value: string;
  onChangeText:
    (
      valor: string
    ) => void;
  placeholder: string;
  keyboardType?:
    | "default"
    | "decimal-pad";
  multiline?: boolean;
  editable?: boolean;
};


function Campo({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType =
    "default",
  multiline = false,
  editable = true,
}: CampoProps) {
  return (
    <View
      style={
        styles.field
      }
    >
      <Text
        style={
          styles.fieldLabel
        }
      >
        {label}
      </Text>


      <TextInput
        style={[
          styles.input,

          multiline &&
            styles.textArea,
        ]}
        value={
          value
        }
        onChangeText={
          onChangeText
        }
        placeholder={
          placeholder
        }
        placeholderTextColor="#94A3B8"
        keyboardType={
          keyboardType
        }
        multiline={
          multiline
        }
        textAlignVertical={
          multiline
            ? "top"
            : "center"
        }
        editable={
          editable
        }
      />
    </View>
  );
}


function Detalle({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.detailItem
      }
    >
      <Text
        style={
          styles.detailLabel
        }
      >
        {label}
      </Text>


      <Text
        style={
          styles.detailValue
        }
      >
        {value}
      </Text>
    </View>
  );
}


function Vacio({
  icono,
  titulo,
  texto,
}: {
  icono: string;
  titulo: string;
  texto: string;
}) {
  return (
    <View
      style={
        styles.emptyCard
      }
    >
      <Text
        style={
          styles.emptyIcon
        }
      >
        {icono}
      </Text>


      <Text
        style={
          styles.emptyTitle
        }
      >
        {titulo}
      </Text>


      <Text
        style={
          styles.emptyText
        }
      >
        {texto}
      </Text>
    </View>
  );
}


function formatearRango(
  parametro:
    ParametroAnalisis
): string {
  const rango =
    parametro.rangoReferencia;


  if (!rango) {
    return "Sin rango registrado";
  }


  if (
    rango.tipo ===
    "texto"
  ) {
    return rango.textoReferencia ||
      "Sin referencia";
  }


  if (
    rango.minimo ===
      null ||
    rango.maximo ===
      null
  ) {
    return "Rango incompleto";
  }


  return `${rango.minimo} - ${rango.maximo}${
    parametro.unidad
      ? ` ${parametro.unidad}`
      : ""
  }`;
}


function pedirConfirmacion(
  titulo: string,
  mensaje: string,
  textoConfirmar: string,
  destructivo: boolean,
  onConfirmar:
    () => void | Promise<void>
) {
  if (
    Platform.OS ===
    "web"
  ) {
    const confirmarWeb =
      (
        globalThis as
          typeof globalThis & {
            confirm?: (
              mensaje?: string
            ) => boolean;
          }
      ).confirm;


    const confirmado =
      typeof confirmarWeb ===
        "function"
        ? confirmarWeb(
            `${titulo}\n\n${mensaje}`
          )
        : true;


    if (confirmado) {
      void onConfirmar();
    }


    return;
  }


  Alert.alert(
    titulo,
    mensaje,
    [
      {
        text:
          "Cancelar",

        style:
          "cancel",
      },

      {
        text:
          textoConfirmar,

        style:
          destructivo
            ? "destructive"
            : "default",

        onPress:
          () => {
            void onConfirmar();
          },
      },
    ]
  );
}


function normalizarTexto(
  valor: unknown
): string {
  return String(
    valor ??
    ""
  )
    .trim()
    .toLocaleLowerCase(
      "es"
    )
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}


function mensajeError(
  error: unknown,
  defecto: string
): string {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }


  return defecto;
}


const styles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor:
        "#F8FAFC",
    },

    content: {
      padding: 16,
      paddingBottom: 45,
    },

    loadingPage: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      padding: 24,
      backgroundColor:
        "#F8FAFC",
    },

    loadingTitle: {
      marginTop: 14,
      color: "#0F172A",
      fontSize: 22,
      fontWeight: "900",
    },

    loadingText: {
      marginTop: 5,
      color: "#64748B",
      fontSize: 12,
    },

    header: {
      padding: 18,
      borderRadius: 20,
      backgroundColor:
        "#ECFEFF",
      borderWidth: 1,
      borderColor:
        "#A5F3FC",
      marginBottom: 13,
    },

    backButton: {
      alignSelf:
        "flex-start",
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 9,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#CFFAFE",
      marginBottom: 16,
    },

    backText: {
      color: "#475569",
      fontSize: 12,
      fontWeight: "800",
    },

    headerRow: {
      flexDirection: "row",
      alignItems:
        "flex-end",
      gap: 12,
    },

    eyebrow: {
      color: "#0E7490",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },

    title: {
      marginTop: 4,
      color: "#0F172A",
      fontSize: 27,
      fontWeight: "900",
    },

    subtitle: {
      marginTop: 6,
      color: "#64748B",
      fontSize: 12,
      lineHeight: 18,
    },

    newButton: {
      backgroundColor:
        "#0E7490",
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },

    newButtonText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
    },

    statsRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 13,
    },

    statCard: {
      flex: 1,
      minHeight: 76,
      padding: 11,
      borderRadius: 13,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      justifyContent:
        "center",
    },

    statLabel: {
      color: "#64748B",
      fontSize: 8,
      fontWeight: "900",
    },

    statValue: {
      marginTop: 4,
      color: "#0F172A",
      fontSize: 20,
      fontWeight: "900",
    },

    searchCard: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#CFFAFE",
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
    },

    searchTitle: {
      color: "#0F172A",
      fontSize: 14,
      fontWeight: "900",
      marginBottom: 9,
    },

    searchInput: {
      minHeight: 45,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      color: "#0F172A",
      backgroundColor:
        "#FFFFFF",
      fontSize: 12,
    },

    resultText: {
      marginTop: 7,
      color: "#0E7490",
      fontSize: 9,
      fontWeight: "800",
    },

    listTitle: {
      color: "#0F172A",
      fontSize: 18,
      fontWeight: "900",
      marginBottom: 9,
    },

    analysisCard: {
      padding: 14,
      borderRadius: 16,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      marginBottom: 10,
    },

    analysisTop: {
      flexDirection: "row",
      alignItems:
        "flex-start",
      gap: 11,
    },

    iconBox: {
      width: 47,
      height: 47,
      borderRadius: 13,
      backgroundColor:
        "#CFFAFE",
      alignItems: "center",
      justifyContent:
        "center",
    },

    iconText: {
      fontSize: 21,
    },

    nameRow: {
      flexDirection: "row",
      alignItems:
        "flex-start",
      justifyContent:
        "space-between",
      gap: 8,
    },

    analysisName: {
      flex: 1,
      color: "#0F172A",
      fontSize: 14,
      fontWeight: "900",
    },

    analysisType: {
      marginTop: 3,
      color: "#0E7490",
      fontSize: 10,
      fontWeight: "800",
    },

    analysisDescription: {
      marginTop: 5,
      color: "#64748B",
      fontSize: 10,
      lineHeight: 15,
    },

    status: {
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 20,
    },

    statusActive: {
      backgroundColor:
        "#DCFCE7",
    },

    statusInactive: {
      backgroundColor:
        "#FEE2E2",
    },

    statusText: {
      fontSize: 8,
      fontWeight: "900",
    },

    statusTextActive: {
      color: "#15803D",
    },

    statusTextInactive: {
      color: "#B91C1C",
    },

    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor:
        "#F1F5F9",
    },

    priceLabel: {
      color: "#64748B",
      fontSize: 9,
      fontWeight: "800",
    },

    priceValue: {
      color: "#0F172A",
      fontSize: 12,
      fontWeight: "900",
    },

    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      marginTop: 11,
    },

    actionButton: {
      flexGrow: 1,
      flexBasis: "47%",
      minHeight: 37,
      borderRadius: 9,
      alignItems: "center",
      justifyContent:
        "center",
      paddingHorizontal: 6,
    },

    detailButton: {
      backgroundColor:
        "#E0F2FE",
    },

    detailButtonText: {
      color: "#0369A1",
      fontSize: 9,
      fontWeight: "900",
    },

    configButton: {
      backgroundColor:
        "#CCFBF1",
    },

    configButtonText: {
      color: "#0F766E",
      fontSize: 9,
      fontWeight: "900",
    },

    parametersButton: {
      backgroundColor:
        "#FEF3C7",
    },

    parametersButtonText: {
      color: "#A16207",
      fontSize: 9,
      fontWeight: "900",
    },

    editButton: {
      backgroundColor:
        "#EDE9FE",
    },

    editButtonText: {
      color: "#6D28D9",
      fontSize: 9,
      fontWeight: "900",
    },

    disableButton: {
      backgroundColor:
        "#FEE2E2",
    },

    enableButton: {
      backgroundColor:
        "#DCFCE7",
    },

    stateButtonText: {
      fontSize: 9,
      fontWeight: "900",
    },

    disableButtonText: {
      color: "#B91C1C",
    },

    enableButtonText: {
      color: "#15803D",
    },

    emptyCard: {
      padding: 26,
      borderRadius: 15,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      alignItems: "center",
    },

    emptyIcon: {
      fontSize: 31,
    },

    emptyTitle: {
      marginTop: 7,
      color: "#334155",
      fontSize: 15,
      fontWeight: "900",
    },

    emptyText: {
      marginTop: 4,
      color: "#64748B",
      fontSize: 10,
      lineHeight: 16,
      textAlign: "center",
    },

    modalOverlay: {
      flex: 1,
      justifyContent:
        "center",
      padding: 14,
      backgroundColor:
        "rgba(15, 23, 42, 0.68)",
    },

    modalCard: {
      maxHeight: "94%",
      padding: 17,
      borderRadius: 20,
      backgroundColor:
        "#F8FAFC",
    },

    detailModal: {
      maxHeight: "82%",
    },

    modalHeader: {
      flexDirection: "row",
      alignItems:
        "flex-start",
      gap: 10,
      paddingBottom: 13,
      borderBottomWidth: 1,
      borderBottomColor:
        "#E2E8F0",
    },

    modalEyebrow: {
      color: "#0E7490",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },

    modalTitle: {
      marginTop: 3,
      color: "#0F172A",
      fontSize: 20,
      fontWeight: "900",
    },

    modalSubtitle: {
      marginTop: 5,
      color: "#64748B",
      fontSize: 10,
      lineHeight: 15,
    },

    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#E2E8F0",
    },

    closeText: {
      color: "#475569",
      fontSize: 23,
      fontWeight: "700",
      lineHeight: 25,
    },

    formContent: {
      paddingTop: 15,
      paddingBottom: 6,
    },

    field: {
      marginBottom: 12,
    },

    fieldLabel: {
      color: "#334155",
      fontSize: 11,
      fontWeight: "800",
      marginBottom: 6,
    },

    input: {
      minHeight: 46,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
      borderRadius: 11,
      backgroundColor:
        "#FFFFFF",
      paddingHorizontal: 12,
      color: "#0F172A",
      fontSize: 12,
    },

    textArea: {
      minHeight: 88,
      paddingTop: 12,
      paddingBottom: 12,
    },

    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 13,
      borderRadius: 12,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      marginBottom: 13,
    },

    switchTitle: {
      color: "#334155",
      fontSize: 11,
      fontWeight: "900",
    },

    switchSubtitle: {
      marginTop: 2,
      color: "#64748B",
      fontSize: 9,
      lineHeight: 14,
    },

    formActions: {
      flexDirection: "row",
      gap: 9,
      marginTop: 5,
    },

    cancelButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
    },

    cancelText: {
      color: "#475569",
      fontSize: 10,
      fontWeight: "900",
    },

    saveButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#0E7490",
    },

    saveText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
    },

    disabledButton: {
      opacity: 0.6,
    },

    parametersToolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 10,
      paddingVertical: 12,
    },

    parametersCount: {
      color: "#64748B",
      fontSize: 10,
      fontWeight: "800",
    },

    addParameterButton: {
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 9,
      backgroundColor:
        "#0E7490",
    },

    addParameterText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
    },

    parametersContent: {
      paddingBottom: 8,
    },

    parameterCard: {
      padding: 12,
      borderRadius: 12,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      marginBottom: 9,
    },

    parameterTop: {
      flexDirection: "row",
      alignItems:
        "flex-start",
    },

    parameterName: {
      color: "#0F172A",
      fontSize: 13,
      fontWeight: "900",
    },

    parameterUnit: {
      marginTop: 3,
      color: "#0E7490",
      fontSize: 10,
      fontWeight: "800",
    },

    parameterDescription: {
      marginTop: 5,
      color: "#64748B",
      fontSize: 10,
      lineHeight: 15,
    },

    rangePreview: {
      marginTop: 9,
      padding: 9,
      borderRadius: 9,
      backgroundColor:
        "#F8FAFC",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
    },

    rangePreviewLabel: {
      color: "#64748B",
      fontSize: 8,
      fontWeight: "900",
      textTransform:
        "uppercase",
    },

    rangePreviewValue: {
      marginTop: 3,
      color: "#0F172A",
      fontSize: 10,
      fontWeight: "800",
    },

    parameterActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
    },

    parameterActionButton: {
      flex: 1,
      minHeight: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent:
        "center",
    },

    rangeButton: {
      backgroundColor:
        "#DBEAFE",
    },

    rangeButtonText: {
      color: "#1D4ED8",
      fontSize: 9,
      fontWeight: "900",
    },

    parameterEditButton: {
      backgroundColor:
        "#EDE9FE",
    },

    parameterEditText: {
      color: "#6D28D9",
      fontSize: 9,
      fontWeight: "900",
    },

    parameterDeleteButton: {
      backgroundColor:
        "#FEE2E2",
    },

    parameterDeleteText: {
      color: "#B91C1C",
      fontSize: 9,
      fontWeight: "900",
    },

    parameterFormModal: {
      maxHeight: "78%",
    },

    rangeTypeRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 13,
    },

    rangeTypeButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 9,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#F1F5F9",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
    },

    rangeTypeButtonActive: {
      backgroundColor:
        "#DBEAFE",
      borderColor:
        "#93C5FD",
    },

    rangeTypeText: {
      color: "#475569",
      fontSize: 10,
      fontWeight: "800",
    },

    rangeTypeTextActive: {
      color: "#1D4ED8",
    },

    deleteRangeButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#FEE2E2",
    },

    deleteRangeText: {
      color: "#B91C1C",
      fontSize: 10,
      fontWeight: "900",
    },

    detailContent: {
      paddingTop: 15,
      paddingBottom: 5,
    },

    detailHero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      padding: 13,
      borderRadius: 14,
      backgroundColor:
        "#ECFEFF",
      borderWidth: 1,
      borderColor:
        "#A5F3FC",
      marginBottom: 10,
    },

    detailHeroIcon: {
      fontSize: 29,
    },

    detailName: {
      color: "#0F172A",
      fontSize: 15,
      fontWeight: "900",
    },

    detailType: {
      marginTop: 3,
      color: "#0E7490",
      fontSize: 10,
      fontWeight: "800",
    },

    detailItem: {
      padding: 12,
      borderRadius: 11,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      marginBottom: 8,
    },

    detailLabel: {
      color: "#64748B",
      fontSize: 8,
      fontWeight: "900",
      textTransform:
        "uppercase",
    },

    detailValue: {
      marginTop: 4,
      color: "#0F172A",
      fontSize: 11,
      lineHeight: 17,
      fontWeight: "600",
    },

    closeDetailButton: {
      minHeight: 44,
      marginTop: 6,
      borderRadius: 10,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#0E7490",
    },

    closeDetailText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
    },
  });
