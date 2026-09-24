import "./SuperAdminModules.css";

function SuperAdminAuditoria({
  volver,
}) {
  return (
    <div className="sam-page">

      <header className="sam-header">

        <div>

          <button
            type="button"
            className="sam-back"
            onClick={volver}
          >
            ← Dashboard
          </button>

          <span className="sam-eyebrow">
            SEGURIDAD
          </span>

          <h1>
            Auditoría Global
          </h1>

          <p>
            Monitoreo general de las actividades
            realizadas dentro del sistema.
          </p>

        </div>

      </header>


      <section className="sam-empty sam-coming">

        <div className="sam-empty-icon">
          📋
        </div>

        <h2>
          Auditoría Global
        </h2>

        <p>
          La interfaz está preparada. La conexión
          con la colección de auditoría se realizará
          cuando hagamos las correcciones de
          seguridad correspondientes.
        </p>

        <button
          type="button"
          className="sam-primary"
          onClick={volver}
        >
          Volver al Dashboard
        </button>

      </section>

    </div>
  );
}

export default SuperAdminAuditoria;