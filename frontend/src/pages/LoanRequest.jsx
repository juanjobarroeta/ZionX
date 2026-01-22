import React, { useState } from "react";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const initialFormState = {
  // Referencias Personales
  referencia1Nombre: "",
  referencia1Apellido: "",
  referencia1Telefono: "",
  referencia2Nombre: "",
  referencia2Apellido: "",
  referencia2Telefono: "",
  // Información Laboral del Aval
  avalEmpresaNombre: "",
  avalTelefonoLaboral: "",
  avalCalleEmpresa1: "",
  avalCalleEmpresa2: "",
  avalCiudadEmpresa: "",
  avalEstadoEmpresa: "",
  avalCPTrabajo: "",
  avalOcupacion: "",
  avalAntiguedad: "",
  avalFrecuenciaPago: "",
  avalMonto: "",
  fecha: "",
  nombreAsesor: "",
  sucursal: "",
  // New fields:
  productoInteres: "",
  enganche: "",
  numeroSemanas: "",
  // Información del Acreditado
  acreditadoNombre: "",
  acreditadoApellido: "",
  acreditadoNacimiento: "",
  acreditadoEstadoCivil: "",
  telefonoAcreditado: "",
  telefonoRecados: "",
  telefono: "",
  ocupacion: "",
  antiguedad: "",
  frecuenciaPago: "",
  monto: "",
  calificacion: 0,
  comoCobrarMoroso: "",
  observaciones: "",
  infoGeneralCliente: "",
  // Domicilio Acreditado
  domicilioCalle1: "",
  domicilioCalle2: "",
  domicilioCiudad: "",
  domicilioEstado: "",
  domicilioCP: "",
  tipoVivienda: "",
  descripcionVivienda: "",
  // Información Laboral del Acreditado
  empresaNombre: "",
  telefonoLaboral: "",
  empresaCalle1: "",
  empresaCalle2: "",
  empresaCiudad: "",
  empresaEstado: "",
  empresaCP: "",
  // Información Laboral Pareja del Acreditado
  parejaEmpresaNombre: "",
  parejaTelefonoLaboral: "",
  parejaCalle1: "",
  parejaCalle2: "",
  parejaCiudad: "",
  parejaEstado: "",
  parejaCP: "",
  parejaOcupacion: "",
  parejaAntiguedad: "",
  parejaFrecuenciaPago: "",
  parejaMonto: "",
  // Información Pareja del Acreditado
  parejaNombre: "",
  parejaApellido: "",
  parejaNacimiento: "",
  telefonoPareja: "",
  // Dependientes Económicos
  numDependientes: "",
  dependienteNombre: "",
  dependienteApellido: "",
  dependienteTelefono: "",
  dependienteCalle1: "",
  dependienteCalle2: "",
  dependienteCiudad: "",
  dependienteEstado: "",
  dependienteCP: "",
  // Información Aval del Acreditado
  avalNombre: "",
  avalApellido: "",
  avalNacimiento: "",
  avalEstadoCivil: "",
  avalTelefono: "",
  avalTelefonoRecados: "",
  // Domicilio Aval del Acreditado
  avalCalle1: "",
  avalCalle2: "",
  avalCiudad: "",
  avalEstado: "",
  avalCP: "",
  avalTipoVivienda: "",
  avalDescripcionVivienda: "",
  avalCreditosActuales: "",
  avalDescripcionCreditos: "",
  // FINAL SECTION
  documentChecklist: [],
};

const asesores = [
  { value: "", label: "Seleccione un asesor" },
  { value: "asesor1", label: "Asesor 1" },
  { value: "asesor2", label: "Asesor 2" },
];
const sucursales = [
  { value: "", label: "Seleccione una sucursal" },
  { value: "Atlixco", label: "Atlixco" },
  { value: "Cholula", label: "Cholula" },
  { value: "Chipilo", label: "Chipilo" },
];

function LoanRequest() {
  console.log("🔍 LoanRequest mounted");
  const [form, setForm] = useState(initialFormState);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCalificacion = (valor) => {
    setForm((prev) => ({
      ...prev,
      calificacion: valor,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/investigations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        alert("Investigación enviada correctamente.");
        setForm(initialFormState);
      } else {
        alert("Error al enviar la investigación.");
      }
    } catch (error) {
      alert("Error de red al enviar la investigación.");
    }
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto p-6">
        <h2 className="text-center text-xl font-bold mb-6">Investigación de Crédito</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Fecha:</label>
            <input
              type="date"
              name="fecha"
              value={form.fecha}
              onChange={handleChange}
              required
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Nombre Asesor:</label>
            <select
              name="nombreAsesor"
              value={form.nombreAsesor}
              onChange={handleChange}
              required
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
            >
              {asesores.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Sucursal:</label>
            <select
              name="sucursal"
              value={form.sucursal}
              onChange={handleChange}
              required
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
            >
              {sucursales.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {/* New fields after Sucursal */}
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Producto de interés:</label>
            <input
              type="text"
              name="productoInteres"
              value={form.productoInteres}
              onChange={handleChange}
              required
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Enganche:</label>
            <input
              type="number"
              name="enganche"
              value={form.enganche}
              onChange={handleChange}
              placeholder="Por ej., 2000"
              required
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Número de semanas y monto semanal:</label>
            <input
              type="text"
              name="numeroSemanas"
              value={form.numeroSemanas}
              onChange={handleChange}
              placeholder="Por ej., 16 semanas de $500"
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
            />
          </div>
          {/* Información del Acreditado */}
          <hr className="border-green-500 my-2" />
          <div className="font-semibold text-green-700 text-lg mb-2">Información del Acreditado</div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Nombre(s):</label>
            <input
              type="text"
              name="acreditadoNombre"
              value={form.acreditadoNombre}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Nombre(s) del acreditado"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Apellido(s):</label>
            <input
              type="text"
              name="acreditadoApellido"
              value={form.acreditadoApellido}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Apellido(s) del acreditado"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Fecha de nacimiento:</label>
            <input
              type="date"
              name="acreditadoNacimiento"
              value={form.acreditadoNacimiento}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Estado civil:</label>
            <input
              type="text"
              name="acreditadoEstadoCivil"
              value={form.acreditadoEstadoCivil}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ej: Soltero, Casado"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Teléfono del acreditado:</label>
            <input
              type="tel"
              name="telefonoAcreditado"
              value={form.telefonoAcreditado}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Teléfono principal"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Teléfono de recados:</label>
            <input
              type="tel"
              name="telefonoRecados"
              value={form.telefonoRecados}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Otro teléfono de contacto"
            />
          </div>
        
          {/* Domicilio Acreditado Section */}
          <hr className="border-green-500 my-2" />
          <div className="font-semibold text-green-700 text-lg mb-2">Domicilio Acreditado</div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 1:</label>
            <input
              type="text"
              name="domicilioCalle1"
              value={form.domicilioCalle1}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle principal"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 2:</label>
            <input
              type="text"
              name="domicilioCalle2"
              value={form.domicilioCalle2}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle secundaria"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Ciudad:</label>
            <input
              type="text"
              name="domicilioCiudad"
              value={form.domicilioCiudad}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ciudad"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Estado:</label>
            <input
              type="text"
              name="domicilioEstado"
              value={form.domicilioEstado}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Estado"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Código Postal:</label>
            <input
              type="text"
              name="domicilioCP"
              value={form.domicilioCP}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Código postal"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Tipo de Vivienda:</label>
            <input
              type="text"
              name="tipoVivienda"
              value={form.tipoVivienda}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ej: Casa, Departamento"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Descripción de la Vivienda:</label>
            <textarea
              name="descripcionVivienda"
              value={form.descripcionVivienda}
              onChange={handleChange}
              rows={4}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none text-neutral-800"
              placeholder="Descripción detallada de la vivienda"
            />
          </div>
          {/* Información Laboral del Acreditado */}
          <hr className="border-green-500 my-2" />
          <div className="font-semibold text-green-700 text-lg mb-2">Información Laboral del Acreditado</div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Nombre de la empresa:</label>
            <input
              type="text"
              name="empresaNombre"
              value={form.empresaNombre}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Nombre de la empresa"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Teléfono laboral:</label>
            <input
              type="tel"
              name="telefonoLaboral"
              value={form.telefonoLaboral}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Teléfono laboral"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 1 de la empresa:</label>
            <input
              type="text"
              name="empresaCalle1"
              value={form.empresaCalle1}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle principal de la empresa"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 2 de la empresa:</label>
            <input
              type="text"
              name="empresaCalle2"
              value={form.empresaCalle2}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle secundaria de la empresa"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Ciudad de la empresa:</label>
            <input
              type="text"
              name="empresaCiudad"
              value={form.empresaCiudad}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ciudad de la empresa"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Estado de la empresa:</label>
            <input
              type="text"
              name="empresaEstado"
              value={form.empresaEstado}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Estado de la empresa"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Código Postal de la empresa:</label>
            <input
              type="text"
              name="empresaCP"
              value={form.empresaCP}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Código postal de la empresa"
            />
          </div>
          {/* --- NUEVOS CAMPOS: Ocupación, Antigüedad, Frecuencia de Pago, Monto --- */}
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Ocupación:</label>
            <input
              type="text"
              name="ocupacion"
              value={form.ocupacion}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ocupación actual"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Antigüedad en el empleo (años/meses):</label>
            <input
              type="text"
              name="antiguedad"
              value={form.antiguedad}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Por ejemplo: 2 años, 8 meses"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Frecuencia de pago:</label>
            <input
              type="text"
              name="frecuenciaPago"
              value={form.frecuenciaPago}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ej: Semanal, Quincenal, Mensual"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Monto percibido:</label>
            <input
              type="number"
              name="monto"
              value={form.monto}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Monto recibido"
            />
          </div>
          {/* === Part 2 & Part 3: Otros Ingresos y Créditos === */}
          <hr className="border-green-500 my-2" />
          <div className="font-semibold text-green-700 text-lg mb-2">Otros Ingresos y Créditos</div>
          {/* Otros Ingresos */}
          <div className="flex flex-col mb-3">
            <label className="mb-1 font-semibold">Otros ingresos:</label>
            <textarea
              name="otrosIngresos"
              value={form.otrosIngresos || ""}
              onChange={handleChange}
              rows={3}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none text-neutral-800"
              placeholder="Describe otros ingresos aparte del principal"
            />
          </div>
          {/* Créditos actuales */}
          <div className="flex flex-col mb-3">
            <label className="mb-1 font-semibold">Créditos actuales:</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="creditosActuales"
                  value="tarjetaCredito"
                  checked={form.creditosActuales?.includes("tarjetaCredito") || false}
                  onChange={e => {
                    const checked = e.target.checked;
                    setForm(prev => {
                      const prevArr = Array.isArray(prev.creditosActuales) ? prev.creditosActuales : [];
                      if (checked) {
                        return { ...prev, creditosActuales: [...prevArr, "tarjetaCredito"] };
                      } else {
                        return { ...prev, creditosActuales: prevArr.filter(c => c !== "tarjetaCredito") };
                      }
                    });
                  }}
                />
                Tarjeta de crédito
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="creditosActuales"
                  value="creditoPersonal"
                  checked={form.creditosActuales?.includes("creditoPersonal") || false}
                  onChange={e => {
                    const checked = e.target.checked;
                    setForm(prev => {
                      const prevArr = Array.isArray(prev.creditosActuales) ? prev.creditosActuales : [];
                      if (checked) {
                        return { ...prev, creditosActuales: [...prevArr, "creditoPersonal"] };
                      } else {
                        return { ...prev, creditosActuales: prevArr.filter(c => c !== "creditoPersonal") };
                      }
                    });
                  }}
                />
                Crédito personal
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="creditosActuales"
                  value="creditoAutomotriz"
                  checked={form.creditosActuales?.includes("creditoAutomotriz") || false}
                  onChange={e => {
                    const checked = e.target.checked;
                    setForm(prev => {
                      const prevArr = Array.isArray(prev.creditosActuales) ? prev.creditosActuales : [];
                      if (checked) {
                        return { ...prev, creditosActuales: [...prevArr, "creditoAutomotriz"] };
                      } else {
                        return { ...prev, creditosActuales: prevArr.filter(c => c !== "creditoAutomotriz") };
                      }
                    });
                  }}
                />
                Crédito automotriz
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="creditosActuales"
                  value="creditoHipotecario"
                  checked={form.creditosActuales?.includes("creditoHipotecario") || false}
                  onChange={e => {
                    const checked = e.target.checked;
                    setForm(prev => {
                      const prevArr = Array.isArray(prev.creditosActuales) ? prev.creditosActuales : [];
                      if (checked) {
                        return { ...prev, creditosActuales: [...prevArr, "creditoHipotecario"] };
                      } else {
                        return { ...prev, creditosActuales: prevArr.filter(c => c !== "creditoHipotecario") };
                      }
                    });
                  }}
                />
                Crédito hipotecario
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="creditosActuales"
                  value="otros"
                  checked={form.creditosActuales?.includes("otros") || false}
                  onChange={e => {
                    const checked = e.target.checked;
                    setForm(prev => {
                      const prevArr = Array.isArray(prev.creditosActuales) ? prev.creditosActuales : [];
                      if (checked) {
                        return { ...prev, creditosActuales: [...prevArr, "otros"] };
                      } else {
                        return { ...prev, creditosActuales: prevArr.filter(c => c !== "otros") };
                      }
                    });
                  }}
                />
                Otros
              </label>
            </div>
          </div>
          {/* Descripción de los créditos */}
          <div className="flex flex-col mb-3">
            <label className="mb-1 font-semibold">Descripción de créditos actuales:</label>
            <textarea
              name="descripcionCreditos"
              value={form.descripcionCreditos || ""}
              onChange={handleChange}
              rows={3}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none text-neutral-800"
              placeholder="Describe los créditos actuales, montos, instituciones, etc."
            />
          </div>
          {/* Información Pareja del Acreditado */}
          <hr className="border-green-500 my-2" />
          <div className="font-semibold text-green-700 text-lg mb-2">Información Pareja del Acreditado</div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Nombre(s) de la pareja:</label>
            <input
              type="text"
              name="parejaNombre"
              value={form.parejaNombre}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Nombre(s) de la pareja"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Apellido(s) de la pareja:</label>
            <input
              type="text"
              name="parejaApellido"
              value={form.parejaApellido}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Apellido(s) de la pareja"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Fecha de nacimiento de la pareja:</label>
            <input
              type="date"
              name="parejaNacimiento"
              value={form.parejaNacimiento}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Teléfono de la pareja:</label>
            <input
              type="tel"
              name="telefonoPareja"
              value={form.telefonoPareja}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Teléfono de la pareja"
            />
          </div>
          {/* Información Laboral Pareja del Acreditado */}
          <div className="font-semibold text-green-700 text-lg mb-2 mt-4">Información Laboral Pareja del Acreditado</div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Nombre de la empresa:</label>
            <input
              type="text"
              name="parejaEmpresaNombre"
              value={form.parejaEmpresaNombre}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Nombre de la empresa"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Teléfono laboral:</label>
            <input
              type="tel"
              name="parejaTelefonoLaboral"
              value={form.parejaTelefonoLaboral}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Teléfono laboral"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 1 de la empresa:</label>
            <input
              type="text"
              name="parejaCalle1"
              value={form.parejaCalle1}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle principal de la empresa"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 2 de la empresa:</label>
            <input
              type="text"
              name="parejaCalle2"
              value={form.parejaCalle2}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle secundaria de la empresa"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Ciudad de la empresa:</label>
            <input
              type="text"
              name="parejaCiudad"
              value={form.parejaCiudad}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ciudad de la empresa"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Estado de la empresa:</label>
            <input
              type="text"
              name="parejaEstado"
              value={form.parejaEstado}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Estado de la empresa"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Código Postal de la empresa:</label>
            <input
              type="text"
              name="parejaCP"
              value={form.parejaCP}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Código postal de la empresa"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Ocupación:</label>
            <input
              type="text"
              name="parejaOcupacion"
              value={form.parejaOcupacion}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ocupación actual"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Antigüedad en el empleo (años/meses):</label>
            <input
              type="text"
              name="parejaAntiguedad"
              value={form.parejaAntiguedad}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Por ejemplo: 2 años, 8 meses"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Frecuencia de pago:</label>
            <input
              type="text"
              name="parejaFrecuenciaPago"
              value={form.parejaFrecuenciaPago}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ej: Semanal, Quincenal, Mensual"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Monto percibido:</label>
            <input
              type="number"
              name="parejaMonto"
              value={form.parejaMonto}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Monto recibido"
            />
          </div>
          {/* Dependientes Económicos */}
          <hr className="border-green-500 my-2" />
          <div className="font-semibold text-green-700 text-lg mb-2">Dependientes Económicos</div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Número de dependientes económicos:</label>
            <input
              type="number"
              name="numDependientes"
              value={form.numDependientes}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ej: 1, 2, 3"
              min="0"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Nombre(s) del dependiente:</label>
            <input
              type="text"
              name="dependienteNombre"
              value={form.dependienteNombre}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Nombre(s) del dependiente"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Apellido(s) del dependiente:</label>
            <input
              type="text"
              name="dependienteApellido"
              value={form.dependienteApellido}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Apellido(s) del dependiente"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Teléfono del dependiente:</label>
            <input
              type="tel"
              name="dependienteTelefono"
              value={form.dependienteTelefono}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Teléfono del dependiente"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 1 del dependiente:</label>
            <input
              type="text"
              name="dependienteCalle1"
              value={form.dependienteCalle1}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle principal del dependiente"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 2 del dependiente:</label>
            <input
              type="text"
              name="dependienteCalle2"
              value={form.dependienteCalle2}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle secundaria del dependiente"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Ciudad del dependiente:</label>
            <input
              type="text"
              name="dependienteCiudad"
              value={form.dependienteCiudad}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ciudad del dependiente"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Estado del dependiente:</label>
            <input
              type="text"
              name="dependienteEstado"
              value={form.dependienteEstado}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Estado del dependiente"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Código Postal del dependiente:</label>
            <input
              type="text"
              name="dependienteCP"
              value={form.dependienteCP}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Código postal del dependiente"
            />
          </div>
          {/* Información Aval del Acreditado */}
          <hr className="border-green-500 my-2" />
          <div className="font-semibold text-green-700 text-lg mb-2">Información Aval del Acreditado</div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Nombre(s) del aval:</label>
            <input
              type="text"
              name="avalNombre"
              value={form.avalNombre}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Nombre(s) del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Apellido(s) del aval:</label>
            <input
              type="text"
              name="avalApellido"
              value={form.avalApellido}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Apellido(s) del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Fecha de nacimiento del aval:</label>
            <input
              type="date"
              name="avalNacimiento"
              value={form.avalNacimiento}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Estado civil del aval:</label>
            <input
              type="text"
              name="avalEstadoCivil"
              value={form.avalEstadoCivil}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ej: Soltero, Casado"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Teléfono del aval:</label>
            <input
              type="tel"
              name="avalTelefono"
              value={form.avalTelefono}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Teléfono principal del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Teléfono de recados del aval:</label>
            <input
              type="tel"
              name="avalTelefonoRecados"
              value={form.avalTelefonoRecados}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Otro teléfono de contacto del aval"
            />
          </div>
          {/* Domicilio Aval del Acreditado */}
          <hr className="border-green-500 my-2" />
          <div className="font-semibold text-green-700 text-lg mb-2">Domicilio Aval del Acreditado</div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 1:</label>
            <input
              type="text"
              name="avalCalle1"
              value={form.avalCalle1}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle principal del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 2:</label>
            <input
              type="text"
              name="avalCalle2"
              value={form.avalCalle2}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle secundaria del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Ciudad:</label>
            <input
              type="text"
              name="avalCiudad"
              value={form.avalCiudad}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ciudad del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Estado:</label>
            <input
              type="text"
              name="avalEstado"
              value={form.avalEstado}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Estado del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Código Postal:</label>
            <input
              type="text"
              name="avalCP"
              value={form.avalCP}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Código postal del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Tipo de Vivienda:</label>
            <input
              type="text"
              name="avalTipoVivienda"
              value={form.avalTipoVivienda}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ej: Casa, Departamento"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Descripción de la Vivienda:</label>
            <textarea
              name="avalDescripcionVivienda"
              value={form.avalDescripcionVivienda}
              onChange={handleChange}
              rows={4}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none text-neutral-800"
              placeholder="Descripción detallada de la vivienda del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Créditos actuales:</label>
            <input
              type="text"
              name="avalCreditosActuales"
              value={form.avalCreditosActuales}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ej: Tarjeta de crédito, Crédito personal, etc."
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Descripción de créditos actuales:</label>
            <textarea
              name="avalDescripcionCreditos"
              value={form.avalDescripcionCreditos}
              onChange={handleChange}
              rows={3}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none text-neutral-800"
              placeholder="Describe los créditos actuales del aval, montos, instituciones, etc."
            />
          </div>
          {/* Información Laboral del Aval */}
          <hr className="border-green-500 my-2" />
          <div className="font-semibold text-green-700 text-lg mb-2">Información Laboral del Aval</div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Nombre de la empresa:</label>
            <input
              type="text"
              name="avalEmpresaNombre"
              value={form.avalEmpresaNombre}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Nombre de la empresa del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Teléfono laboral:</label>
            <input
              type="tel"
              name="avalTelefonoLaboral"
              value={form.avalTelefonoLaboral}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Teléfono laboral del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 1 de la empresa:</label>
            <input
              type="text"
              name="avalCalle1"
              value={form.avalCalle1}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle principal de la empresa del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Calle 2 de la empresa:</label>
            <input
              type="text"
              name="avalCalle2"
              value={form.avalCalle2}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Calle secundaria de la empresa del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Ciudad de la empresa:</label>
            <input
              type="text"
              name="avalCiudad"
              value={form.avalCiudad}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ciudad de la empresa del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Estado de la empresa:</label>
            <input
              type="text"
              name="avalEstado"
              value={form.avalEstado}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Estado de la empresa del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Código Postal de la empresa:</label>
            <input
              type="text"
              name="avalCPTrabajo"
              value={form.avalCPTrabajo}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Código postal de la empresa del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Ocupación:</label>
            <input
              type="text"
              name="avalOcupacion"
              value={form.avalOcupacion}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ocupación actual del aval"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Antigüedad en el empleo (años/meses):</label>
            <input
              type="text"
              name="avalAntiguedad"
              value={form.avalAntiguedad}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Por ejemplo: 2 años, 8 meses"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Frecuencia de pago:</label>
            <input
              type="text"
              name="avalFrecuenciaPago"
              value={form.avalFrecuenciaPago}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Ej: Semanal, Quincenal, Mensual"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">Monto percibido:</label>
            <input
              type="number"
              name="avalMonto"
              value={form.avalMonto}
              onChange={handleChange}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
              placeholder="Monto recibido por el aval"
            />
          </div>
          {/* Referencias Personales */}
          <hr className="border-green-500 my-2" />
          <div className="font-semibold text-green-700 text-lg mb-2">Referencias Personales</div>
          {/* Referencia 1 */}
          <div className="mb-4">
            <div className="font-semibold text-green-600 mb-2">Referencia 1</div>
            <div className="flex flex-col mb-2">
              <label className="mb-1 font-semibold">Nombre(s):</label>
              <input
                type="text"
                name="referencia1Nombre"
                value={form.referencia1Nombre}
                onChange={handleChange}
                className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
                placeholder="Nombre(s) de la referencia 1"
              />
            </div>
            <div className="flex flex-col mb-2">
              <label className="mb-1 font-semibold">Apellido(s):</label>
              <input
                type="text"
                name="referencia1Apellido"
                value={form.referencia1Apellido}
                onChange={handleChange}
                className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
                placeholder="Apellido(s) de la referencia 1"
              />
            </div>
            <div className="flex flex-col mb-2">
              <label className="mb-1 font-semibold">Teléfono:</label>
              <input
                type="tel"
                name="referencia1Telefono"
                value={form.referencia1Telefono}
                onChange={handleChange}
                className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
                placeholder="Teléfono de la referencia 1"
              />
            </div>
          </div>
          {/* Referencia 2 */}
          <div className="mb-4">
            <div className="font-semibold text-green-600 mb-2">Referencia 2</div>
            <div className="flex flex-col mb-2">
              <label className="mb-1 font-semibold">Nombre(s):</label>
              <input
                type="text"
                name="referencia2Nombre"
                value={form.referencia2Nombre}
                onChange={handleChange}
                className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
                placeholder="Nombre(s) de la referencia 2"
              />
            </div>
            <div className="flex flex-col mb-2">
              <label className="mb-1 font-semibold">Apellido(s):</label>
              <input
                type="text"
                name="referencia2Apellido"
                value={form.referencia2Apellido}
                onChange={handleChange}
                className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
                placeholder="Apellido(s) de la referencia 2"
              />
            </div>
            <div className="flex flex-col mb-2">
              <label className="mb-1 font-semibold">Teléfono:</label>
              <input
                type="tel"
                name="referencia2Telefono"
                value={form.referencia2Telefono}
                onChange={handleChange}
                className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-neutral-800"
                placeholder="Teléfono de la referencia 2"
              />
            </div>
          </div>
          {/* === FINAL SECTION === */}
          <hr className="border-green-500 my-2" />
          <div className="font-semibold text-green-700 text-lg mb-2">Resumen y Observaciones Finales</div>
          {/* Calificación (star rating) */}
          <div className="flex flex-col mb-2">
            <label className="mb-1 font-semibold">Calificación del cliente:</label>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, calificacion: star }))}
                  className="focus:outline-none"
                  aria-label={`Calificación ${star}`}
                >
                  <span
                    className={`text-2xl ${form.calificacion >= star ? "text-yellow-400" : "text-neutral-700"}`}
                  >
                    ★
                  </span>
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-600">{form.calificacion || 0} / 5</span>
            </div>
          </div>
          {/* Info General Cliente */}
          <div className="flex flex-col mb-2">
            <label className="mb-1 font-semibold">Información general del cliente:</label>
            <textarea
              name="infoGeneralCliente"
              value={form.infoGeneralCliente}
              onChange={handleChange}
              rows={3}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none text-neutral-800"
              placeholder="Observaciones generales sobre el cliente"
            />
          </div>
          {/* Cómo cobrar en caso de morosidad */}
          <div className="flex flex-col mb-2">
            <label className="mb-1 font-semibold">¿Cómo cobrar en caso de morosidad?</label>
            <textarea
              name="comoCobrarMoroso"
              value={form.comoCobrarMoroso}
              onChange={handleChange}
              rows={2}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none text-neutral-800"
              placeholder="Estrategias o recomendaciones para cobro"
            />
          </div>
          {/* Observaciones */}
          <div className="flex flex-col mb-2">
            <label className="mb-1 font-semibold">Observaciones adicionales:</label>
            <textarea
              name="observaciones"
              value={form.observaciones}
              onChange={handleChange}
              rows={2}
              className="px-3 py-2 rounded border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none text-neutral-800"
              placeholder="Cualquier observación relevante"
            />
          </div>
          {/* Checklist de documentos */}
          <div className="flex flex-col mb-4">
            <label className="mb-1 font-semibold">Checklist de documentos:</label>
            <div className="flex flex-wrap gap-4">
              {[
                { value: "ine", label: "Identificación oficial (INE/IFE)" },
                { value: "comprobanteDomicilio", label: "Comprobante de domicilio" },
                { value: "comprobanteIngresos", label: "Comprobante de ingresos" },
                { value: "curp", label: "CURP" },
                { value: "actaNacimiento", label: "Acta de nacimiento" },
                { value: "referencias", label: "Referencias personales" },
                { value: "otros", label: "Otros" },
              ].map((doc) => (
                <label key={doc.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="documentChecklist"
                    value={doc.value}
                    checked={form.documentChecklist.includes(doc.value)}
                    onChange={e => {
                      const checked = e.target.checked;
                      setForm(prev => {
                        const arr = Array.isArray(prev.documentChecklist) ? prev.documentChecklist : [];
                        if (checked) {
                          return { ...prev, documentChecklist: [...arr, doc.value] };
                        } else {
                          return { ...prev, documentChecklist: arr.filter(d => d !== doc.value) };
                        }
                      });
                    }}
                  />
                  {doc.label}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-neutral-800 font-semibold py-2 rounded transition-colors"
          >
            Enviar investigación
          </button>
        </form>
      </div>
    </Layout>
  );
}

export default LoanRequest;