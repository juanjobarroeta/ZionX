import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import Layout from '../components/Layout';
import { API_BASE_URL } from "../utils/constants";
import { Line, Doughnut } from 'react-chartjs-2';
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
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Function to convert image to base64
const getImageAsBase64 = (imagePath) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = reject;
    img.src = imagePath;
  });
};

const LoanQuotes = () => {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phoneType, setPhoneType] = useState('');
  const [phonePrice, setPhonePrice] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('quote');
  const [recentQuotes, setRecentQuotes] = useState([]);

  useEffect(() => {
    // Fetch financial products
    setLoading(true);
    axios.get(`${API_BASE_URL}/public/financial-products`)
      .then(res => {
        setProducts(res.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching financial products:', err);
        setLoading(false);
      });
  }, []);

  // Real-time quote calculation
  const calculatedQuote = useMemo(() => {
    if (!selectedProductId || !phonePrice) return null;

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return null;

    const annualRate = parseFloat(product.interest_rate) / 100;
    const financedAmount = parseFloat(phonePrice);
    const weeklyRate = annualRate / 52;
    
    // Calculate weekly payment using proper amortization formula
    const weeklyPayment = financedAmount * (weeklyRate * Math.pow(1 + weeklyRate, product.term_weeks)) / 
                         (Math.pow(1 + weeklyRate, product.term_weeks) - 1);
    
    const totalRepay = weeklyPayment * product.term_weeks;
    const totalInterest = totalRepay - financedAmount;

    // Generate amortization schedule
    const amortizationSchedule = [];
    let balance = financedAmount;
    for (let i = 1; i <= product.term_weeks; i++) {
      const interestPayment = balance * weeklyRate;
      const principalPayment = weeklyPayment - interestPayment;
      balance -= principalPayment;
      
      if (balance < 0) balance = 0;
      
      amortizationSchedule.push({
        week: i,
        payment: weeklyPayment.toFixed(2),
        principal: principalPayment.toFixed(2),
        interest: interestPayment.toFixed(2),
        balance: balance.toFixed(2),
      });
    }

    return {
      customerName,
      phoneType,
      phonePrice: financedAmount.toFixed(2),
      term: product.term_weeks,
      interestRate: annualRate * 100,
      totalRepay: totalRepay.toFixed(2),
      weeklyPayment: weeklyPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      amortizationSchedule,
      product: product
    };
  }, [selectedProductId, phonePrice, customerName, phoneType, products]);

  const generateQuote = (e) => {
    e.preventDefault();
    if (!calculatedQuote) return;

    setQuote(calculatedQuote);
    setActiveTab('results');
    
    // Add to recent quotes
    setRecentQuotes(prev => [calculatedQuote, ...prev.slice(0, 4)]);
  };

  const downloadPDF = async () => {
    if (!quote) return;

    const doc = new jsPDF();
    
    // Add logo
    try {
      const logoBase64 = await getImageAsBase64('/logo2.png');
      doc.addImage(logoBase64, 'PNG', 20, 5, 30, 20);
    } catch (e) {
      console.log('Logo not available, continuing without it');
    }

    // Header with CrediYa branding
    doc.setFillColor(60, 91, 193);
    doc.rect(0, 0, 210, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('CrediYa', 25, 22);
    
    doc.setTextColor(46, 61, 123);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Cotización de Préstamo', 25, 50);
    
    // Quote details
    doc.setFillColor(244, 246, 250);
    doc.rect(20, 60, 170, 45, 'F');
    
    doc.setTextColor(51, 51, 51);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${quote.customerName}`, 25, 70);
    doc.text(`Teléfono: ${quote.phoneType}`, 25, 80);
    doc.text(`Precio: $${quote.phonePrice} MXN`, 25, 90);
    doc.text(`Plazo: ${quote.term} semanas`, 115, 70);
    doc.text(`Pago semanal: $${quote.weeklyPayment} MXN`, 115, 80);
    doc.text(`Tasa de interés: ${quote.interestRate.toFixed(2)}% anual`, 115, 90);
    
    // Summary box
    doc.setFillColor(95, 120, 226);
    doc.rect(20, 115, 170, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen del Préstamo', 25, 125);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total a pagar: $${quote.totalRepay} MXN`, 25, 135);
    doc.text(`Interés total: $${quote.totalInterest} MXN`, 115, 135);

    // Amortization table
    doc.setTextColor(46, 61, 123);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Calendario de Amortización', 25, 160);
    
    const startY = 170;
    let y = startY;
    
    // Table header
    doc.setFillColor(60, 91, 193);
    doc.rect(20, y - 5, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Semana', 25, y);
    doc.text('Pago (MXN)', 50, y);
    doc.text('Principal (MXN)', 80, y);
    doc.text('Interés (MXN)', 115, y);
    doc.text('Saldo (MXN)', 150, y);
    
    y += 8;
    
    // Table rows
    quote.amortizationSchedule.forEach((row, index) => {
      if (y > 280) {
        doc.addPage();
        y = 25;
        
        // Repeat header on new page
        doc.setFillColor(60, 91, 193);
        doc.rect(20, y - 5, 170, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Semana', 25, y);
        doc.text('Pago (MXN)', 50, y);
        doc.text('Principal (MXN)', 80, y);
        doc.text('Interés (MXN)', 115, y);
        doc.text('Saldo (MXN)', 150, y);
        y += 8;
      }
      
      if (index % 2 === 0) {
        doc.setFillColor(250, 251, 253);
        doc.rect(20, y - 3, 170, 6, 'F');
      }
      
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(row.week.toString(), 25, y);
      doc.text(`$${row.payment}`, 50, y);
      doc.text(`$${row.principal}`, 80, y);
      doc.text(`$${row.interest}`, 115, y);
      doc.text(`$${row.balance}`, 150, y);
      y += 6;
    });
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setTextColor(122, 122, 122);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Página ${i} de ${pageCount}`, 25, 290);
      doc.text(`Generado el ${new Date().toLocaleDateString('es-MX')}`, 150, 290);
      
      doc.setFillColor(60, 91, 193);
      doc.rect(0, 295, 210, 5, 'F');
    }

    doc.save(`CotizacionPrestamo_${quote.customerName.replace(/\s+/g, '_')}.pdf`);
  };

  // Chart data for payment breakdown
  const chartData = useMemo(() => {
    if (!calculatedQuote) return null;

    return {
      labels: ['Principal', 'Interés'],
      datasets: [{
        data: [parseFloat(calculatedQuote.phonePrice), parseFloat(calculatedQuote.totalInterest)],
        backgroundColor: ['#10B981', '#F59E0B'],
        borderColor: ['#059669', '#D97706'],
        borderWidth: 2,
      }]
    };
  }, [calculatedQuote]);

  // Chart data for payment schedule
  const paymentChartData = useMemo(() => {
    if (!calculatedQuote?.amortizationSchedule) return null;

    const weeks = calculatedQuote.amortizationSchedule.map(row => `Semana ${row.week}`);
    const balances = calculatedQuote.amortizationSchedule.map(row => parseFloat(row.balance));

    return {
      labels: weeks,
      datasets: [{
        label: 'Saldo Restante',
        data: balances,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      }]
    };
  }, [calculatedQuote]);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100 text-neutral-800">
        {/* Header */}
        <div className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">💰 Cotizador de Préstamos</h1>
              <p className="text-neutral-600">Genera cotizaciones profesionales con análisis detallado</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab('quote')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === 'quote' 
                    ? 'bg-primary-500 text-neutral-800' 
                    : 'bg-gray-700 text-neutral-800 hover:bg-gray-600'
                }`}
              >
                📝 Nueva Cotización
              </button>
              <button
                onClick={() => setActiveTab('recent')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === 'recent' 
                    ? 'bg-primary-500 text-neutral-800' 
                    : 'bg-gray-700 text-neutral-800 hover:bg-gray-600'
                }`}
              >
                📋 Recientes
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'quote' && (
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quote Form */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-xl border border-neutral-200 p-6">
                    <h2 className="text-xl font-bold mb-6 text-neutral-800">📋 Información del Cliente</h2>
                    
                    <form onSubmit={generateQuote} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            👤 Nombre del Cliente
                          </label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={e => setCustomerName(e.target.value)}
                            className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-3 text-neutral-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                            placeholder="Nombre completo"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            📱 Teléfono
                          </label>
                          <input
                            type="tel"
                            value={customerPhone}
                            onChange={e => setCustomerPhone(e.target.value)}
                            className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-3 text-neutral-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                            placeholder="555-123-4567"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            📧 Email
                          </label>
                          <input
                            type="email"
                            value={customerEmail}
                            onChange={e => setCustomerEmail(e.target.value)}
                            className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-3 text-neutral-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                            placeholder="cliente@email.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            📱 Tipo de Teléfono
                          </label>
                          <input
                            type="text"
                            value={phoneType}
                            onChange={e => setPhoneType(e.target.value)}
                            className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-3 text-neutral-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                            placeholder="iPhone 14 Pro"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            💰 Precio del Teléfono (MXN)
                          </label>
                          <input
                            type="number"
                            value={phonePrice}
                            onChange={e => setPhonePrice(e.target.value)}
                            className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-3 text-neutral-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                            placeholder="15000"
                            min="1"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            🏦 Producto Financiero
                          </label>
                          <select
                            value={selectedProductId}
                            onChange={e => setSelectedProductId(e.target.value)}
                            className="w-full bg-gray-700 border border-neutral-300 rounded-lg px-4 py-3 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                            required
                          >
                            <option value="">Seleccionar producto...</option>
                            {products.map(product => (
                              <option key={product.id} value={product.id}>
                                {product.title} - {product.term_weeks} semanas @ {product.interest_rate}%
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={!calculatedQuote}
                        className="w-full bg-primary-500 text-neutral-800 font-bold py-4 px-6 rounded-lg hover:bg-lime-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        🚀 Generar Cotización
                      </button>
                    </form>
                  </div>
                </div>

                {/* Real-time Preview */}
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-xl border border-neutral-200 p-6">
                    <h3 className="text-lg font-bold mb-4 text-neutral-800">📊 Vista Previa</h3>
                    
                    {calculatedQuote ? (
                      <div className="space-y-4">
                        <div className="bg-gray-700 rounded-lg p-4">
                          <h4 className="font-semibold text-primary-600 mb-2">💰 Resumen</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-neutral-700">Precio:</span>
                              <span className="text-neutral-800 font-medium">${calculatedQuote.phonePrice}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-700">Pago Semanal:</span>
                              <span className="text-neutral-800 font-medium">${calculatedQuote.weeklyPayment}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-700">Total a Pagar:</span>
                              <span className="text-neutral-800 font-medium">${calculatedQuote.totalRepay}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-700">Interés Total:</span>
                              <span className="text-neutral-800 font-medium">${calculatedQuote.totalInterest}</span>
                            </div>
                          </div>
                        </div>

                        {chartData && (
                          <div className="bg-gray-700 rounded-lg p-4">
                            <h4 className="font-semibold text-primary-600 mb-2">📈 Desglose</h4>
                            <div className="h-32">
                              <Doughnut 
                                data={chartData}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: {
                                      position: 'bottom',
                                      labels: {
                                        color: '#D1D5DB',
                                        font: { size: 10 }
                                      }
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-neutral-600 py-8">
                        <div className="text-4xl mb-2">📊</div>
                        <p>Completa el formulario para ver la vista previa</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'results' && quote && (
            <div className="max-w-6xl mx-auto">
              <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-neutral-800">📋 Cotización Generada</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setActiveTab('quote')}
                      className="px-4 py-2 bg-gray-700 text-neutral-800 rounded-lg hover:bg-gray-600 transition"
                    >
                      🔄 Nueva Cotización
                    </button>
                    <button
                      onClick={downloadPDF}
                      className="px-4 py-2 bg-primary-500 text-neutral-800 font-bold rounded-lg hover:bg-lime-400 transition"
                    >
                      📄 Descargar PDF
                    </button>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-200 text-sm">Precio del Teléfono</p>
                        <p className="text-neutral-800 text-xl font-bold">${quote.phonePrice}</p>
                      </div>
                      <div className="text-blue-200 text-2xl">📱</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-200 text-sm">Pago Semanal</p>
                        <p className="text-neutral-800 text-xl font-bold">${quote.weeklyPayment}</p>
                      </div>
                      <div className="text-green-200 text-2xl">💰</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-200 text-sm">Total a Pagar</p>
                        <p className="text-neutral-800 text-xl font-bold">${quote.totalRepay}</p>
                      </div>
                      <div className="text-purple-200 text-2xl">📊</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-200 text-sm">Interés Total</p>
                        <p className="text-neutral-800 text-xl font-bold">${quote.totalInterest}</p>
                      </div>
                      <div className="text-orange-200 text-2xl">📈</div>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-gray-700 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-3">👤 Información del Cliente</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-neutral-600">Nombre:</span>
                      <span className="text-neutral-800 ml-2 font-medium">{quote.customerName}</span>
                    </div>
                    <div>
                      <span className="text-neutral-600">Teléfono:</span>
                      <span className="text-neutral-800 ml-2 font-medium">{quote.phoneType}</span>
                    </div>
                    {customerPhone && (
                      <div>
                        <span className="text-neutral-600">Contacto:</span>
                        <span className="text-neutral-800 ml-2 font-medium">{customerPhone}</span>
                      </div>
                    )}
                    {customerEmail && (
                      <div>
                        <span className="text-neutral-600">Email:</span>
                        <span className="text-neutral-800 ml-2 font-medium">{customerEmail}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {chartData && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-3">📊 Desglose de Pagos</h3>
                      <div className="h-64">
                        <Doughnut 
                          data={chartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom',
                                labels: {
                                  color: '#D1D5DB',
                                  font: { size: 12 }
                                }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {paymentChartData && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-3">📈 Progreso del Saldo</h3>
                      <div className="h-64">
                        <Line 
                          data={paymentChartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                labels: {
                                  color: '#D1D5DB'
                                }
                              }
                            },
                            scales: {
                              x: {
                                ticks: {
                                  color: '#D1D5DB',
                                  maxTicksLimit: 10
                                },
                                grid: {
                                  color: '#374151'
                                }
                              },
                              y: {
                                ticks: {
                                  color: '#D1D5DB'
                                },
                                grid: {
                                  color: '#374151'
                                }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Amortization Table */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-neutral-800 mb-3">📅 Calendario de Amortización</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-600">
                        <tr>
                          <th className="px-3 py-2 text-left text-neutral-800 font-semibold">Semana</th>
                          <th className="px-3 py-2 text-right text-neutral-800 font-semibold">Pago (MXN)</th>
                          <th className="px-3 py-2 text-right text-neutral-800 font-semibold">Principal (MXN)</th>
                          <th className="px-3 py-2 text-right text-neutral-800 font-semibold">Interés (MXN)</th>
                          <th className="px-3 py-2 text-right text-neutral-800 font-semibold">Saldo (MXN)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-600">
                        {quote.amortizationSchedule.map((row, index) => (
                          <tr key={row.week} className={index % 2 === 0 ? 'bg-gray-700' : 'bg-white'}>
                            <td className="px-3 py-2 text-neutral-800 font-medium">{row.week}</td>
                            <td className="px-3 py-2 text-right text-neutral-800">${row.payment}</td>
                            <td className="px-3 py-2 text-right text-primary-500">${row.principal}</td>
                            <td className="px-3 py-2 text-right text-orange-400">${row.interest}</td>
                            <td className="px-3 py-2 text-right text-primary-500">${row.balance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'recent' && (
            <div className="max-w-6xl mx-auto">
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h2 className="text-2xl font-bold mb-6 text-neutral-800">📋 Cotizaciones Recientes</h2>
                
                {recentQuotes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentQuotes.map((recentQuote, index) => (
                      <div key={index} className="bg-gray-700 rounded-lg p-4 border border-neutral-300">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-neutral-800">{recentQuote.customerName}</h3>
                          <span className="text-xs text-neutral-600">#{index + 1}</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Teléfono:</span>
                            <span className="text-neutral-800">{recentQuote.phoneType}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Precio:</span>
                            <span className="text-neutral-800">${recentQuote.phonePrice}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Pago Semanal:</span>
                            <span className="text-neutral-800">${recentQuote.weeklyPayment}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Total:</span>
                            <span className="text-neutral-800 font-medium">${recentQuote.totalRepay}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setQuote(recentQuote);
                            setActiveTab('results');
                          }}
                          className="w-full mt-3 px-3 py-2 bg-primary-500 text-neutral-800 text-sm font-medium rounded hover:bg-lime-400 transition"
                        >
                          👁️ Ver Detalles
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-neutral-600 py-8">
                    <div className="text-4xl mb-2">📋</div>
                    <p>No hay cotizaciones recientes</p>
                    <button
                      onClick={() => setActiveTab('quote')}
                      className="mt-4 px-4 py-2 bg-primary-500 text-neutral-800 font-medium rounded-lg hover:bg-lime-400 transition"
                    >
                      Crear Primera Cotización
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default LoanQuotes;
