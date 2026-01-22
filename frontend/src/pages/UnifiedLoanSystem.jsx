import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const UnifiedLoanSystem = () => {
  const navigate = useNavigate();
  const { loan_id } = useParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  
  // Data states
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [financialProducts, setFinancialProducts] = useState([]);
  const [stores, setStores] = useState([]);
  
  // Loan form state
  const [loanData, setLoanData] = useState({
    // Basic Info
    customer_id: "",
    loan_type: "producto",
    store_id: "",
    notes: "",
    
    // Product/Cash Info
    product_id: "",
    financial_product_id: "",
    cash_amount: "",
    
    // Financial Terms
    amount: "",
    interest_rate: "",
    term_weeks: "",
    down_payment: "",
    monthly_payment: "",
    
    // Contract Details
    guarantor_name: "",
    contract_date: new Date().toISOString().split('T')[0],
    delivery_date: "",
    
    // Status
    status: "pending",
    approval_notes: ""
  });

  // Calculation states
  const [calculations, setCalculations] = useState({
    totalAmount: 0,
    monthlyPayment: 0,
    totalInterest: 0,
    totalPayable: 0,
    amortizationTable: []
  });

  const [contractData, setContractData] = useState(null);
  const [generatedContract, setGeneratedContract] = useState(null);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  
  // Step configuration
  const steps = [
    {
      id: 1,
      title: "Información del Préstamo",
      icon: "📝",
      description: "Datos básicos y selección de cliente",
      requiredRole: "user"
    },
    {
      id: 2,
      title: "Términos Financieros",
      icon: "💰",
      description: "Configuración de montos y plazos",
      requiredRole: "user"
    },
    {
      id: 3,
      title: "Revisión y Aprobación",
      icon: "✅",
      description: "Validación administrativa",
      requiredRole: "admin"
    },
    {
      id: 4,
      title: "Generación de Contrato",
      icon: "📄",
      description: "Creación del documento legal",
      requiredRole: "user"
    },
    {
      id: 5,
      title: "Entrega y Finalización",
      icon: "🚀",
      description: "Entrega del producto/efectivo",
      requiredRole: "admin"
    }
  ];

  // Load initial data
  useEffect(() => {
    loadInitialData();
    if (loan_id) {
      loadExistingLoan();
    }
  }, [loan_id]);

  // Real-time calculations
  useEffect(() => {
    if (loanData.amount && loanData.interest_rate && loanData.term_weeks) {
      calculateLoanTerms();
    }
  }, [loanData.amount, loanData.interest_rate, loanData.term_weeks, loanData.down_payment]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [customersRes, productsRes, financialRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/customers`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/inventory-items`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/financial-products`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setCustomers(customersRes.data || []);
      setProducts(productsRes.data?.filter(p => p.status === "in_stock") || []);
      setFinancialProducts(financialRes.data || []);
      
      // Real stores data
      setStores([
        { id: 1, name: "Atlixco", location: "Atlixco, Puebla" },
        { id: 2, name: "Chipilo", location: "Chipilo, Puebla" },
        { id: 3, name: "Cholula", location: "Cholula, Puebla" }
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExistingLoan = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/loans/${loan_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const loan = response.data.loan;
      setLoanData({...loanData, ...loan});
      
      // Determine current step based on loan status
      if (loan.status === "pending") setCurrentStep(3);
      else if (loan.status === "approved") setCurrentStep(4);
      else if (loan.status === "contract_generated") setCurrentStep(5);
      else if (loan.status === "delivered") setCurrentStep(5);
      
    } catch (error) {
      console.error("Error loading loan:", error);
    }
  };

  const calculateLoanTerms = useCallback(() => {
    const principal = parseFloat(loanData.amount) || 0;
    const weeklyRate = parseFloat(loanData.interest_rate) / 100 / 52 || 0; // Weekly rate
    const weeks = parseInt(loanData.term_weeks) || 0;
    const downPayment = parseFloat(loanData.down_payment) || 0;
    
    if (principal <= 0 || weeks <= 0) return;
    
    const loanAmount = principal - downPayment;
    
    let weeklyPayment = 0;
    let totalInterest = 0;
    
    if (weeklyRate > 0) {
      weeklyPayment = (loanAmount * weeklyRate * Math.pow(1 + weeklyRate, weeks)) / (Math.pow(1 + weeklyRate, weeks) - 1);
      totalInterest = (weeklyPayment * weeks) - loanAmount;
    } else {
      weeklyPayment = loanAmount / weeks;
      totalInterest = 0;
    }
    
    const totalPayable = loanAmount + totalInterest;
    
    // Generate amortization table
    const amortizationTable = [];
    let balance = loanAmount;
    
    for (let week = 1; week <= weeks; week++) {
      const interestPayment = balance * weeklyRate;
      const principalPayment = weeklyPayment - interestPayment;
      balance -= principalPayment;
      
      amortizationTable.push({
        week,
        payment: weeklyPayment,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, balance)
      });
    }
    
    setCalculations({
      totalAmount: principal,
      weeklyPayment,
      totalInterest,
      totalPayable,
      amortizationTable
    });
    
    // Update loan data with calculated payment
    setLoanData(prev => ({
      ...prev,
      weekly_payment: weeklyPayment.toFixed(2)
    }));
  }, [loanData.amount, loanData.interest_rate, loanData.term_weeks, loanData.down_payment]);

  const handleInputChange = (field, value) => {
    setLoanData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation errors
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Auto-fill financial product terms
    if (field === "financial_product_id" && value) {
      const product = financialProducts.find(p => p.id === parseInt(value));
      if (product) {
        // Convert months to weeks if financial product is in months
        const weeks = product.term_months ? product.term_months * 4 : product.term_weeks || 12;
        setLoanData(prev => ({
          ...prev,
          interest_rate: product.interest_rate,
          term_weeks: weeks
        }));
      }
    }
    
    // Auto-fill product amount
    if (field === "product_id" && value) {
      const product = products.find(p => p.id === parseInt(value));
      if (product) {
        setLoanData(prev => ({
          ...prev,
          amount: product.sale_price
        }));
      }
    }
  };

  const validateStep = (step) => {
    const errors = {};
    
    switch (step) {
      case 1:
        if (!loanData.customer_id) errors.customer_id = "Seleccione un cliente";
        if (!loanData.store_id) errors.store_id = "Seleccione una tienda";
        if (loanData.loan_type === "producto" && !loanData.product_id) {
          errors.product_id = "Seleccione un producto";
        }
        if (loanData.loan_type === "efectivo" && !loanData.cash_amount) {
          errors.cash_amount = "Ingrese el monto en efectivo";
        }
        break;
        
      case 2:
        if (!loanData.amount) errors.amount = "Ingrese el monto del préstamo";
        if (!loanData.interest_rate) errors.interest_rate = "Ingrese la tasa de interés";
        if (!loanData.term_weeks) errors.term_weeks = "Ingrese el plazo en semanas";
        if (!loanData.financial_product_id) errors.financial_product_id = "Seleccione un producto financiero";
        break;
        
      case 3:
        if (user.role !== "admin") {
          errors.general = "Solo administradores pueden aprobar préstamos";
        }
        break;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = async () => {
    if (validateStep(currentStep)) {
      // Save loan before proceeding to step 3 (approval)
      if (currentStep === 2 && !loan_id) {
        const savedLoanId = await saveLoan();
        if (!savedLoanId) {
          alert("Error: No se pudo guardar el préstamo. Intente nuevamente.");
          return;
        }
        // Navigate to the saved loan URL
        navigate(`/loans/unified/${savedLoanId}`);
        return;
      }
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const saveLoan = async () => {
    setIsLoading(true);
    try {
      let response;
      if (loan_id) {
        response = await axios.put(`${API_BASE_URL}/loans/${loan_id}`, loanData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        response = await axios.post(`${API_BASE_URL}/loans`, loanData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      if (response.data.success) {
        const newLoanId = response.data.loan_id || loan_id;
        console.log("✅ Loan saved with ID:", newLoanId);
        return newLoanId;
      } else {
        console.error("❌ Loan save failed:", response.data);
        return null;
      }
    } catch (error) {
      console.error("Error saving loan:", error);
      const errorMsg = error.response?.data?.message || "Error al guardar el préstamo";
      
      // If it's an inventory error, refresh the product list
      if (errorMsg.includes("inventory") || errorMsg.includes("not available") || errorMsg.includes("assigned")) {
        alert(`❌ ${errorMsg}\n\n🔄 Actualizando lista de productos disponibles...`);
        await loadInitialData(); // Refresh product list
      } else {
        alert(`❌ ${errorMsg}`);
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const approveLoan = async () => {
    if (!loan_id) {
      alert("❌ Error: No se ha guardado el préstamo. No se puede aprobar.");
      return;
    }
    
    setIsLoading(true);
    try {
      await axios.put(`${API_BASE_URL}/loans/${loan_id}/approve`, {
        approval_notes: loanData.approval_notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setLoanData(prev => ({ ...prev, status: "approved" }));
      nextStep();
    } catch (error) {
      console.error("Error approving loan:", error);
      const errorMsg = error.response?.data?.message || "Error al aprobar el préstamo";
      alert(`❌ ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const generateContract = async () => {
    if (!loan_id) {
      alert("❌ Error: No se ha guardado el préstamo. Regrese al paso anterior y guarde el préstamo.");
      return;
    }
    
    setIsLoading(true);
    try {
      // Generate PDF contract (recommended)
      const response = await axios.get(`${API_BASE_URL}/contracts/${loan_id}/generate-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contrato-prestamo-${loan_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      // Update loan status
      await axios.put(`${API_BASE_URL}/loans/${loan_id}/status`, {
        status: "contract_generated",
        notes: "Contrato PDF generado exitosamente"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setLoanData(prev => ({ ...prev, status: "contract_generated" }));
      setGeneratedContract(url);
      nextStep();
    } catch (error) {
      console.error("Error generating contract:", error);
      const errorMsg = error.response?.data?.message || "Error al generar el contrato";
      alert(`❌ ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deliverLoan = async () => {
    if (!loan_id) {
      alert("❌ Error: No se ha guardado el préstamo. No se puede entregar.");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.put(`${API_BASE_URL}/loans/${loan_id}/deliver`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setLoanData(prev => ({ ...prev, status: "delivered" }));
      const downPaymentMsg = response.data.down_payment_received > 0 
        ? `\n💰 Enganche registrado: $${response.data.down_payment_received.toLocaleString()}`
        : '';
      alert(`✅ ${response.data.message || 'Préstamo entregado exitosamente'}${downPaymentMsg}\n\n📊 El inventario y las cuentas de clientes han sido actualizados en el libro mayor.`);
      navigate("/loans");
    } catch (error) {
      console.error("Error delivering loan:", error);
      const errorMsg = error.response?.data?.message || "Error al entregar el préstamo";
      alert(`❌ ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Get selected customer data
  const selectedCustomer = customers.find(c => c.id === parseInt(loanData.customer_id));
  const selectedProduct = products.find(p => p.id === parseInt(loanData.product_id));
  const selectedFinancialProduct = financialProducts.find(fp => fp.id === parseInt(loanData.financial_product_id));

  const canProceedToStep = (step) => {
    if (step <= currentStep) return true;
    if (user.role !== "admin" && step > 2) return false;
    return currentStep >= step - 1;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white text-neutral-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-black border-b border-gray-800 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => navigate("/loans")}
                  className="mr-4 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  ← Volver
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-neutral-800">
                    {loan_id ? "Gestionar Préstamo" : "Crear Nuevo Préstamo"}
                  </h1>
                  <p className="text-neutral-600">Sistema Unificado de Gestión de Préstamos</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-600">Paso {currentStep}/5</div>
                <div className="text-neutral-600 text-sm">{steps[currentStep - 1]?.title}</div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center space-x-4 overflow-x-auto pb-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center flex-shrink-0">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200 ${
                    currentStep > step.id
                      ? 'bg-primary-500 border-lime-500 text-neutral-800'
                      : currentStep === step.id
                        ? 'bg-blue-600 border-blue-600 text-neutral-800'
                        : canProceedToStep(step.id)
                          ? 'bg-gray-700 border-neutral-300 text-neutral-700 cursor-pointer hover:bg-gray-600'
                          : 'bg-white border-neutral-200 text-gray-500'
                  }`}
                  onClick={() => canProceedToStep(step.id) && setCurrentStep(step.id)}
                  >
                    <span className="text-lg">{step.icon}</span>
                  </div>
                  <div className="ml-3 min-w-0">
                    <div className={`font-medium text-sm ${
                      currentStep >= step.id ? 'text-neutral-800' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </div>
                    <div className="text-neutral-600 text-xs">{step.description}</div>
                    {step.requiredRole === "admin" && user.role !== "admin" && (
                      <div className="text-orange-400 text-xs">⚠️ Requiere Admin</div>
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-px mx-4 ${
                      currentStep > step.id ? 'bg-primary-500' : 'bg-gray-600'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Main Form */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-xl p-8 border border-neutral-200 shadow-2xl">
                
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <div className="text-6xl mb-4">📝</div>
                      <h2 className="text-2xl font-bold text-neutral-800">Información del Préstamo</h2>
                      <p className="text-neutral-600">Configuración básica y selección de cliente</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-neutral-700 font-medium mb-2">Cliente *</label>
                        <select
                          value={loanData.customer_id}
                          onChange={(e) => handleInputChange("customer_id", e.target.value)}
                          className={`w-full p-3 bg-gray-700 border rounded-lg text-neutral-800 focus:outline-none transition-colors ${
                            validationErrors.customer_id ? 'border-red-500' : 'border-neutral-300 focus:border-lime-400'
                          }`}
                        >
                          <option value="">Seleccionar cliente</option>
                          {customers.map(customer => (
                            <option key={customer.id} value={customer.id}>
                              {customer.first_name} {customer.last_name} - {customer.phone}
                            </option>
                          ))}
                        </select>
                        {validationErrors.customer_id && (
                          <p className="text-neutral-600 text-sm mt-1">{validationErrors.customer_id}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-neutral-700 font-medium mb-2">Tipo de Préstamo</label>
                        <select
                          value={loanData.loan_type}
                          onChange={(e) => handleInputChange("loan_type", e.target.value)}
                          className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800 focus:border-lime-400 focus:outline-none transition-colors"
                        >
                          <option value="producto">📱 Producto (Inventario)</option>
                          <option value="efectivo">💵 Efectivo</option>
                        </select>
                      </div>

                      {loanData.loan_type === "producto" && (
                        <div className="md:col-span-2">
                          <label className="block text-neutral-700 font-medium mb-2">Producto del Inventario *</label>
                          <select
                            value={loanData.product_id}
                            onChange={(e) => handleInputChange("product_id", e.target.value)}
                            className={`w-full p-3 bg-gray-700 border rounded-lg text-neutral-800 focus:outline-none transition-colors ${
                              validationErrors.product_id ? 'border-red-500' : 'border-neutral-300 focus:border-lime-400'
                            }`}
                          >
                                          <option value="">Seleccionar producto</option>
              {products.length === 0 && (
                <option disabled>No hay productos disponibles</option>
              )}
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  ID:{product.id} - {product.brand} {product.model} - ${product.sale_price} (Stock: {product.quantity}) {product.imei ? `- IMEI: ${product.imei}` : ''} ✅
                </option>
              ))}
                          </select>
                          {validationErrors.product_id && (
                            <p className="text-neutral-600 text-sm mt-1">{validationErrors.product_id}</p>
                          )}
                        </div>
                      )}

                      {loanData.loan_type === "efectivo" && (
                        <div className="md:col-span-2">
                          <label className="block text-neutral-700 font-medium mb-2">Monto en Efectivo *</label>
                          <div className="relative">
                            <span className="absolute left-3 top-3 text-neutral-600">$</span>
                            <input
                              type="number"
                              value={loanData.cash_amount}
                              onChange={(e) => {
                                handleInputChange("cash_amount", e.target.value);
                                handleInputChange("amount", e.target.value);
                              }}
                              className={`w-full pl-8 pr-3 py-3 bg-gray-700 border rounded-lg text-neutral-800 focus:outline-none transition-colors ${
                                validationErrors.cash_amount ? 'border-red-500' : 'border-neutral-300 focus:border-lime-400'
                              }`}
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                            />
                          </div>
                          {validationErrors.cash_amount && (
                            <p className="text-neutral-600 text-sm mt-1">{validationErrors.cash_amount}</p>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-neutral-700 font-medium mb-2">Tienda *</label>
                        <select
                          value={loanData.store_id}
                          onChange={(e) => handleInputChange("store_id", e.target.value)}
                          className={`w-full p-3 bg-gray-700 border rounded-lg text-neutral-800 focus:outline-none transition-colors ${
                            validationErrors.store_id ? 'border-red-500' : 'border-neutral-300 focus:border-lime-400'
                          }`}
                        >
                          <option value="">Seleccionar tienda</option>
                          {stores.map(store => (
                            <option key={store.id} value={store.id}>
                              {store.name} - {store.location}
                            </option>
                          ))}
                        </select>
                        {validationErrors.store_id && (
                          <p className="text-neutral-600 text-sm mt-1">{validationErrors.store_id}</p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-neutral-700 font-medium mb-2">Notas Internas</label>
                        <textarea
                          value={loanData.notes}
                          onChange={(e) => handleInputChange("notes", e.target.value)}
                          className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800 focus:border-lime-400 focus:outline-none transition-colors"
                          rows="3"
                          placeholder="Observaciones internas del préstamo..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Financial Terms */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <div className="text-6xl mb-4">💰</div>
                      <h2 className="text-2xl font-bold text-neutral-800">Términos Financieros</h2>
                      <p className="text-neutral-600">Configuración de montos, tasas y plazos</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-neutral-700 font-medium mb-2">Producto Financiero *</label>
                        <select
                          value={loanData.financial_product_id}
                          onChange={(e) => handleInputChange("financial_product_id", e.target.value)}
                          className={`w-full p-3 bg-gray-700 border rounded-lg text-neutral-800 focus:outline-none transition-colors ${
                            validationErrors.financial_product_id ? 'border-red-500' : 'border-neutral-300 focus:border-lime-400'
                          }`}
                        >
                          <option value="">Seleccionar producto financiero</option>
                          {financialProducts.map(fp => (
                            <option key={fp.id} value={fp.id}>
                              {fp.name} - {fp.interest_rate}% por {fp.term_months ? fp.term_months * 4 : fp.term_weeks || 12} semanas
                            </option>
                          ))}
                        </select>
                        {validationErrors.financial_product_id && (
                          <p className="text-neutral-600 text-sm mt-1">{validationErrors.financial_product_id}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-neutral-700 font-medium mb-2">Monto del Préstamo *</label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-neutral-600">$</span>
                          <input
                            type="number"
                            value={loanData.amount}
                            onChange={(e) => handleInputChange("amount", e.target.value)}
                            className={`w-full pl-8 pr-3 py-3 bg-gray-700 border rounded-lg text-neutral-800 focus:outline-none transition-colors ${
                              validationErrors.amount ? 'border-red-500' : 'border-neutral-300 focus:border-lime-400'
                            }`}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        {validationErrors.amount && (
                          <p className="text-neutral-600 text-sm mt-1">{validationErrors.amount}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-neutral-700 font-medium mb-2">Enganche</label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-neutral-600">$</span>
                          <input
                            type="number"
                            value={loanData.down_payment}
                            onChange={(e) => handleInputChange("down_payment", e.target.value)}
                            className="w-full pl-8 pr-3 py-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800 focus:border-lime-400 focus:outline-none transition-colors"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-neutral-700 font-medium mb-2">Tasa de Interés Anual *</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={loanData.interest_rate}
                            onChange={(e) => handleInputChange("interest_rate", e.target.value)}
                            className={`w-full pr-8 pl-3 py-3 bg-gray-700 border rounded-lg text-neutral-800 focus:outline-none transition-colors ${
                              validationErrors.interest_rate ? 'border-red-500' : 'border-neutral-300 focus:border-lime-400'
                            }`}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                          <span className="absolute right-3 top-3 text-neutral-600">%</span>
                        </div>
                        {validationErrors.interest_rate && (
                          <p className="text-neutral-600 text-sm mt-1">{validationErrors.interest_rate}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-neutral-700 font-medium mb-2">Plazo en Semanas *</label>
                        <input
                          type="number"
                          value={loanData.term_weeks}
                          onChange={(e) => handleInputChange("term_weeks", e.target.value)}
                          className={`w-full p-3 bg-gray-700 border rounded-lg text-neutral-800 focus:outline-none transition-colors ${
                            validationErrors.term_weeks ? 'border-red-500' : 'border-neutral-300 focus:border-lime-400'
                          }`}
                          placeholder="12"
                          min="1"
                          max="104"
                        />
                        {validationErrors.term_weeks && (
                          <p className="text-neutral-600 text-sm mt-1">{validationErrors.term_weeks}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-neutral-700 font-medium mb-2">Pago Semanal (Calculado)</label>
                        <div className="p-3 bg-gradient-to-br from-surface-50 to-surface-100 border border-neutral-300 rounded-lg text-primary-600 font-bold text-lg">
                          ${parseFloat(calculations.weeklyPayment || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Amortization Table */}
                    {calculations.amortizationTable.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold text-primary-600 mb-4">📊 Tabla de Amortización</h3>
                        <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg border border-neutral-200 max-h-64 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-white">
                              <tr>
                                <th className="px-4 py-3 text-left text-neutral-700">Semana</th>
                                <th className="px-4 py-3 text-right text-neutral-700">Pago</th>
                                <th className="px-4 py-3 text-right text-neutral-700">Capital</th>
                                <th className="px-4 py-3 text-right text-neutral-700">Interés</th>
                                <th className="px-4 py-3 text-right text-neutral-700">Saldo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                              {calculations.amortizationTable.map((row, index) => (
                                <tr key={index} className="hover:bg-white/50">
                                  <td className="px-4 py-2 text-neutral-800">{row.week}</td>
                                  <td className="px-4 py-2 text-right text-primary-600 font-medium">
                                    ${row.payment.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-4 py-2 text-right text-primary-500">
                                    ${row.principal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-4 py-2 text-right text-orange-400">
                                    ${row.interest.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-4 py-2 text-right text-neutral-800">
                                    ${row.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-4 border border-neutral-200 text-center">
                            <div className="text-lg font-bold text-primary-600">
                              ${parseFloat(calculations.totalPayable || 0).toLocaleString('es-MX')}
                            </div>
                            <div className="text-neutral-600 text-sm">Total a Pagar</div>
                          </div>
                          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-4 border border-neutral-200 text-center">
                            <div className="text-lg font-bold text-orange-400">
                              ${parseFloat(calculations.totalInterest || 0).toLocaleString('es-MX')}
                            </div>
                            <div className="text-neutral-600 text-sm">Total Intereses</div>
                          </div>
                          <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-4 border border-neutral-200 text-center">
                            <div className="text-lg font-bold text-neutral-800">
                              {loanData.term_weeks} semanas
                            </div>
                            <div className="text-neutral-600 text-sm">Plazo Total</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Review and Approval */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <div className="text-6xl mb-4">✅</div>
                      <h2 className="text-2xl font-bold text-neutral-800">Revisión y Aprobación</h2>
                      <p className="text-neutral-600">Validación administrativa del préstamo</p>
                    </div>

                    {user.role !== "admin" ? (
                      <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-6 text-center">
                        <div className="text-4xl mb-4">⚠️</div>
                        <h3 className="text-xl font-bold text-orange-400 mb-2">Pendiente de Aprobación</h3>
                        <p className="text-neutral-700">
                          Este préstamo ha sido enviado a revisión administrativa. 
                          Solo usuarios con rol de administrador pueden aprobar préstamos.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
                          <h3 className="text-lg font-semibold text-primary-500 mb-4">📋 Resumen del Préstamo</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-neutral-600">Cliente:</span>
                              <span className="text-neutral-800 ml-2">{selectedCustomer?.first_name} {selectedCustomer?.last_name}</span>
                            </div>
                            <div>
                              <span className="text-neutral-600">Monto:</span>
                              <span className="text-neutral-800 ml-2">${parseFloat(loanData.amount || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-neutral-600">Plazo:</span>
                              <span className="text-neutral-800 ml-2">{loanData.term_weeks} semanas</span>
                            </div>
                            <div>
                              <span className="text-neutral-600">Pago Semanal:</span>
                              <span className="text-neutral-800 ml-2">${parseFloat(calculations.weeklyPayment || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-neutral-700 font-medium mb-2">Notas de Aprobación</label>
                          <textarea
                            value={loanData.approval_notes}
                            onChange={(e) => handleInputChange("approval_notes", e.target.value)}
                            className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800 focus:border-lime-400 focus:outline-none transition-colors"
                            rows="4"
                            placeholder="Comentarios sobre la aprobación del préstamo..."
                          />
                        </div>

                        <div className="flex gap-4">
                          <button
                            onClick={approveLoan}
                            disabled={isLoading}
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-neutral-800 py-3 px-6 rounded-lg font-semibold transition-colors"
                          >
                            {isLoading ? "Aprobando..." : "✅ Aprobar Préstamo"}
                          </button>
                          <button
                            onClick={() => alert("Funcionalidad de rechazo pendiente")}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-neutral-800 py-3 px-6 rounded-lg font-semibold transition-colors"
                          >
                            ❌ Rechazar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Contract Generation */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <div className="text-6xl mb-4">📄</div>
                      <h2 className="text-2xl font-bold text-neutral-800">Generación de Contrato</h2>
                      <p className="text-neutral-600">Crear documento legal del préstamo</p>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-neutral-700 font-medium mb-2">Nombre del Aval</label>
                          <input
                            type="text"
                            value={loanData.guarantor_name}
                            onChange={(e) => handleInputChange("guarantor_name", e.target.value)}
                            className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800 focus:border-lime-400 focus:outline-none transition-colors"
                            placeholder="Nombre completo del aval"
                          />
                        </div>

                        <div>
                          <label className="block text-neutral-700 font-medium mb-2">Fecha del Contrato</label>
                          <input
                            type="date"
                            value={loanData.contract_date}
                            onChange={(e) => handleInputChange("contract_date", e.target.value)}
                            className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800 focus:border-lime-400 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg p-6 border border-neutral-200">
                        <h3 className="text-lg font-semibold text-primary-600 mb-4">📋 Información del Contrato</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-neutral-600">Cliente:</span>
                            <span className="text-neutral-800 ml-2">{selectedCustomer?.first_name} {selectedCustomer?.last_name}</span>
                          </div>
                          <div>
                            <span className="text-neutral-600">CURP:</span>
                            <span className="text-neutral-800 ml-2">{selectedCustomer?.curp || 'No registrado'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-600">Teléfono:</span>
                            <span className="text-neutral-800 ml-2">{selectedCustomer?.phone}</span>
                          </div>
                          <div>
                            <span className="text-neutral-600">Email:</span>
                            <span className="text-neutral-800 ml-2">{selectedCustomer?.email || 'No registrado'}</span>
                          </div>
                          {selectedProduct && (
                            <>
                              <div>
                                <span className="text-neutral-600">Producto:</span>
                                <span className="text-neutral-800 ml-2">{selectedProduct.brand} {selectedProduct.model}</span>
                              </div>
                              <div>
                                <span className="text-neutral-600">IMEI:</span>
                                <span className="text-neutral-800 ml-2">{selectedProduct.imei || 'Por asignar'}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={generateContract}
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-neutral-800 py-4 px-6 rounded-lg font-bold text-lg transition-colors"
                      >
                        {isLoading ? "Generando Contrato..." : "📄 Generar Contrato"}
                      </button>

                      {generatedContract && (
                        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                          <h4 className="text-primary-500 font-semibold mb-2">✅ Contrato Generado</h4>
                          <p className="text-neutral-700 text-sm">
                            El contrato ha sido generado exitosamente y descargado. 
                            Puede proceder con la entrega del préstamo.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 5: Delivery */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <div className="text-6xl mb-4">🚀</div>
                      <h2 className="text-2xl font-bold text-neutral-800">Entrega y Finalización</h2>
                      <p className="text-neutral-600">Última etapa del proceso de préstamo</p>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-primary-500 mb-4">✅ Préstamo Listo para Entrega</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-neutral-600">Estado:</span>
                            <span className="text-primary-500 ml-2 font-semibold">Aprobado y Documentado</span>
                          </div>
                          <div>
                            <span className="text-neutral-600">Contrato:</span>
                            <span className="text-primary-500 ml-2 font-semibold">Generado</span>
                          </div>
                        </div>
                        
                        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                          <h4 className="text-primary-500 font-semibold text-sm mb-2">📊 Impacto Contable</h4>
                          <p className="text-neutral-700 text-xs">
                            Al confirmar la entrega, el sistema automáticamente:
                          </p>
                          <ul className="text-neutral-700 text-xs mt-2 space-y-1">
                            <li>• <span className="text-primary-600">Debita</span> la cuenta del cliente (aumenta cuentas por cobrar)</li>
                            <li>• <span className="text-orange-400">Acredita</span> el inventario (reduce valor en almacén)</li>
                            <li>• Actualiza automáticamente el libro mayor contable</li>
                          </ul>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-neutral-700 font-medium mb-2">Fecha de Entrega</label>
                          <input
                            type="date"
                            value={loanData.delivery_date}
                            onChange={(e) => handleInputChange("delivery_date", e.target.value)}
                            className="w-full p-3 bg-gray-700 border border-neutral-300 rounded-lg text-neutral-800 focus:border-lime-400 focus:outline-none transition-colors"
                          />
                        </div>

                        {parseFloat(loanData.down_payment || 0) > 0 && (
                          <div>
                            <label className="block text-neutral-700 font-medium mb-2">Enganche a Recibir</label>
                            <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                              <div className="text-lg font-bold text-primary-500">
                                ${parseFloat(loanData.down_payment || 0).toLocaleString('es-MX')}
                              </div>
                              <div className="text-neutral-600 text-sm">
                                Se registrará al entregar el producto
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                        <h4 className="text-yellow-400 font-semibold mb-2">⚠️ Lista de Verificación</h4>
                        <ul className="text-neutral-700 text-sm space-y-1">
                          <li>✅ Contrato firmado por el cliente</li>
                          <li>✅ Identificación oficial verificada</li>
                          <li>✅ Comprobante de domicilio validado</li>
                          <li>{selectedProduct ? '✅' : '⬜'} Producto verificado y entregado</li>
                          <li>⬜ Primer pago registrado (si aplica)</li>
                        </ul>
                      </div>

                      <button
                        onClick={deliverLoan}
                        disabled={isLoading}
                        className="w-full bg-lime-600 hover:bg-lime-700 disabled:bg-gray-600 text-neutral-800 py-4 px-6 rounded-lg font-bold text-lg transition-colors"
                      >
                        {isLoading ? "Finalizando..." : "🚀 Confirmar Entrega y Finalizar"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-8 border-t border-neutral-200 mt-8">
                  <button
                    type="button"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-white disabled:text-gray-500 text-neutral-800 rounded-lg font-medium transition-colors"
                  >
                    ← Anterior
                  </button>

                  <div className="flex gap-3">
                    {currentStep < 3 && (
                      <button
                        type="button"
                        onClick={saveLoan}
                        disabled={isLoading}
                        className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-neutral-800 rounded-lg font-medium transition-colors"
                      >
                        💾 Guardar
                      </button>
                    )}
                    
                    {currentStep < steps.length && currentStep !== 3 && currentStep !== 4 && currentStep !== 5 && (
                      <button
                        type="button"
                        onClick={nextStep}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-neutral-800 rounded-lg font-medium transition-colors"
                      >
                        Siguiente →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="bg-white rounded-xl p-6 border border-neutral-200">
                <h3 className="text-lg font-semibold text-neutral-800 mb-4">📊 Resumen Financiero</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Monto Total:</span>
                    <span className="text-neutral-800 font-semibold">${parseFloat(loanData.amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Enganche:</span>
                    <span className="text-neutral-800 font-semibold">${parseFloat(loanData.down_payment || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Financiado:</span>
                    <span className="text-primary-600 font-semibold">${(parseFloat(loanData.amount || 0) - parseFloat(loanData.down_payment || 0)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Pago Semanal:</span>
                    <span className="text-primary-600 font-bold text-lg">${parseFloat(calculations.weeklyPayment || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Total a Pagar:</span>
                    <span className="text-neutral-800 font-semibold">${parseFloat(calculations.totalPayable || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              {selectedCustomer && (
                <div className="bg-white rounded-xl p-6 border border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">👤 Cliente</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Nombre:</span>
                      <span className="text-neutral-800">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Teléfono:</span>
                      <span className="text-neutral-800">{selectedCustomer.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Email:</span>
                      <span className="text-neutral-800">{selectedCustomer.email || 'No registrado'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Product Info */}
              {selectedProduct && (
                <div className="bg-white rounded-xl p-6 border border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-4">📱 Producto</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Marca:</span>
                      <span className="text-neutral-800">{selectedProduct.brand}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Modelo:</span>
                      <span className="text-neutral-800">{selectedProduct.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Precio:</span>
                      <span className="text-neutral-800">${selectedProduct.sale_price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Stock:</span>
                      <span className="text-neutral-800">{selectedProduct.quantity}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UnifiedLoanSystem;