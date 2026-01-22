import React, { useEffect, useState, useRef, useMemo } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import axios from "axios";
import Layout from "../components/Layout";
import MovementLog from "../components/MovementLog";
import { API_BASE_URL } from "../utils/constants";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

const RegisterPayment = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [customerLoans, setCustomerLoans] = useState([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [storeId, setStoreId] = useState("");
  const [installments, setInstallments] = useState([]);
  const [movements, setMovements] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentBreakdowns, setPaymentBreakdowns] = useState([]);
  const [loanTotals, setLoanTotals] = useState(null);
  const [applyExtraTo, setApplyExtraTo] = useState("next");
  const [lastPayment, setLastPayment] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [showReceiptOptions, setShowReceiptOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  const receiptRef = useRef(null);
  const token = localStorage.getItem("token");

  // Enhanced collapsible section states
  const [expandedSections, setExpandedSections] = useState({
    loanInfo: true,
    amortization: true, // Show by default
    paymentForm: true,
    lastPayment: false,
    history: true, // Show by default
    breakdown: true, // Show by default
    movements: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFilteredCustomers(res.data);
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoanDetails = async (loanId) => {
    if (!loanId) return;
    setLoading(true);
    try {
      const [loanDetailRes, paymentsRes, breakdownsRes, movementsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/loans/${loanId}/details`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/loans/${loanId}/payments`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/loans/${loanId}/payment-breakdown`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/loans/${loanId}/financial-movements`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      
      const installmentsData = loanDetailRes.data?.installments || [];
      setInstallments(Array.isArray(installmentsData) ? installmentsData : []);
      
      const totalsData = loanDetailRes.data?.totals || null;
      setLoanTotals(totalsData);
      
      const paymentsWithAmounts = Array.isArray(paymentsRes.data)
        ? paymentsRes.data.filter(p => typeof p.amount !== "undefined")
        : [];
      setPaymentHistory(paymentsWithAmounts);
      
      const breakdownsData = breakdownsRes.data?.payment_breakdown || [];
      console.log("🔍 Payment breakdowns data:", breakdownsData);
      setPaymentBreakdowns(Array.isArray(breakdownsData) ? breakdownsData : []);
      
      setMovements(
        Array.isArray(movementsRes.data)
          ? movementsRes.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          : []
      );
    } catch (err) {
      console.error("Error fetching loan details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (!value.trim()) {
      setFilteredCustomers([]);
      return;
    }

    const filtered = filteredCustomers.filter(customer =>
      customer.first_name?.toLowerCase().includes(value.toLowerCase()) ||
      customer.last_name?.toLowerCase().includes(value.toLowerCase()) ||
      customer.id?.toString().includes(value) ||
      customer.phone?.includes(value)
    );
    setFilteredCustomers(filtered);
  };

  const handleSelectLoan = (loan) => {
    setSelectedLoan(loan);
    setActiveStep(3);
    fetchLoanDetails(loan.id);
    setStoreId(loan.store_id || "");
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedLoan || !amount || !method) {
      alert("Por favor complete todos los campos requeridos.");
      return;
    }

    setLoading(true);
    try {
      const paymentData = {
        loan_id: selectedLoan.id,
        amount: parseFloat(amount),
        payment_method: method,
        store_id: storeId,
        apply_extra_to: applyExtraTo,
      };

      const res = await axios.post(`${API_BASE_URL}/payments`, paymentData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setReceiptData(res.data);
      setPaymentSuccess(true);
      setShowReceiptOptions(true);
      
      // Refresh loan details
      await fetchLoanDetails(selectedLoan.id);
      
      // Reset form
      setAmount("");
      setMethod("efectivo");
      
      // Show success message
      setTimeout(() => {
        setPaymentSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error("Error processing payment:", err);
      alert("Error al procesar el pago. Por favor intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!receiptRef.current) return;
    
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`recibo-pago-${receiptData?.id || Date.now()}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Error al generar el PDF.");
    }
  };

  const generatePaymentReceipt = async (payment) => {
    try {
      // Create receipt data for historical payment
      const receiptData = {
        customer_name: selectedCustomer?.name || selectedCustomer?.first_name + " " + selectedCustomer?.last_name || "Cliente",
        customer_phone: selectedCustomer?.phone || selectedCustomer?.customer_phone || "",
        customer_address: selectedCustomer?.address || selectedCustomer?.customer_address || "",
        loan_id: selectedLoan?.id || "",
        payment_amount: payment.amount,
        payment_method: payment.payment_method || payment.method || "Efectivo",
        payment_date: new Date(payment.payment_date).toLocaleDateString(),
        payment_time: new Date(payment.payment_date).toLocaleTimeString(),
        receipt_number: `REC-${Date.now()}`,
        store_name: "CrediYa",
        store_address: "Dirección de la Tienda",
        store_phone: "Teléfono de la Tienda",
        payment_breakdown: payment.components || [],
        total_amount: payment.amount,
        remaining_balance: payment.remaining_balance || 0,
        installment_week: payment.installment_week || "N/A"
      };

      // Create a temporary div element and append it to the document
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.backgroundColor = '#ffffff';
      tempDiv.style.color = '#1a1a1a';
      tempDiv.style.padding = '40px';
      tempDiv.style.maxWidth = '500px';
      tempDiv.style.margin = '0 auto';
      tempDiv.style.fontFamily = 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
      tempDiv.style.fontSize = '14px';
      tempDiv.style.lineHeight = '1.6';
      tempDiv.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
      tempDiv.style.borderRadius = '12px';
      
      // Create the receipt HTML content with enhanced styling
      tempDiv.innerHTML = `
        <!-- Header with gradient background -->
        <div style="
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 24px;
          border-radius: 12px 12px 0 0;
          margin: -40px -40px 24px -40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        ">
          <!-- Decorative elements -->
          <div style="
            position: absolute;
            top: -20px;
            right: -20px;
            width: 80px;
            height: 80px;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
          "></div>
          <div style="
            position: absolute;
            bottom: -30px;
            left: -30px;
            width: 60px;
            height: 60px;
            background: rgba(255,255,255,0.08);
            border-radius: 50%;
          "></div>
          
          <h1 style="
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 8px 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          ">CrediYa</h1>
          <p style="
            font-size: 16px;
            margin: 0 0 12px 0;
            opacity: 0.95;
            font-weight: 500;
          ">Recibo de Pago</p>
          <div style="
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            opacity: 0.9;
            margin-top: 16px;
          ">
            <span>Fecha: ${receiptData.payment_date}</span>
            <span>Hora: ${receiptData.payment_time}</span>
          </div>
          <p style="
            font-size: 11px;
            margin: 8px 0 0 0;
            opacity: 0.8;
            font-family: 'Courier New', monospace;
          ">Recibo #: ${receiptData.receipt_number}</p>
        </div>

        <!-- Content sections with cards -->
        <div style="display: grid; gap: 20px;">
          <!-- Customer Info Card -->
          <div style="
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -8px;
              left: 16px;
              background: #10b981;
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            ">👤 Cliente</div>
            <h2 style="
              font-size: 16px;
              font-weight: 600;
              margin: 8px 0 12px 0;
              color: #1e293b;
            ">Información del Cliente</h2>
            <div style="display: grid; gap: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500; color: #64748b;">Nombre:</span>
                <span style="font-weight: 600; color: #1e293b;">${receiptData.customer_name}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500; color: #64748b;">Teléfono:</span>
                <span style="font-weight: 600; color: #1e293b;">${receiptData.customer_phone}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500; color: #64748b;">Dirección:</span>
                <span style="font-weight: 600; color: #1e293b;">${receiptData.customer_address}</span>
              </div>
            </div>
          </div>

          <!-- Loan Info Card -->
          <div style="
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -8px;
              left: 16px;
              background: #3b82f6;
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            ">📋 Préstamo</div>
            <h2 style="
              font-size: 16px;
              font-weight: 600;
              margin: 8px 0 12px 0;
              color: #1e293b;
            ">Información del Préstamo</h2>
            <div style="display: grid; gap: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500; color: #64748b;">Préstamo #:</span>
                <span style="font-weight: 600; color: #1e293b;">${receiptData.loan_id}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500; color: #64748b;">Semana:</span>
                <span style="font-weight: 600; color: #1e293b;">${receiptData.installment_week}</span>
              </div>
            </div>
          </div>

          <!-- Payment Details Card -->
          <div style="
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -8px;
              left: 16px;
              background: #f59e0b;
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            ">💰 Pago</div>
            <h2 style="
              font-size: 16px;
              font-weight: 600;
              margin: 8px 0 12px 0;
              color: #1e293b;
            ">Detalles del Pago</h2>
            <div style="display: grid; gap: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500; color: #64748b;">Método:</span>
                <span style="font-weight: 600; color: #1e293b; text-transform: capitalize;">${receiptData.payment_method}</span>
              </div>
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #10b981;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                margin-top: 8px;
              ">
                <span style="font-weight: 600;">Monto Total:</span>
                <span style="font-weight: 700; font-size: 16px;">$${parseFloat(receiptData.total_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>

          ${receiptData.payment_breakdown && receiptData.payment_breakdown.length > 0 ? `
          <!-- Payment Breakdown Card -->
          <div style="
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -8px;
              left: 16px;
              background: #8b5cf6;
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            ">📊 Desglose</div>
            <h2 style="
              font-size: 16px;
              font-weight: 600;
              margin: 8px 0 12px 0;
              color: #1e293b;
            ">Desglose del Pago</h2>
            <div style="
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              overflow: hidden;
            ">
              ${receiptData.payment_breakdown.map((component, index) => `
                <div style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 12px 16px;
                  ${index !== receiptData.payment_breakdown.length - 1 ? 'border-bottom: 1px solid #f1f5f9;' : ''}
                  background: ${index % 2 === 0 ? '#fafafa' : 'white'};
                ">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="
                      font-size: 16px;
                      ${component.type === 'capital' ? 'color: #10b981;' :
                        component.type === 'interest' ? 'color: #f59e0b;' :
                        'color: #ef4444;'}
                    ">
                      ${component.type === 'capital' ? '💰' :
                        component.type === 'interest' ? '📈' :
                        '⚠️'}
                    </span>
                    <span style="
                      font-weight: 500;
                      color: #374151;
                      text-transform: capitalize;
                    ">
                      ${component.type === 'capital' ? 'Capital' :
                        component.type === 'interest' ? 'Interés' :
                        component.type === 'penalty' ? 'Penalidad' : component.type}
                    </span>
                  </div>
                  <span style="
                    font-weight: 600;
                    color: #1e293b;
                    font-size: 15px;
                  ">$${parseFloat(component.amount || 0).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- Remaining Balance Card -->
          <div style="
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 1px solid #fbbf24;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
          ">
            <h3 style="
              font-size: 14px;
              font-weight: 600;
              color: #92400e;
              margin: 0 0 8px 0;
            ">Saldo Restante</h3>
            <p style="
              font-size: 20px;
              font-weight: 700;
              color: #92400e;
              margin: 0;
            ">$${parseFloat(receiptData.remaining_balance).toFixed(2)}</p>
          </div>
        </div>

        <!-- Footer -->
        <div style="
          text-align: center;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 2px solid #e2e8f0;
        ">
          <p style="
            font-size: 16px;
            color: #10b981;
            margin: 0 0 8px 0;
            font-weight: 600;
          ">✅ Gracias por su pago</p>
          <p style="
            font-size: 12px;
            color: #64748b;
            margin: 0 0 12px 0;
          ">Este es un recibo oficial de CrediYa</p>
          <div style="
            display: flex;
            justify-content: center;
            gap: 16px;
            font-size: 10px;
            color: #94a3b8;
          ">
            <span>📧 info@crediya.com</span>
            <span>📞 +52 55 1234 5678</span>
          </div>
        </div>
      `;

      // Append to document temporarily
      document.body.appendChild(tempDiv);

      // Generate PDF
      const canvas = await html2canvas(tempDiv, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      
      // Remove the temporary element
      document.body.removeChild(tempDiv);
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`recibo-pago-${receiptData.customer_name.replace(/[^a-zA-Z0-9]/g, '-')}-${receiptData.payment_date.replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error("Error generating payment receipt PDF:", error);
    }
  };

  const handleSelectCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setActiveStep(2);
    try {
      const res = await axios.get(`${API_BASE_URL}/customers/${customer.id}/loans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        const loansWithCustomer = res.data.map(loan => ({
          ...loan,
          id: Number(loan.loan_id || loan.id),
          first_name: loan.first_name || customer.first_name,
          last_name: loan.last_name || customer.last_name,
          customer_phone: loan.customer_phone || customer.phone,
          customer_address: loan.customer_address || customer.address,
        }));
        setCustomerLoans(loansWithCustomer);
        setSelectedLoan(null);
      } else {
        setCustomerLoans([]);
        alert("Este cliente no tiene préstamos registrados.");
      }
    } catch (err) {
      setCustomerLoans([]);
      console.error("Error fetching loans for customer:", err);
    }
  };

  // Enhanced data calculations
  const paymentStats = useMemo(() => {
    if (!selectedLoan || !loanTotals) return null;
    
    const totalPaid = parseFloat(loanTotals.totalPaid || 0);
    const totalDue = parseFloat(loanTotals.totalDue || 0);
    const remainingBalance = parseFloat(loanTotals.remainingBalance || 0);
    const progressPercentage = (totalPaid / totalDue) * 100;
    
    return {
      totalPaid,
      totalDue,
      remainingBalance,
      progressPercentage,
      paymentsCount: paymentHistory.length,
      lastPaymentDate: paymentHistory.length > 0 ? new Date(paymentHistory[paymentHistory.length - 1].payment_date) : null,
    };
  }, [selectedLoan, loanTotals, paymentHistory]);

  // Chart data for payment trends
  const chartData = useMemo(() => {
    if (!paymentHistory.length) return null;
    
    const recentPayments = paymentHistory.slice(-6);
    return {
      paymentTrends: {
        labels: recentPayments.map(p => new Date(p.payment_date).toLocaleDateString()),
        datasets: [{
          label: "Monto de Pago",
          data: recentPayments.map(p => parseFloat(p.amount)),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
        }],
      },
      paymentMethods: {
        labels: ["Efectivo", "Transferencia", "Tarjeta", "Otros"],
        datasets: [{
          data: [
            paymentHistory.filter(p => p.payment_method === "efectivo").length,
            paymentHistory.filter(p => p.payment_method === "transferencia").length,
            paymentHistory.filter(p => p.payment_method === "tarjeta").length,
            paymentHistory.filter(p => !["efectivo", "transferencia", "tarjeta"].includes(p.payment_method)).length,
          ],
          backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#6b7280"],
          borderWidth: 2,
          borderColor: "#1f2937",
        }],
      },
    };
  }, [paymentHistory]);

  const matchingCustomers = filteredCustomers.filter(customer =>
    customer.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.id?.toString().includes(searchTerm) ||
    customer.phone?.includes(searchTerm)
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Enhanced Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-800 mb-2">
            💰 Registrar Pago
          </h1>
          <p className="text-neutral-600">
            Sistema avanzado de registro de pagos con análisis en tiempo real
          </p>
        </div>

        {/* Enhanced Progress Flow */}
        <div className="bg-white border border-primary-500 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-8">
              {[
                { step: 1, label: "Cliente", icon: "👤", active: activeStep >= 1 },
                { step: 2, label: "Préstamo", icon: "📋", active: activeStep >= 2 },
                { step: 3, label: "Pago", icon: "💰", active: activeStep >= 3 },
              ].map((stepInfo, index) => (
                <div key={stepInfo.step} className="flex items-center">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                    stepInfo.active 
                      ? "border-lime-400 bg-lime-400 text-neutral-800" 
                      : "border-neutral-300 text-neutral-600"
                  }`}>
                    <span className="text-lg">{stepInfo.icon}</span>
                  </div>
                  <span className={`ml-3 font-medium ${
                    stepInfo.active ? "text-primary-600" : "text-neutral-600"
                  }`}>
                    {stepInfo.label}
                  </span>
                  {index < 2 && (
                    <div className={`w-16 h-0.5 ml-4 ${
                      activeStep > stepInfo.step ? "bg-lime-400" : "bg-gray-600"
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Enhanced Customer Selection Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-primary-500 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-600 mb-4 flex items-center">
                👤 Seleccionar Cliente
              </h3>
              
              {/* Enhanced Search */}
              <div className="relative mb-4">
                <input
                  type="text"
                  className="w-full bg-white border border-primary-500 rounded-lg px-4 py-3 text-neutral-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-400"
                  placeholder="Buscar por nombre, ID o teléfono..."
                  value={searchTerm}
                  onChange={handleSearch}
                />
                <div className="absolute right-3 top-3 text-neutral-600">
                  🔍
                </div>
              </div>

              {/* Customer List */}
              {matchingCustomers.length > 0 && (
                <div className="max-h-80 overflow-y-auto border border-primary-500 rounded-lg">
                  <div className="divide-y divide-primary-500">
                    {matchingCustomers.map(customer => (
                      <div
                        key={customer.id}
                        className={`p-4 transition-colors cursor-pointer hover:bg-white ${
                          customer.has_overdue ? 'bg-red-900/30 border-l-4 border-red-500' : 'bg-white'
                        }`}
                        onClick={() => handleSelectCustomer(customer)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-primary-600">#{customer.id}</span>
                              <span className="font-medium text-neutral-800">
                                {customer.first_name} {customer.last_name}
                              </span>
                            </div>
                            <div className="text-sm text-neutral-600 mb-2">
                              📞 {customer.phone || "Sin teléfono"}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                                {customer.loan_count || 0} préstamos
                              </span>
                              {customer.has_overdue && (
                                <span className="text-xs bg-red-600 px-2 py-1 rounded">
                                  ⚠️ Vencido
                                </span>
                              )}
                            </div>
                          </div>
                          <button className="bg-lime-600 hover:bg-lime-700 text-neutral-800 px-4 py-2 rounded-lg transition-colors">
                            Seleccionar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Customer Info */}
              {selectedCustomer && (
                <div className="mt-6 p-4 bg-white rounded-lg border border-lime-400">
                  <h4 className="text-primary-600 font-semibold mb-3">Cliente Seleccionado</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Nombre:</strong> {selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                    <p><strong>Teléfono:</strong> {selectedCustomer.phone || "N/A"}</p>
                    <p><strong>Préstamos:</strong> {customerLoans.length}</p>
                  </div>
                </div>
              )}

              {/* Loan Selection */}
              {customerLoans.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-primary-600 font-semibold mb-3">📋 Seleccionar Préstamo</h4>
                  <div className="space-y-3">
                    {customerLoans.map((loan) => {
                      const safeLoan = {
                        ...loan,
                        id: parseInt(loan.id),
                        amount: loan.amount,
                        status: loan.status,
                      };
                      return (
                        <div
                          key={`${safeLoan.id}-${safeLoan.amount}`}
                          className={`p-4 rounded-lg border transition-all cursor-pointer ${
                            selectedLoan?.id === safeLoan.id
                              ? "border-lime-400 bg-lime-400/10"
                              : "border-neutral-300 hover:border-lime-400 bg-white"
                          }`}
                          onClick={() => handleSelectLoan(safeLoan)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium text-neutral-800">
                                #{safeLoan.id} — ${parseFloat(safeLoan.amount).toLocaleString()}
                              </div>
                              <div className="text-sm text-neutral-600">
                                {safeLoan.status === 'approved' ? 'Aprobado' :
                                 safeLoan.status === 'delivered' ? 'Entregado' :
                                 safeLoan.status === 'pending' ? 'Pendiente' :
                                 safeLoan.status}
                              </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs ${
                              safeLoan.status === 'approved' ? 'bg-blue-600' :
                              safeLoan.status === 'delivered' ? 'bg-green-600' :
                              safeLoan.status === 'pending' ? 'bg-yellow-600' :
                              'bg-gray-600'
                            }`}>
                              {safeLoan.status}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Main Content */}
          <div className="lg:col-span-2">
            {selectedLoan ? (
              <div className="space-y-6">
                {/* Loan Summary Card */}
                <div className="bg-white border border-primary-500 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-semibold text-primary-600">
                      📋 Resumen del Préstamo #{selectedLoan.id}
                    </h3>
                    <button
                      onClick={() => toggleSection('loanInfo')}
                      className="text-neutral-600 hover:text-primary-600"
                    >
                      {expandedSections.loanInfo ? "🔽" : "▶️"}
                    </button>
                  </div>
                  
                  {expandedSections.loanInfo && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Basic Loan Info */}
                      <div className="space-y-4">
                        <div className="bg-white rounded-lg p-4">
                          <h4 className="text-primary-600 font-semibold mb-3">📋 Información del Préstamo</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-neutral-600">ID Préstamo:</span>
                              <span className="text-neutral-800 font-medium">#{selectedLoan.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Estado:</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                selectedLoan.status === 'approved' ? 'bg-blue-600' :
                                selectedLoan.status === 'delivered' ? 'bg-green-600' :
                                selectedLoan.status === 'pending' ? 'bg-yellow-600' :
                                'bg-gray-600'
                              }`}>
                                {selectedLoan.status === 'approved' ? 'Aprobado' :
                                 selectedLoan.status === 'delivered' ? 'Entregado' :
                                 selectedLoan.status === 'pending' ? 'Pendiente' :
                                 selectedLoan.status}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Monto Original:</span>
                              <span className="text-neutral-800 font-medium">${parseFloat(selectedLoan.amount).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Plazo:</span>
                              <span className="text-neutral-800 font-medium">{installments.length} semanas</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Pago Semanal:</span>
                              <span className="text-neutral-800 font-medium">
                                ${installments.length > 0 ? parseFloat(installments[0].amount_due).toFixed(2) : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Payment Progress */}
                        {paymentStats && (
                          <div className="bg-white rounded-lg p-4">
                            <h4 className="text-primary-600 font-semibold mb-3">💰 Progreso de Pagos</h4>
                            <div className="space-y-3">
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-neutral-600">Progreso</span>
                                  <span className="text-neutral-800">{paymentStats.progressPercentage.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-lime-400 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(paymentStats.progressPercentage, 100)}%` }}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="text-neutral-600">Total Pagado</div>
                                  <div className="text-neutral-800 font-medium">${paymentStats.totalPaid.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-neutral-600">Saldo Restante</div>
                                  <div className="text-neutral-800 font-medium">${paymentStats.remainingBalance.toLocaleString()}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Customer Info & Charts */}
                      <div className="space-y-4">
                        <div className="bg-white rounded-lg p-4">
                          <h4 className="text-primary-600 font-semibold mb-3">👤 Información del Cliente</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Cliente:</span>
                              <span className="text-neutral-800">{selectedLoan.first_name || ""} {selectedLoan.last_name || ""}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Teléfono:</span>
                              <span className="text-neutral-800">{selectedLoan.customer_phone || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Dirección:</span>
                              <span className="text-neutral-800">{selectedLoan.customer_address || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Fecha de Creación:</span>
                              <span className="text-neutral-800">
                                {selectedLoan.created_at ? new Date(selectedLoan.created_at).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Payment Methods Chart */}
                        {chartData && (
                          <div className="bg-white rounded-lg p-4">
                            <h4 className="text-primary-600 font-semibold mb-3">💳 Métodos de Pago</h4>
                            <div className="h-32">
                              <Doughnut
                                data={chartData.paymentMethods}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: {
                                      position: "bottom",
                                      labels: { color: "white", font: { size: 10 } },
                                    },
                                  },
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Form */}
                <div className="bg-white border border-primary-500 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-semibold text-primary-600">
                      💰 Registrar Pago
                    </h3>
                    <button
                      onClick={() => toggleSection('paymentForm')}
                      className="text-neutral-600 hover:text-primary-600"
                    >
                      {expandedSections.paymentForm ? "🔽" : "▶️"}
                    </button>
                  </div>

                  {expandedSections.paymentForm && (
                    <form onSubmit={handlePayment} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Monto del Pago
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-white border border-primary-500 rounded-lg px-4 py-3 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-400"
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Método de Pago
                          </label>
                          <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="w-full bg-white border border-primary-500 rounded-lg px-4 py-3 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-400"
                            required
                          >
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="cheque">Cheque</option>
                            <option value="otro">Otro</option>
                          </select>
                        </div>
                      </div>

                      {/* Advanced Options */}
                      <div className="border-t border-neutral-200 pt-4">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                          className="text-primary-600 hover:text-lime-300 text-sm flex items-center gap-2"
                        >
                          {showAdvancedOptions ? "🔽" : "▶️"} Opciones Avanzadas
                        </button>
                        
                        {showAdvancedOptions && (
                          <div className="mt-4 space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-2">
                                Aplicar Extra a
                              </label>
                              <select
                                value={applyExtraTo}
                                onChange={(e) => setApplyExtraTo(e.target.value)}
                                className="w-full bg-white border border-primary-500 rounded-lg px-4 py-3 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-400"
                              >
                                <option value="next">Próximo pago</option>
                                <option value="capital">Capital</option>
                                <option value="interest">Interés</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Success Message */}
                      {paymentSuccess && (
                        <div className="bg-green-600/20 border border-green-500 rounded-lg p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-primary-500">✅</span>
                            <span className="text-primary-500 font-medium">
                              Pago registrado exitosamente
                            </span>
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-lime-600 hover:bg-lime-700 disabled:bg-gray-600 text-neutral-800 font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Procesando...
                          </>
                        ) : (
                          <>
                            💰 Registrar Pago
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>

                                 {/* Amortization Table */}
                 {installments.length > 0 && (
                   <div className="bg-white border border-primary-500 rounded-lg p-6">
                     <div className="flex justify-between items-start mb-4">
                       <h3 className="text-xl font-semibold text-primary-600">
                         📆 Tabla de Amortización
                       </h3>
                       <button
                         onClick={() => toggleSection('amortization')}
                         className="text-neutral-600 hover:text-primary-600"
                       >
                         {expandedSections.amortization ? "🔽" : "▶️"}
                       </button>
                     </div>

                     {expandedSections.amortization && (
                       <div className="space-y-4">
                         {/* Color Legend */}
                         <div className="bg-white rounded-lg p-4">
                           <h4 className="text-primary-600 font-semibold mb-3">🎨 Leyenda de Estados</h4>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                             <div className="flex items-center gap-2">
                               <div className="w-4 h-4 bg-green-800 rounded-sm"></div>
                               <span className="text-neutral-800">Pagado</span>
                             </div>
                             <div className="flex items-center gap-2">
                               <div className="w-4 h-4 bg-white rounded-sm"></div>
                               <span className="text-neutral-800">Pendiente</span>
                             </div>
                             <div className="flex items-center gap-2">
                               <div className="w-4 h-4 bg-yellow-600 rounded-sm"></div>
                               <span className="text-neutral-800">1-7 días vencido</span>
                             </div>
                             <div className="flex items-center gap-2">
                               <div className="w-4 h-4 bg-red-800 rounded-sm"></div>
                               <span className="text-neutral-800">&gt;7 días vencido</span>
                             </div>
                           </div>
                         </div>

                         {/* Amortization Table */}
                         <div className="bg-white rounded-lg p-4 overflow-x-auto">
                           <table className="min-w-full text-xs">
                             <thead>
                               <tr className="border-b border-neutral-300">
                                 <th className="px-3 py-2 text-left text-primary-600">Semana</th>
                                 <th className="px-3 py-2 text-left text-primary-600">Fecha</th>
                                 <th className="px-3 py-2 text-right text-primary-600">Capital</th>
                                 <th className="px-3 py-2 text-right text-primary-600">Interés</th>
                                 <th className="px-3 py-2 text-right text-primary-600">Penalidad</th>
                                 <th className="px-3 py-2 text-right text-primary-600">Total</th>
                                 <th className="px-3 py-2 text-right text-primary-600">Pagado</th>
                                 <th className="px-3 py-2 text-right text-primary-600">Saldo</th>
                                 <th className="px-3 py-2 text-center text-primary-600">Estado</th>
                               </tr>
                             </thead>
                             <tbody>
                                                                {installments.map(inst => {
                                   // Defensive programming - ensure inst exists and has required properties
                                   if (!inst) return null;
                                   
                                   const dueDate = new Date(inst.due_date || new Date());
                                   const today = new Date();
                                   const msInDay = 1000 * 60 * 60 * 24;
                                   const daysOverdue = Math.floor((today - dueDate) / msInDay);
                                   
                                   let bgClass = "";
                                   if (inst.status === "pending") {
                                     if (daysOverdue > 7) bgClass = "bg-red-800";
                                     else if (daysOverdue > 0) bgClass = "bg-yellow-600";
                                     else bgClass = "bg-white";
                                   } else if (inst.status === "paid") {
                                     bgClass = "bg-green-800";
                                   } else {
                                     bgClass = "bg-white";
                                   }

                                   const totalDue = (
                                     parseFloat(inst.capital_portion || 0) +
                                     parseFloat(inst.interest_portion || 0) +
                                     parseFloat(inst.penalty_applied || 0)
                                   );

                                   const totalPaid = (
                                     parseFloat(inst.capital_paid || 0) +
                                     parseFloat(inst.interest_paid || 0) +
                                     parseFloat(inst.penalty_paid || 0)
                                   );

                                   const remaining = totalDue - totalPaid;

                                 return (
                                   <tr key={inst.week_number} className={`${bgClass} border-b border-neutral-200 hover:bg-gray-700 transition-colors`}>
                                     <td className="px-3 py-2 font-bold text-neutral-800">{inst.week_number}</td>
                                     <td className="px-3 py-2 text-neutral-800">{dueDate.toLocaleDateString()}</td>
                                     <td className="px-3 py-2 text-right text-neutral-800">
                                       ${parseFloat(inst.capital_portion || 0).toFixed(2)}
                                     </td>
                                     <td className="px-3 py-2 text-right text-neutral-800">
                                       {(() => {
                                         const interestPortion = parseFloat(inst.interest_portion || 0);
                                         const interestPaid = parseFloat(inst.interest_paid || 0);
                                         
                                         if (interestPaid > 0 && interestPaid < interestPortion) {
                                           return `$${interestPaid.toFixed(2)} (de $${interestPortion.toFixed(2)})`;
                                         } else {
                                           return `$${interestPortion.toFixed(2)}`;
                                         }
                                       })()}
                                     </td>
                                     <td className="px-3 py-2 text-right text-neutral-800">
                                       {(() => {
                                         const penaltyApplied = parseFloat(inst.penalty_applied || 0);
                                         const penaltyPaid = parseFloat(inst.penalty_paid || 0);
                                         
                                         if (penaltyPaid > 0 && penaltyPaid < penaltyApplied) {
                                           return `$${penaltyPaid.toFixed(2)} (de $${penaltyApplied.toFixed(2)})`;
                                         } else {
                                           return `$${penaltyApplied.toFixed(2)}`;
                                         }
                                       })()}
                                     </td>
                                     <td className="px-3 py-2 text-right font-bold text-neutral-800">
                                       ${totalDue.toFixed(2)}
                                     </td>
                                     <td className="px-3 py-2 text-right text-neutral-800">
                                       ${totalPaid.toFixed(2)}
                                     </td>
                                     <td className="px-3 py-2 text-right text-neutral-800">
                                       ${remaining.toFixed(2)}
                                     </td>
                                     <td className="px-3 py-2 text-center">
                                       <span className={`px-2 py-1 rounded text-xs ${
                                         inst.status === 'paid' ? 'bg-green-600' :
                                         inst.status === 'pending' ? 'bg-yellow-600' :
                                         'bg-gray-600'
                                       }`}>
                                         {inst.status === 'paid' ? 'Pagado' :
                                          inst.status === 'pending' ? 'Pendiente' :
                                          inst.status}
                                       </span>
                                     </td>
                                   </tr>
                                 );
                               })}
                             </tbody>
                           </table>
                         </div>
                       </div>
                     )}
                   </div>
                 )}

                 {/* Payment History & Charts */}
                 {paymentHistory.length > 0 && (
                   <div className="bg-white border border-primary-500 rounded-lg p-6">
                     <div className="flex justify-between items-start mb-4">
                       <h3 className="text-xl font-semibold text-primary-600">
                         📊 Historial de Pagos
                       </h3>
                       <button
                         onClick={() => toggleSection('history')}
                         className="text-neutral-600 hover:text-primary-600"
                       >
                         {expandedSections.history ? "🔽" : "▶️"}
                       </button>
                     </div>

                     {expandedSections.history && (
                       <div className="space-y-6">
                         {/* Payment Trends Chart */}
                         {chartData && (
                           <div className="bg-white rounded-lg p-4">
                             <h4 className="text-primary-600 font-semibold mb-3">📈 Tendencias de Pagos</h4>
                             <div className="h-64">
                               <Line
                                 data={chartData.paymentTrends}
                                 options={{
                                   responsive: true,
                                   maintainAspectRatio: false,
                                   plugins: {
                                     legend: {
                                       labels: { color: "white" },
                                     },
                                   },
                                   scales: {
                                     y: {
                                       beginAtZero: true,
                                       ticks: { color: "white" },
                                       grid: { color: "rgba(255,255,255,0.1)" },
                                     },
                                     x: {
                                       ticks: { color: "white" },
                                       grid: { color: "rgba(255,255,255,0.1)" },
                                     },
                                   },
                                 }}
                               />
                             </div>
                           </div>
                         )}

                         {/* Recent Payments Table */}
                         <div className="bg-white rounded-lg p-4">
                           <h4 className="text-primary-600 font-semibold mb-3">💳 Pagos Recientes</h4>
                           <div className="overflow-x-auto">
                             <table className="min-w-full text-sm">
                               <thead>
                                 <tr className="border-b border-neutral-300">
                                   <th className="text-left py-2 text-neutral-600">Fecha</th>
                                   <th className="text-left py-2 text-neutral-600">Monto</th>
                                   <th className="text-left py-2 text-neutral-600">Método</th>
                                   <th className="text-left py-2 text-neutral-600">Estado</th>
                                   <th className="text-center py-2 text-neutral-600">Acciones</th>
                                 </tr>
                               </thead>
                               <tbody>
                                 {paymentHistory.slice(-5).map((payment, index) => (
                                   <tr key={index} className="border-b border-neutral-200">
                                     <td className="py-2 text-neutral-800">
                                       {new Date(payment.payment_date).toLocaleDateString()}
                                     </td>
                                     <td className="py-2 text-neutral-800">
                                       ${parseFloat(payment.amount).toLocaleString()}
                                     </td>
                                     <td className="py-2 text-neutral-800 capitalize">
                                       {payment.payment_method || payment.method || 'Efectivo'}
                                     </td>
                                     <td className="py-2">
                                       <span className="px-2 py-1 rounded text-xs bg-green-600">
                                         Completado
                                       </span>
                                     </td>
                                     <td className="py-2 text-center">
                                       <button
                                         onClick={() => generatePaymentReceipt(payment)}
                                         className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-neutral-800 text-xs rounded transition-colors"
                                         title="Descargar Recibo PDF"
                                       >
                                         📄 PDF
                                       </button>
                                     </td>
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                         </div>
                       </div>
                     )}
                   </div>
                 )}

                 {/* Payment Breakdown Log */}
                 {paymentBreakdowns.length > 0 && (
                   <div className="bg-white border border-primary-500 rounded-lg p-6">
                     <div className="flex justify-between items-start mb-4">
                       <h3 className="text-xl font-semibold text-primary-600">
                         📋 Desglose Detallado de Pagos
                       </h3>
                       <button
                         onClick={() => toggleSection('breakdown')}
                         className="text-neutral-600 hover:text-primary-600"
                       >
                         {expandedSections.breakdown ? "🔽" : "▶️"}
                       </button>
                     </div>

                     {expandedSections.breakdown && (
                       <div className="bg-white rounded-lg p-4 overflow-x-auto">
                         <table className="min-w-full text-sm">
                           <thead>
                             <tr className="border-b border-neutral-300">
                               <th className="px-3 py-2 text-left text-primary-600">Fecha</th>
                               <th className="px-3 py-2 text-left text-primary-600">Tipo</th>
                               <th className="px-3 py-2 text-left text-primary-600">Semana</th>
                               <th className="px-3 py-2 text-right text-primary-600">Monto</th>
                             </tr>
                           </thead>
                           <tbody>
                             {paymentBreakdowns.map((payment, idx) => (
                               <React.Fragment key={idx}>
                                 {/* Component breakdown rows - show each component as main row */}
                                 {payment.components?.map((component, compIdx) => (
                                   <tr key={`${idx}-${compIdx}`} className="border-t border-neutral-300 bg-gray-700">
                                     <td className="px-3 py-2 text-neutral-800 font-medium">
                                       {new Date(payment.payment_date).toLocaleDateString()}
                                     </td>
                                     <td className="px-3 py-2 text-neutral-800 font-bold">
                                       {component.type === 'capital' ? '💰 Capital' :
                                        component.type === 'interest' ? '📈 Interés' :
                                        component.type === 'penalty' ? '⚠️ Penalidad' :
                                        component.type}
                                     </td>
                                     <td className="px-3 py-2 text-neutral-800">Semana {payment.installment_week}</td>
                                     <td className="px-3 py-2 text-right text-neutral-800 font-bold">
                                       ${parseFloat(component.amount || 0).toFixed(2)}
                                     </td>
                                   </tr>
                                 ))}
                                 
                                 {/* Show "Pago Total" as summary row */}
                                 {payment.components && payment.components.length > 1 && (
                                   <tr className="border-t-2 border-lime-400 bg-white">
                                     <td className="px-3 py-2 text-neutral-800 font-medium">
                                       {new Date(payment.payment_date).toLocaleDateString()}
                                     </td>
                                     <td className="px-3 py-2 text-neutral-800 font-bold">📊 Pago Total</td>
                                     <td className="px-3 py-2 text-neutral-800">Semana {payment.installment_week}</td>
                                     <td className="px-3 py-2 text-right text-neutral-800 font-bold">
                                       ${parseFloat(payment.total_amount || 0).toFixed(2)}
                                     </td>
                                   </tr>
                                 )}
                                 

                                 

                               </React.Fragment>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     )}
                   </div>
                 )}

                {/* Receipt Options */}
                {showReceiptOptions && receiptData && (
                  <div className="bg-white border border-primary-500 rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-primary-600 mb-4">
                      📄 Opciones de Recibo
                    </h3>
                    <div className="flex gap-4">
                      <button
                        onClick={downloadPDF}
                        className="bg-red-600 hover:bg-red-700 text-neutral-800 px-6 py-3 rounded-lg transition-colors"
                      >
                        📄 Descargar PDF
                      </button>
                      <button
                        onClick={() => setShowReceiptOptions(false)}
                        className="bg-gray-600 hover:bg-gray-700 text-neutral-800 px-6 py-3 rounded-lg transition-colors"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-primary-500 rounded-lg p-12 text-center">
                <div className="text-6xl mb-4">💰</div>
                <h3 className="text-xl font-semibold text-neutral-800 mb-2">
                  Selecciona un Cliente y Préstamo
                </h3>
                <p className="text-neutral-600">
                  Para registrar un pago, primero selecciona un cliente y luego un préstamo
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RegisterPayment;
