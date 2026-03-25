# ⚡ REFERENCIA RÁPIDA - Contabilidad ZIONX

## 🎯 Comandos Esenciales

### 📊 Ver Estados Financieros
```bash
cd ~/zionx-marketing/backend
PROD_DATABASE_URL="postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway" \
node generate-financial-statements.js
```

### 💰 Registrar Cobro de Cliente
```bash
PROD_DATABASE_URL="postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway" \
node record-invoice-payment.js
```

### 💼 Registrar Pago de Nómina
```bash
PROD_DATABASE_URL="postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway" \
node record-payroll-payment.js
```

---

## 📋 Cuentas Principales

| Código | Nombre | Uso |
|--------|--------|-----|
| 1101 | Caja | Pagos en efectivo |
| 1102 | Banco | Transferencias bancarias |
| 1103 | Clientes | Por cobrar (general) |
| 1103-XXXX | Cliente específico | Por cobrar de cada cliente |
| 4002 | Ingresos por Servicios | Ingresos principales |
| 6000 | Sueldos | Nómina |
| 2106 | ISR por Pagar | Retenciones ISR |
| 2107 | IMSS por Pagar | Retenciones IMSS |

---

## 🔄 Flujo de Transacciones

### Cliente te Paga
```
Cliente paga → Usar record-invoice-payment.js
  ↓
Debe: 1102 (Banco) aumenta
Haber: 1103-XXXX (Cliente) disminuye
  ↓
✅ Efectivo aumenta, por cobrar disminuye
```

### Pagas Nómina
```
Pago de nómina → Usar record-payroll-payment.js
  ↓
Debe: 6000 (Sueldos) gasto aumenta
Haber: 1102 (Banco) disminuye (neto)
Haber: 2106 (ISR) aumenta pasivo
Haber: 2107 (IMSS) aumenta pasivo
  ↓
✅ Gastos registrados, efectivo disminuye
```

---

## 🎯 Checklist Mensual

### Al Inicio del Mes
- [ ] Facturar servicios del mes anterior
- [ ] Revisar facturas pendientes

### Durante el Mes
- [ ] Registrar cada cobro recibido
- [ ] Pagar nómina (día 15 y 30)
- [ ] Registrar gastos operativos
- [ ] Monitorear cashflow

### Fin de Mes
- [ ] Generar estados financieros
- [ ] Revisar utilidad del mes
- [ ] Pagar ISR e IMSS retenidos
- [ ] Planificar siguiente mes

---

## 📊 Reportes Clave

### Estado de Resultados
- Ingresos del mes
- Gastos del mes
- Utilidad neta
- Márgenes

### Flujo de Efectivo
- Efectivo inicial
- Entradas (cobros)
- Salidas (pagos)
- Efectivo final

### Balance General
- Activos (efectivo + por cobrar)
- Pasivos (por pagar)
- Capital

---

## 🆘 Solución Rápida de Problemas

### "Mis estados no cuadran"
→ Verifica que registraste TODOS los pagos con los scripts

### "El banco está en $0"
→ Usa `record-invoice-payment.js` para registrar cobros

### "Los gastos no aparecen"
→ Usa `record-payroll-payment.js` y registra gastos operativos

### "¿Cuánto efectivo tengo?"
→ Ejecuta `generate-financial-statements.js` - verás "Efectivo disponible"

---

✅ **Guarda este archivo como referencia rápida**
