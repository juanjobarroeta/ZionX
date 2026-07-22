import React from "react";
import "./PublicLegal.css";

const CONTACT = "zionx064@gmail.com";

const Privacy = () => (
  <>
    <h1>Aviso de <span className="zxl-serif">Privacidad</span></h1>
    <p className="zxl-meta">Última actualización: julio de 2026</p>

    <p>En <b>ZIONX</b> ("nosotros") respetamos tu privacidad. Este aviso explica qué datos
      tratamos a través de nuestra plataforma de marketing y CRM, con qué fines y cómo
      puedes ejercer tus derechos. Responsable: ZIONX. Contacto: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>

    <h2>Datos que recabamos</h2>
    <ul>
      <li><b>De usuarios de la plataforma:</b> nombre, correo electrónico y teléfono para crear y administrar su cuenta.</li>
      <li><b>Al conectar cuentas de Meta</b> (Facebook e Instagram): identificadores de página, tokens de acceso e información pública de la página o cuenta, para publicar y administrar contenido en tu nombre.</li>
      <li><b>De prospectos (leads):</b> nombre, teléfono, correo, ciudad, interés y los mensajes/interacciones de WhatsApp originados por campañas, para gestionarlos en el embudo de ventas del cliente correspondiente.</li>
      <li><b>Datos técnicos:</b> registros de uso necesarios para operar y asegurar el servicio.</li>
    </ul>

    <h2>Cómo usamos los datos</h2>
    <ul>
      <li>Operar el CRM y el embudo de prospectos, y contactar a los prospectos.</li>
      <li>Publicar y administrar campañas y contenido en las plataformas conectadas.</li>
      <li>Brindar soporte, seguridad y mejoras del servicio.</li>
    </ul>
    <p>Cumplimos las Políticas para Desarrolladores y Plataforma de Meta. No usamos los datos
      obtenidos de Meta para fines distintos a prestar el servicio contratado.</p>

    <h2>Con quién los compartimos</h2>
    <p>No vendemos tus datos. Los compartimos únicamente con: (i) el cliente propietario de los
      prospectos capturados en su embudo; y (ii) proveedores que nos ayudan a operar
      (por ejemplo, alojamiento e infraestructura), bajo obligaciones de confidencialidad.</p>

    <h2>Conservación y seguridad</h2>
    <p>Conservamos los datos mientras la cuenta esté activa o sea necesario para las finalidades
      descritas, y aplicamos medidas de seguridad razonables para protegerlos.</p>

    <h2>Tus derechos</h2>
    <p>Puedes solicitar acceso, rectificación, cancelación u oposición (derechos ARCO), así como la
      eliminación de tus datos, escribiendo a <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Consulta también
      nuestra página de <a href="/data-deletion">eliminación de datos</a>.</p>

    <h2>Cambios</h2>
    <p>Podemos actualizar este aviso; publicaremos aquí la versión vigente con su fecha.</p>
  </>
);

const Deletion = () => (
  <>
    <h1>Eliminación de <span className="zxl-serif">datos</span></h1>
    <p className="zxl-meta">Última actualización: julio de 2026</p>

    <p>Puedes solicitar la eliminación de tus datos personales tratados por <b>ZIONX</b> en cualquier momento.</p>

    <h2>Cómo solicitarla</h2>
    <ol>
      <li>Envía un correo a <a href={`mailto:${CONTACT}`}>{CONTACT}</a> con el asunto <b>"Eliminación de datos"</b>.</li>
      <li>Incluye tu nombre y el correo o teléfono asociado a tus datos, para poder identificarlos.</li>
    </ol>

    <h2>Qué eliminamos</h2>
    <ul>
      <li>Tu información de contacto y de prospecto (lead) almacenada en el CRM.</li>
      <li>Los tokens e identificadores de cuentas de Meta que hayas conectado.</li>
    </ul>

    <h2>Plazo</h2>
    <p>Procesamos las solicitudes en un máximo de <b>30 días</b> y te confirmamos por correo cuando se
      completa. Cierta información podría conservarse si la ley lo exige.</p>

    <h2>Cuentas de Meta conectadas</h2>
    <p>Si conectaste una cuenta de Facebook o Instagram, desconectarla desde <b>Cuentas Meta</b> en la
      plataforma revoca los tokens de acceso. Para eliminar por completo los datos asociados,
      escríbenos al correo indicado.</p>
  </>
);

const PublicLegal = ({ kind = "privacy" }) => (
  <div className="zxl">
    <div className="zxl-card">
      <div className="zxl-brand">ZIONX</div>
      {kind === "deletion" ? <Deletion /> : <Privacy />}
      <div className="zxl-foot">ZIONX · <a href={`mailto:${CONTACT}`}>{CONTACT}</a></div>
    </div>
  </div>
);

export default PublicLegal;
