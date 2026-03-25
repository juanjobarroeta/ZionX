# 📚 Guía de Contabilidad - ZIONX Marketing

## 🎯 Tu Catálogo de Cuentas

Ahora tienes **56 cuentas contables** configuradas para tu agencia de marketing.

### 💰 Cuentas Principales

#### ACTIVOS (Lo que tienes)
- **1101** - Caja (efectivo)
- **1102** - Banco (cuenta bancaria)
- **1103** - Clientes (por cobrar)
- **1103-XXXX** - Cuenta por cobrar de cada cliente

#### INGRESOS (Lo que ganas)
- **4002** - Ingresos por Servicios
- **4010** - Ingresos por Social Media Management
- **4011** - Ingresos por Contenido
- **4012** - Ingresos por Paid Ads
- **4013** - Ingresos por Diseño
- **4014** - Ingresos por Video/Producción
- **4015** - Ingresos por Consultoría
- **4020** - Ingresos por Suscripciones

#### GASTOS (Lo que gastas)
- **6000** - Sueldos (nómina)
- **6001** - Gastos de Meta Ads
- **6002** - Gastos de Google Ads
- **6003** - Gastos de TikTok Ads
- **6004** - Herramientas de Marketing
- **6005** - Stock Photos / Assets
- **6006** - Freelancers / Contratistas
- **6100** - Marketing propio
- **6200** - Renta
- **6240** - Software

#### PASIVOS (Lo que debes)
- **2105** - Sueldos por Pagar
- **2106** - ISR Retenido por Pagar
- **2107** - IMSS Retenido por Pagar
- **2003** - IVA por Cobrar (del cliente)
- **2004** - IVA por Pagar (al SAT)

---

## 🔄 Flujo de Transacciones

### 1️⃣ Cuando Facturas a un Cliente

**Automático** (el sistema lo hace al crear factura):

```
Debe:  1103-0001 (Cliente Kenia) ........ $6,936.80
   Haber: 4002 (Ingresos por Servicios) ... $5,980.00
   Haber: 2003 (IVA por Cobrar) ........... $956.80
```

### 2️⃣ Cuando el Cliente Te Paga

**Usa el script:**
```bash
cd ~/zionx-marketing/backend
PROD_DATABASE_URL="tu_url" node record-invoice-payment.js
```

Crea los asientos:
```
Debe:  1102 (Banco) ..................... $6,936.80
   Haber: 1103-0001 (Cliente) ............ $6,936.80
```

**Resultado:** El dinero entra a tu banco y se reduce lo que te debe el cliente.

### 3️⃣ Cuando Pagas Nómina

**Usa el script:**
```bash
cd ~/zionx-marketing/backend
PROD_DATABASE_URL="tu_url" node record-payroll-payment.js
```

Crea los asientos:
```
Debe:  6000 (Sueldos) ................... $109,500.00
   Haber: 1102 (Banco) .................. $97,537.50  (neto)
   Haber: 2106 (ISR por Pagar) .......... $10,950.00  (retención)
   Haber: 2107 (IMSS por Pagar) ......... $2,737.50   (retención)
```

**Resultado:** Sale dinero del banco, se registra el gasto, y quedan pendientes los pagos al SAT e IMSS.

### 4️⃣ Cuando Pagas Gastos Operativos

**Ejemplo: Pagar Meta Ads**

Puedes hacerlo desde la interfaz o manualmente:
```sql
INSERT INTO journal_entries (date, description, account_code, debit, credit)
VALUES 
  (CURRENT_DATE, 'Pago Meta Ads - Marzo', '6001', 15000, 0),
  (CURRENT_DATE, 'Pago Meta Ads - Marzo', '1102', 0, 15000);
```

---

## 📊 Generar Reportes Financieros

### Estado de Resultados (P&L)

```bash
cd ~/zionx-marketing/backend

# Mes actual
PROD_DATABASE_URL="tu_url" node generate-financial-statements.js

# Mes específico
PROD_DATABASE_URL="tu_url" node generate-financial-statements.js "" 2026-02
```

**Muestra:**
- Ingresos del mes
- Costos y gastos
- Utilidad neta
- Márgenes
- Flujo de efectivo

### Desde la Interfaz Web

También puedes ver en tu app de Vercel:
- Ve a `/accounting` o `/financial-reports`
- Selecciona el período
- Ver Estado de Resultados
- Ver Flujo de Efectivo
- Exportar a PDF/Excel

---

## 💡 Ejemplos Prácticos

### Ejemplo 1: Cliente CICLO Paga su Factura

```bash
node record-invoice-payment.js

# Ingresa:
# Número de factura: INV-2026-0003
# Monto: 8468.00
# Método: transferencia
# Referencia: SPEI-123456
```

**Resultado en contabilidad:**
- ✅ Banco aumenta $8,468
- ✅ Cuenta por cobrar de CICLO disminuye
- ✅ Flujo de efectivo positivo
- ✅ Factura marcada como "paid"

### Ejemplo 2: Pagar Nómina Quincenal

```bash
node record-payroll-payment.js

# Ingresa:
# Período: Quincena 1 - Marzo 2026
# Fecha: 2026-03-15
# Método: banco
```

**Resultado:**
- ✅ Gasto de sueldos registrado ($109,500)
- ✅ Banco disminuye (pago neto)
- ✅ Pasivos aumentan (ISR e IMSS por pagar)
- ✅ Flujo de efectivo negativo (salida)

### Ejemplo 3: Pagar Google Ads

Manualmente en psql o desde interfaz:
```sql
INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type)
VALUES 
  ('2026-03-24', 'Google Ads - Campaña Dabuten', '6002', 5000, 0, 'expense'),
  ('2026-03-24', 'Pago Google Ads', '1102', 0, 5000, 'expense');
```

---

## 📈 Monitoreo de Cashflow

### Ver Efectivo Actual

```sql
SELECT 
  SUM(CASE WHEN account_code = '1101' THEN debit - credit ELSE 0 END) as caja,
  SUM(CASE WHEN account_code = '1102' THEN debit - credit ELSE 0 END) as banco,
  SUM(CASE WHEN account_code IN ('1101', '1102') THEN debit - credit ELSE 0 END) as total
FROM journal_entries;
```

### Proyección de Cashflow

```sql
-- Por cobrar (clientes deben)
SELECT SUM(debit - credit) as por_cobrar
FROM journal_entries
WHERE account_code LIKE '1103-%';

-- Por pagar (tú debes)
SELECT SUM(credit - debit) as por_pagar
FROM journal_entries
WHERE account_code IN ('2105', '2106', '2107', '2101');
```

---

## 🎯 Flujo Mensual Recomendado

### Día 1-15 (Primera Quincena)
1. ✅ Facturar servicios del mes anterior
2. ✅ Registrar pagos de clientes conforme llegan
3. ✅ Pagar primera quincena (día 15)
4. ✅ Registrar gastos operativos

### Día 16-31 (Segunda Quincena)
1. ✅ Seguir registrando cobros
2. ✅ Pagar segunda quincena (día 30/31)
3. ✅ Cerrar el mes
4. ✅ Generar estados financieros
5. ✅ Pagar ISR e IMSS

### Fin de Mes
1. ✅ Ejecutar: `node generate-financial-statements.js`
2. ✅ Revisar utilidad del mes
3. ✅ Analizar márgenes
4. ✅ Proyectar siguiente mes

---

## 🔧 Scripts Creados

### En `/backend/`

1. **`add-marketing-accounts.js`** ✅ (Ya ejecutado)
   - Agregó 14 cuentas específicas de marketing
   - Ejecutar una sola vez

2. **`generate-financial-statements.js`**
   - Estado de Resultados completo
   - Flujo de Efectivo
   - Balance General
   - Ejecutar mensualmente

3. **`record-invoice-payment.js`**
   - Registrar cuando cliente paga
   - Actualiza Bank/Cash
   - Reduce cuenta por cobrar
   - Ejecutar cada vez que recibas pago

4. **`record-payroll-payment.js`**
   - Registrar pago de nómina
   - Con retenciones ISR/IMSS
   - Actualiza Bank/Cash
   - Ejecutar cada quincena

---

## 📊 Reportes Disponibles

### 1. Estado de Resultados (P&L)
Muestra:
- Ingresos por servicio
- Costos y gastos
- Utilidad neta
- Márgenes

**Ver:** `node generate-financial-statements.js`

### 2. Flujo de Efectivo
Muestra:
- Efectivo inicial
- Entradas (cobros)
- Salidas (pagos)
- Efectivo final

**Ver:** Incluido en financial-statements

### 3. Balance General
Muestra:
- Activos totales
- Pasivos totales
- Capital contable

**Ver:** Incluido en financial-statements

---

## ⚠️ IMPORTANTE: Buenas Prácticas

### ✅ HAZ ESTO:
1. **Registra TODOS los pagos** - usa los scripts
2. **Revisa estados financieros** - mensualmente
3. **Concilia banco** - compara con estado de cuenta
4. **Guarda facturas** - físicas y en sistema
5. **Paga impuestos a tiempo** - ISR, IMSS, IVA

### ❌ EVITA ESTO:
1. **NO registres transacciones manuales** sin los scripts (se pueden descuadrar)
2. **NO modifiques journal_entries** directamente
3. **NO olvides registrar retenciones** de impuestos
4. **NO mezcles** efectivo personal con el del negocio

---

## 🚀 SIGUIENTE PASO

1. **Genera tu primer reporte:**
   ```bash
   cd ~/zionx-marketing/backend
   PROD_DATABASE_URL="tu_url" node generate-financial-statements.js
   ```

2. **Registra tus cobros pendientes:**
   ```bash
   PROD_DATABASE_URL="tu_url" node record-invoice-payment.js
   ```

3. **Registra tu siguiente nómina:**
   ```bash
   PROD_DATABASE_URL="tu_url" node record-payroll-payment.js
   ```

---

## 📞 Soporte Contable

Si necesitas ayuda con:
- Interpretación de estados financieros
- Cálculo de impuestos
- Cierre contable mensual
- Declaraciones al SAT

Consulta con tu contador y compártele los reportes generados.

---

✅ **Tu sistema contable está listo para operar profesionalmente!**
