import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import Layout from "../components/Layout";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { API_BASE_URL } from "../utils/constants";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const ProfitSummary = () => {
  const token = localStorage.getItem("token");
  const [month, setMonth] = useState("04");
  const [year, setYear] = useState("2025");
  const [summary, setSummary] = useState({
    interestPaid: 0,
    penalties: 0,
    productMargin: 0,
    costOfGoods: 0,
    expenses: 0,
  });
  const [compareMonth, setCompareMonth] = useState("03");
  const [compareYear, setCompareYear] = useState("2025");
  const [compareSummary, setCompareSummary] = useState(null);

  const validNumber = (val) => (typeof val === "number" && !isNaN(val)) ? val : 0;

  const fetchData = async () => {
    const m = parseInt(month);
    const y = parseInt(year);
    if (!m || !y || m < 1 || m > 12) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/income-statement?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSummary(res.data);
    } catch (err) {
      console.error("Error fetching income statement:", err);
    }
  };

  const fetchCompareData = async () => {
    const m = parseInt(compareMonth);
    const y = parseInt(compareYear);
    if (!m || !y || m < 1 || m > 12) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/income-statement?month=${compareMonth}&year=${compareYear}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCompareSummary(res.data);
    } catch (err) {
      console.error("Error fetching comparison data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month, year]);

  return (
    <Layout>
    <div className="max-w-4xl mx-auto mt-10 px-6 text-neutral-800 bg-white min-h-screen">
      <h2 className="mb-4 font-bold">Resumen de Ganancias</h2>

      <div className="row mb-3">
        <div className="col-md-3">
          <label className="text-neutral-800 font-semibold block mb-1">Mes</label>
          <input type="text" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full border border-primary-500 rounded bg-white text-neutral-800 p-2" />
        </div>
        <div className="col-md-3">
          <label className="text-neutral-800 font-semibold block mb-1">Año</label>
          <input type="text" value={year} onChange={(e) => setYear(e.target.value)} className="w-full border border-primary-500 rounded bg-white text-neutral-800 p-2" />
        </div>
        <div className="col-md-3 d-flex align-items-end">
          <button className="bg-primary-500 text-neutral-800 font-bold px-4 py-2 rounded hover:bg-white hover:text-primary-500 transition" onClick={fetchData}>Actualizar</button>
        </div>
        <div className="col-md-3">
          <label className="text-neutral-800 font-semibold block mb-1">Comparar Mes</label>
          <input type="text" value={compareMonth} onChange={(e) => setCompareMonth(e.target.value)} className="w-full border border-primary-500 rounded bg-white text-neutral-800 p-2" />
        </div>
        <div className="col-md-3">
          <label className="text-neutral-800 font-semibold block mb-1">Comparar Año</label>
          <input type="text" value={compareYear} onChange={(e) => setCompareYear(e.target.value)} className="w-full border border-primary-500 rounded bg-white text-neutral-800 p-2" />
        </div>
        <div className="col-md-3 d-flex align-items-end">
          <button className="border border-primary-500 text-primary-500 px-4 py-2 rounded hover:bg-white hover:text-neutral-800 transition" onClick={fetchCompareData}>Comparar</button>
        </div>
      </div>

      <div className="bg-[#111] border border-primary-500 p-4 rounded mb-4">
        <h5 className="font-bold">Ingresos</h5>
        <ul>
          <li>Intereses: ${validNumber(summary.interestPaid).toFixed(2)}</li>
          <li>Penalizaciones: ${validNumber(summary.penalties).toFixed(2)}</li>
          <li>Margen de producto: ${validNumber(summary.productMargin).toFixed(2)}</li>
        </ul>
      </div>

      <div className="bg-[#111] border border-primary-500 p-4 rounded mb-4">
        <h5 className="font-bold">Costos</h5>
        <ul>
          <li>Costo de producto vendido: ${validNumber(summary.costOfGoods).toFixed(2)}</li>
          <li>Gastos operativos: ${validNumber(summary.expenses).toFixed(2)}</li>
        </ul>
      </div>

      <div className="bg-[#111] border border-primary-500 p-4 rounded mb-4">
        <h4 className="mt-4 font-bold">Ganancia Neta: ${(validNumber(summary.interestPaid) + validNumber(summary.penalties) + validNumber(summary.productMargin) - validNumber(summary.costOfGoods) - validNumber(summary.expenses)).toFixed(2)}</h4>
      </div>

      <div className="mt-5">
        <Bar
          data={{
            labels: ["Intereses", "Penalizaciones", "Margen", "Costo", "Gastos"],
            datasets: [
              {
                label: "Actual",
                data: [
                  validNumber(summary.interestPaid),
                  validNumber(summary.penalties),
                  validNumber(summary.productMargin),
                  validNumber(summary.costOfGoods),
                  validNumber(summary.expenses),
                ],
                backgroundColor: [
                  "#198754",
                  "#dc3545",
                  "#0d6efd",
                  "#ffc107",
                  "#6c757d",
                ],
              },
              compareSummary && {
                label: "Comparado",
                data: [
                  validNumber(compareSummary.interestPaid),
                  validNumber(compareSummary.penalties),
                  validNumber(compareSummary.productMargin),
                  validNumber(compareSummary.costOfGoods),
                  validNumber(compareSummary.expenses),
                ],
                backgroundColor: "rgba(100,100,255,0.5)",
              }
            ].filter(Boolean)
          }}
          options={{
            responsive: true,
            plugins: {
              legend: { display: true },
              tooltip: { enabled: true },
            },
            scales: {
              y: { beginAtZero: true },
            },
          }}
        />
      </div>
    </div>
    </Layout>
  );
};

export default ProfitSummary;
