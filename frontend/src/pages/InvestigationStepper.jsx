import React, { useState } from "react";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const InvestigationStepper = () => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    nombreCliente: "",
    apellidoCliente: "",
    telefonoCliente: "",
    infoCliente: "",
    asesorVenta: "",
    telefonoConcuerda: "",
    telefonoConcuerdaAval: "",
    telefonosConcuerdanReferencias: "",
    domicilioConcuerdaComprobante: "",
    domicilioAvalConcuerda: "",
    trabajaDondeDice: "",
    fotosDomicilio: null,
    descripcionDomicilio: "",
    infoRelevanteCliente: "",
    comoCobrar: "",
    certezaPago: "",
    coordenadas: "",
    calificacionCliente: "",
    ligaGoogle: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // Submit handler
  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/investigations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        alert("Investigación enviada correctamente");
        setStep(0);
      } else {
        alert("Error al enviar la investigación");
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Error de red");
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6 text-neutral-800">
        {step === 0 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Nombre completo del cliente</label>
            <div className="flex space-x-3">
              <input
                name="nombreCliente"
                placeholder="Nombre"
                value={form.nombreCliente}
                onChange={handleChange}
                className="w-1/2 bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
              />
              <input
                name="apellidoCliente"
                placeholder="Apellido"
                value={form.apellidoCliente}
                onChange={handleChange}
                className="w-1/2 bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
              />
            </div>
            <div className="mt-4">
              <label className="text-lg font-semibold mb-2 block">Teléfono del cliente</label>
              <input
                type="text"
                name="telefonoCliente"
                value={form.telefonoCliente || ""}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Información relevante del cliente</label>
            <textarea
              name="infoCliente"
              value={form.infoCliente}
              onChange={handleChange}
              rows={4}
              className="w-full bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
            />
          </div>
        )}

        {step === 2 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Asesor que efectuó la venta</label>
            <div className="grid grid-cols-2 gap-3">
              {["Salvador", "Ezequiel", "Maricruz", "Ricardo", "Diana", "Natalie", "Eduardo"].map((name) => (
                <label key={name} className="flex items-center space-x-2 text-neutral-800">
                  <input
                    type="radio"
                    name="asesorVenta"
                    value={name}
                    checked={form.asesorVenta === name}
                    onChange={handleChange}
                  />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 10 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Fotografías de domicilio por fuera</label>
            <input
              type="file"
              name="fotosDomicilio"
              accept="image/*"
              onChange={(e) => setForm({ ...form, fotosDomicilio: e.target.files })}
              multiple
              className="block bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
            />
          </div>
        )}

        {step === 11 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Breve descripción de domicilio por fuera</label>
            <textarea
              name="descripcionDomicilio"
              value={form.descripcionDomicilio}
              onChange={handleChange}
              rows={4}
              className="w-full bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
            />
          </div>
        )}

        {step === 12 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Información relevante del cliente</label>
            <textarea
              name="infoRelevanteCliente"
              value={form.infoRelevanteCliente}
              onChange={handleChange}
              rows={4}
              className="w-full bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
            />
          </div>
        )}

        {step === 13 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">¿Cómo se puede cobrar?</label>
            <textarea
              name="comoCobrar"
              value={form.comoCobrar}
              onChange={handleChange}
              rows={3}
              className="w-full bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
            />
          </div>
        )}

        {step === 14 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">¿Qué certeza hay de que pagará?</label>
            <textarea
              name="certezaPago"
              value={form.certezaPago}
              onChange={handleChange}
              rows={3}
              className="w-full bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
            />
          </div>
        )}

        {step === 15 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Coordenadas del domicilio</label>
            <input
              type="text"
              name="coordenadas"
              value={form.coordenadas}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
            />
          </div>
        )}

        {step === 16 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Liga de Google Maps</label>
            <input
              type="text"
              name="ligaGoogle"
              value={form.ligaGoogle}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
            />
          </div>
        )}

        {step === 3 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Nombre completo del cliente</label>
            <div className="flex space-x-3">
              <input
                name="nombreCliente"
                placeholder="Nombre"
                value={form.nombreCliente}
                onChange={handleChange}
                className="w-1/2 bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
              />
              <input
                name="apellidoCliente"
                placeholder="Apellido"
                value={form.apellidoCliente}
                onChange={handleChange}
                className="w-1/2 bg-slate-900 border border-gray-400 rounded px-3 py-2 text-neutral-800"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Teléfono concuerda con acreditado</label>
            <div className="flex gap-4">
              {["Sí", "No"].map((option) => (
                <label key={option} className="flex items-center space-x-2 text-neutral-800">
                  <input
                    type="radio"
                    name="telefonoConcuerda"
                    value={option}
                    checked={form.telefonoConcuerda === option}
                    onChange={handleChange}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Teléfono concuerda con aval</label>
            <div className="flex gap-4">
              {["Sí", "No"].map((option) => (
                <label key={option} className="flex items-center space-x-2 text-neutral-800">
                  <input
                    type="radio"
                    name="telefonoConcuerdaAval"
                    value={option}
                    checked={form.telefonoConcuerdaAval === option}
                    onChange={handleChange}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Teléfonos concuerdan con referencias</label>
            <div className="flex gap-4">
              {["Sí", "No"].map((option) => (
                <label key={option} className="flex items-center space-x-2 text-neutral-800">
                  <input
                    type="radio"
                    name="telefonosConcuerdanReferencias"
                    value={option}
                    checked={form.telefonosConcuerdanReferencias === option}
                    onChange={handleChange}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Domicilio concuerda con comprobante</label>
            <div className="flex gap-4">
              {["Sí", "No"].map((option) => (
                <label key={option} className="flex items-center space-x-2 text-neutral-800">
                  <input
                    type="radio"
                    name="domicilioConcuerdaComprobante"
                    value={option}
                    checked={form.domicilioConcuerdaComprobante === option}
                    onChange={handleChange}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">Domicilio del aval concuerda con comprobante</label>
            <div className="flex gap-4">
              {["Sí", "No"].map((option) => (
                <label key={option} className="flex items-center space-x-2 text-neutral-800">
                  <input
                    type="radio"
                    name="domicilioAvalConcuerda"
                    value={option}
                    checked={form.domicilioAvalConcuerda === option}
                    onChange={handleChange}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 9 && (
          <div className="mb-6">
            <label className="text-lg font-semibold mb-2 block">¿Trabaja donde dice que trabaja?</label>
            <div className="flex gap-4">
              {["Sí", "No"].map((option) => (
                <label key={option} className="flex items-center space-x-2 text-neutral-800">
                  <input
                    type="radio"
                    name="trabajaDondeDice"
                    value={option}
                    checked={form.trabajaDondeDice === option}
                    onChange={handleChange}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="bg-gray-200 text-neutral-800 px-4 py-2 rounded mr-2"
            >
              Atrás
            </button>
          )}
          {step < 17 && (
            <button
              onClick={() => setStep(step + 1)}
              className="bg-primary-500 text-neutral-800 px-4 py-2 rounded"
            >
              Siguiente
            </button>
          )}
          {step === 17 && (
            <button
              onClick={handleSubmit}
              className="bg-primary-500 text-neutral-800 px-4 py-2 rounded mt-4"
            >
              Enviar
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default InvestigationStepper;