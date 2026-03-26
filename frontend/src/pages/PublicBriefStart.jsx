import React from "react";
import { useNavigate } from "react-router-dom";

/**
 * Landing page for starting a new public brief
 * Prospects can start here without any token
 */
const PublicBriefStart = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    // Generate a simple session ID for this prospect
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    // Redirect to public brief form with this session
    navigate(`/public-brief/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-50 via-green-50 to-emerald-50 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-black to-gray-800 text-white p-12 text-center">
            <div className="text-5xl mb-4">📝</div>
            <h1 className="text-4xl font-bold mb-3">Creative Brief</h1>
            <p className="text-xl text-gray-200">ZIONX Marketing</p>
          </div>

          {/* Content */}
          <div className="p-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
              ¡Bienvenido! 👋
            </h2>
            
            <p className="text-lg text-gray-600 mb-8 text-center">
              Este cuestionario nos ayudará a conocer mejor tu negocio y crear
              la estrategia de marketing perfecta para ti.
            </p>

            <div className="bg-gray-50 rounded-xl p-6 mb-8">
              <h3 className="font-bold text-gray-800 mb-4">📋 Lo que incluye:</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✓</span>
                  <span className="text-gray-700">
                    <strong>5 secciones</strong> para conocer tu negocio a fondo
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✓</span>
                  <span className="text-gray-700">
                    <strong>Auto-guardado</strong> - puedes completarlo en varios momentos
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✓</span>
                  <span className="text-gray-700">
                    <strong>15-20 minutos</strong> aproximadamente
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✓</span>
                  <span className="text-gray-700">
                    <strong>No requiere cuenta</strong> - solo completa y envía
                  </span>
                </li>
              </ul>
            </div>

            <div className="text-center">
              <button
                onClick={handleStart}
                className="inline-block bg-black text-white font-bold text-lg px-12 py-4 rounded-xl hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Comenzar Brief →
              </button>
              
              <p className="text-sm text-gray-500 mt-4">
                Tu progreso se guardará automáticamente
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-12 py-6 text-center border-t">
            <p className="text-sm text-gray-500">
              ¿Tienes preguntas? Contacta a tu account manager
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicBriefStart;
