import { API_BASE_URL } from "../utils/constants";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";


const CreateLoan = () => {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [financialProducts, setFinancialProducts] = useState([]);

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedFinance, setSelectedFinance] = useState("");
  const [loanType, setLoanType] = useState("producto");
  const [cashAmount, setCashAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [storeId, setStoreId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const token = localStorage.getItem("token");
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const fetchData = async () => {
    try {
      const [cRes, pRes, fRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/customers`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE_URL}/inventory-items`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE_URL}/financial-products`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setCustomers(cRes.data);
      setProducts(pRes.data.filter(p => p.status === "in_stock"));
      setFinancialProducts(fRes.data);
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Layout>
    <div className="p-6 bg-white text-neutral-800 max-w-3xl mx-auto rounded-xl shadow-lg border border-primary-500">
      <h2 className="mb-4">Crear nuevo préstamo</h2>

      {/* Step 1: Customer */}
      <div className="mb-4">
        <label className="block mb-2 font-medium text-primary-500">Seleccionar cliente</label>
        <select
          className="w-full p-2 bg-white border border-primary-500 text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
        >
          <option value="">-- Selecciona un cliente --</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {`${c.first_name} ${c.last_name}`} – ID: {c.id}
            </option>
          ))}
        </select>
      </div>

      {/* Step 1.5: Tipo de préstamo */}
      <div className="mb-4">
        <label className="block mb-2 font-medium text-primary-500">Tipo de préstamo</label>
        <select
          className="w-full p-2 bg-white border border-primary-500 text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={loanType}
          onChange={(e) => setLoanType(e.target.value)}
        >
          <option value="producto">Producto</option>
          <option value="efectivo">Efectivo</option>
        </select>
      </div>

      {loanType === "efectivo" && (
        <div className="mb-4">
          <label className="block mb-2 font-medium text-primary-500">Monto del préstamo en efectivo</label>
          <input
            type="number"
            className="w-full p-2 bg-white border border-primary-500 text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
            placeholder="Ej. 3000"
          />
        </div>
      )}

      {/* Step 2: Product */}
      {loanType === "producto" && (
        <div className="mb-4">
          <label className="block mb-2 font-medium text-primary-500">Seleccionar producto (inventario)</label>
          <select
            className="w-full p-2 bg-white border border-primary-500 text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            <option value="">-- Selecciona un producto --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                ID: {p.id} – {p.brand} {p.model} – IMEI: {p.imei} – ${p.sale_price}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Step 3: Financial Product */}
      <div className="mb-4">
        <label className="block mb-2 font-medium text-primary-500">Seleccionar producto financiero</label>
        <select
          className="w-full p-2 bg-white border border-primary-500 text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={selectedFinance}
          onChange={(e) => setSelectedFinance(e.target.value)}
        >
          <option value="">-- Selecciona un producto financiero --</option>
          {financialProducts.map((fp) => (
            <option key={fp.id} value={fp.id}>
              {fp.title} – {fp.term_weeks} semanas @ {fp.interest_rate}%
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-medium text-primary-500">Seleccionar sucursal</label>
        <select
          className="w-full p-2 bg-white border border-primary-500 text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        >
          <option value="">-- Selecciona una sucursal --</option>
          <option value="1">Atlixco</option>
          <option value="2">Cholula</option>
          <option value="3">Chipilo</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-medium text-primary-500">Notas internas</label>
        <textarea
          className="w-full p-2 bg-white border border-primary-500 text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observaciones internas del préstamo"
        />
      </div>

      {selectedCustomer && (loanType === "efectivo" || selectedProduct) && selectedFinance && (() => {
        const selectedProd = loanType === "producto" ? products.find(p => p.id === parseInt(selectedProduct)) : null;
        const selectedFin = financialProducts.find(fp => fp.id === parseInt(selectedFinance));

        const downPayment = parseFloat(selectedFin.down_payment || 0);
        const productPrice = selectedProd ? parseFloat(selectedProd.sale_price) : 0;
        const financedAmount = loanType === "producto"
          ? productPrice - downPayment
          : parseFloat(cashAmount || 0);
        
        // Use the same calculation logic as the quote system
        const annualRate = parseFloat(selectedFin.interest_rate) / 100;
        const weeklyRate = annualRate / 52;
        const totalRepay = financedAmount * Math.pow(1 + weeklyRate, selectedFin.term_weeks);
        const weeklyPayment = financedAmount * (weeklyRate * Math.pow(1 + weeklyRate, selectedFin.term_weeks)) / 
                             (Math.pow(1 + weeklyRate, selectedFin.term_weeks) - 1);
        const totalInterest = totalRepay - financedAmount;
        
        // Generate amortization schedule
        const amortizationSchedule = [];
        let balance = financedAmount;
        
        for (let i = 1; i <= selectedFin.term_weeks; i++) {
          const interestPayment = balance * weeklyRate;
          const principalPayment = weeklyPayment - interestPayment;
          balance = balance - principalPayment;
          
          if (balance < 0) balance = 0;
          
          amortizationSchedule.push({
            week: i,
            payment: weeklyPayment.toFixed(2),
            principal: principalPayment.toFixed(2),
            interest: interestPayment.toFixed(2),
            balance: balance.toFixed(2),
          });
        }

        return (
          <div className="mt-6 p-6 bg-[#0f0f0f] border border-primary-500 rounded-xl shadow-md">
            <h5>Resumen del préstamo</h5>
            {loanType === "producto" ? (
              <>
                <p><strong>Precio del producto:</strong> ${selectedProd.sale_price}</p>
                <p><strong>Enganche:</strong> ${downPayment}</p>
                <p><strong>Capital a financiar:</strong> ${financedAmount.toFixed(2)}</p>
              </>
            ) : (
              <>
                <p><strong>Tipo de préstamo:</strong> Efectivo</p>
                <p><strong>Capital a financiar:</strong> ${financedAmount.toFixed(2)}</p>
              </>
            )}
            <p><strong>Intereses totales:</strong> ${totalInterest.toFixed(2)}</p>
            <p><strong>Total a pagar:</strong> ${totalRepay.toFixed(2)}</p>
            <p><strong>Pago semanal:</strong> ${weeklyPayment.toFixed(2)}</p>

            <table className="w-full text-sm mt-4 text-neutral-800 border border-primary-500">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Pago</th>
                  <th>Principal</th>
                  <th>Interés</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {amortizationSchedule.slice(0, 10).map((row) => (
                  <tr key={row.week}>
                    <td>{row.week}</td>
                    <td>${row.payment}</td>
                    <td>${row.principal}</td>
                    <td>${row.interest}</td>
                    <td>${row.balance}</td>
                  </tr>
                ))}
                {amortizationSchedule.length > 10 && (
                  <tr>
                    <td colSpan="5" className="text-center text-neutral-600">
                      ... y {amortizationSchedule.length - 10} semanas más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <button
              className={`mt-4 text-neutral-800 font-bold px-6 py-2 rounded transition ${
                isCreating 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-primary-500 hover:bg-primary-600'
              }`}
              onClick={async () => {
                if (isCreating) return; // Prevent double clicks
                
                if (loanType === "efectivo" && !cashAmount) {
                  alert("Por favor ingresa el monto del préstamo en efectivo.");
                  return;
                }
                
                setIsCreating(true);
                try {
                  const res = await axios.post(`${API_BASE_URL}/apply-loan`, {
                    customer_id: selectedCustomer,
                    inventory_item_id: loanType === "producto" ? selectedProduct : null,
                    amount: financedAmount,
                    term: selectedFin.term_weeks,
                    loan_type: loanType,
                    financial_product_id: selectedFinance,
                    store_id: storeId,
                    notes,
                    created_by: currentUser.id,
                    weekly_payment: weeklyPayment,
                    total_repay: totalRepay,
                    total_interest: totalInterest,
                    amortization_schedule: amortizationSchedule
                  }, {
                    headers: { Authorization: `Bearer ${token}` },
                  });

                  alert("✅ Préstamo creado y producto asignado");
                  setSelectedCustomer("");
                  setSelectedProduct("");
                  setSelectedFinance("");
                  setLoanType("producto");
                  setCashAmount("");
                  setStoreId("");
                  setNotes("");
                  fetchData();
                } catch (err) {
                  console.error("Error creando el préstamo:", err);
                  alert("❌ Error al crear el préstamo");
                } finally {
                  setIsCreating(false);
                }
              }}
              disabled={isCreating}
            >
              {isCreating ? "Creando préstamo..." : "Crear préstamo"}
            </button>
          </div>
        );
      })()}
    </div>
    </Layout>
  );
};

export default CreateLoan;
