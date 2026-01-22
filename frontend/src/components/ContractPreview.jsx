import React from "react";

const ContractPreview = ({ customer, product, loan, financialProduct }) => {
  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">CONTRATO DE CRÉDITO SIMPLE</h2>

      <p>
        En la ciudad de Mérida, Yucatán, se celebra el presente contrato entre{" "}
        <strong>CrediYa</strong> y el C. <strong>{customer?.first_name} {customer?.last_name}</strong>, con domicilio en{" "}
        <strong>{customer?.address}</strong>, número telefónico <strong>{customer?.phone}</strong>, y correo electrónico{" "}
        <strong>{customer?.email}</strong>.
      </p>

      <h5 className="mt-4">Datos del producto</h5>
      <ul>
        <li><strong>Artículo:</strong> {product?.brand} {product?.model}</li>
        <li><strong>Color:</strong> {product?.color}</li>
        <li><strong>IMEI o serie:</strong> {product?.imei || product?.serial_number}</li>
        <li><strong>Precio de venta:</strong> ${product?.sale_price}</li>
      </ul>

      <h5 className="mt-4">Condiciones del préstamo</h5>
      <ul>
        <li><strong>Enganche:</strong> ${financialProduct?.down_payment}</li>
        <li><strong>Monto financiado:</strong> ${loan?.amount}</li>
        <li><strong>Tasa de interés:</strong> {financialProduct?.interest_rate}%</li>
        <li><strong>Plazo:</strong> {financialProduct?.term_weeks} semanas</li>
        <li><strong>Frecuencia de pago:</strong> {financialProduct?.payment_frequency}</li>
        <li><strong>Penalización por atraso:</strong> ${financialProduct?.penalty_fee}</li>
      </ul>

      <h5 className="mt-4">Tabla de pagos (estimada)</h5>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Semana</th>
            <th>Monto</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: financialProduct?.term_weeks || 0 }).map((_, i) => {
            const weekly = (loan?.amount * (1 + financialProduct?.interest_rate / 100)) / financialProduct?.term_weeks;
            return (
              <tr key={i}>
                <td>Semana {i + 1}</td>
                <td>${weekly.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-4">
        Las partes acuerdan que cualquier incumplimiento en el pago otorgará derecho a CrediYa a tomar las medidas legales
        necesarias para recuperar el bien, incluyendo embargos o reportes ante buró de crédito.
      </p>

      <p className="mt-5 text-end">___________________________<br />Firma del cliente</p>
      <div className="text-end mt-4">
        <button
          className="btn btn-outline-primary"
          onClick={() => window.print()}
        >
          📄 Generar PDF
        </button>
      </div>
    </div>
  );
};

export default ContractPreview;
