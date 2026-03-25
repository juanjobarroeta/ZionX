# 📊 Estado de Resultados - Cómo Funciona

## ✅ Tu Sistema ESTÁ Correctamente Conectado

El Estado de Resultados lee de `journal_entries` (asientos contables) y ya está funcionando.

---

## 📈 Estado Actual (Marzo 2026)

### LO QUE YA TIENES:

```
INGRESOS:
  Ingresos por Servicios ................. $23,896.00
  ─────────────────────────────────────────────────
  TOTAL INGRESOS ......................... $23,896.00

GASTOS:
  (Ninguno registrado todavía) ........... $0.00
  ─────────────────────────────────────────────────
  TOTAL GASTOS ........................... $0.00

══════════════════════════════════════════════════
UTILIDAD NETA ............................ $23,896.00
Margen Neto .............................. 100%
══════════════════════════════════════════════════
```

### ¿POR QUÉ GASTOS EN $0?

**Porque NO has registrado:**
- ❌ Nómina de marzo ($109,500)
- ❌ Gastos de Meta Ads
- ❌ Gastos de Google Ads
- ❌ Otros gastos operativos

---

## 🔄 Flujo de Datos Completo

### 1️⃣ Cuando Facturas → Crea Asientos Contables

```
Crear factura por $6,936.80
  ↓
Sistema automático crea en journal_entries:
  Debe:  1103-0001 (Cliente) .......... $6,936.80
  Haber: 4002 (Ingresos) .............. $5,980.00
  Haber: 2003 (IVA) ................... $956.80
  ↓
Estado de Resultados lee:
  INGRESOS: +$5,980 ✅
```

### 2️⃣ Cuando Registras Pago → Mueve Efectivo (NO afecta P&L)

```
Cliente paga $6,936.80
  ↓
Sistema crea en journal_entries:
  Debe:  1102 (Banco) ................. $6,936.80
  Haber: 1103-0001 (Cliente) .......... $6,936.80
  ↓
Estado de Resultados:
  No cambia (el ingreso ya estaba registrado)
Flujo de Efectivo:
  +$6,936.80 ✅
Balance:
  Banco aumenta, Por cobrar disminuye ✅
```

### 3️⃣ Cuando Pagas Nómina → Registra Gasto

```
Pagas nómina $109,500
  ↓
Ejecutas: record-payroll-payment.js
  ↓
Sistema crea en journal_entries:
  Debe:  6000 (Sueldos) ............... $109,500.00
  Haber: 1102 (Banco) ................. $97,537.50
  Haber: 2106 (ISR por Pagar) ......... $10,950.00
  Haber: 2107 (IMSS por Pagar) ........ $2,737.50
  ↓
Estado de Resultados lee:
  GASTOS: +$109,500 ✅
  UTILIDAD: $23,896 - $109,500 = -$85,604
```

### 4️⃣ Cuando Pagas Gastos Operativos → Registra Gasto

```
Pagas Meta Ads $15,000
  ↓
Registras manualmente o desde interfaz:
  Debe:  6001 (Meta Ads) .............. $15,000.00
  Haber: 1102 (Banco) ................. $15,000.00
  ↓
Estado de Resultados lee:
  GASTOS: +$15,000 ✅
```

---

## 🎯 Cómo Poblarlo Ahora

### PASO 1: Registra Tu Nómina de Marzo

```bash
cd ~/zionx-marketing/backend

PROD_DATABASE_URL="postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway" \
node record-payroll-payment.js

# Cuando pregunte:
# Período: Marzo 2026
# Fecha: 2026-03-31
# Método: banco
# Confirma: YES
```

**Resultado:** Estado de Resultados mostrará gastos de $109,500

### PASO 2: Registra Gastos Operativos

Si pagaste Meta Ads, Google Ads, software, etc.:

**Opción A: SQL Directo**
```bash
PROD_DATABASE_URL="postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway" \
psql -c "
INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type)
VALUES 
  ('2026-03-24', 'Meta Ads - Campañas Marzo', '6001', 15000, 0, 'expense'),
  ('2026-03-24', 'Pago Meta Ads', '1102', 0, 15000, 'expense');
"
```

**Opción B: Desde la interfaz web**
- Ve a sección de Gastos/Expenses
- Agrega cada gasto
- Selecciona cuenta correcta (6001, 6002, etc.)

### PASO 3: Ver Estado de Resultados Actualizado

```bash
PROD_DATABASE_URL="postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway" \
node generate-financial-statements.js
```

Verás:
```
INGRESOS:                          $23,896.00
GASTOS:
  Sueldos .......................... $109,500.00
  Meta Ads ......................... $15,000.00
  ─────────────────────────────────────────────
  TOTAL GASTOS ..................... $124,500.00

UTILIDAD NETA ........................ -$100,604.00
Margen Neto .......................... -421%
```

---

## 📊 Cuentas que Alimentan el Estado de Resultados

### INGRESOS (Cuentas 4xxx)
| Cuenta | Nombre | Cuándo se Registra |
|--------|--------|-------------------|
| 4002 | Ingresos por Servicios | Al crear factura ✅ |
| 4010 | Social Media Management | Al facturar ese servicio |
| 4011 | Contenido | Al facturar contenido |
| 4012 | Paid Ads | Al facturar publicidad |
| 4020 | Suscripciones | Al facturar suscripción |

**Fuente:** Creación de facturas (automático)

### GASTOS (Cuentas 6xxx)
| Cuenta | Nombre | Cuándo se Registra |
|--------|--------|-------------------|
| 6000 | Sueldos | Al pagar nómina (script) ❌ |
| 6001 | Meta Ads | Al pagar Facebook/Instagram Ads ❌ |
| 6002 | Google Ads | Al pagar Google Ads ❌ |
| 6003 | TikTok Ads | Al pagar TikTok Ads ❌ |
| 6004 | Herramientas Marketing | Software, tools ❌ |
| 6200 | Renta | Pago de oficina ❌ |
| 6240 | Software | Subscripciones software ❌ |

**Fuente:** Tu registro manual (pendiente)

---

## 🎯 ACCIÓN REQUERIDA: Registra Tus Gastos

### Gastos de Marzo que Probablemente Tienes:

1. **Nómina:** $109,500 (8 empleados)
   - Script: `record-payroll-payment.js`

2. **Meta Ads:** ¿Cuánto gastaste?
   - Cuenta: 6001
   - Método: SQL o interfaz web

3. **Google Ads:** ¿Cuánto gastaste?
   - Cuenta: 6002

4. **Software/Tools:** ¿Cuánto pagaste?
   - Canva, Adobe, scheduling tools, etc.
   - Cuenta: 6004

5. **Renta de Oficina:** ¿Cuánto?
   - Cuenta: 6200

6. **Internet/Servicios:** ¿Cuánto?
   - Cuenta: 6230, 6240

---

## 💡 Script Rápido para Registrar Todos los Gastos

Créalo con tus gastos reales:

```bash
cd ~/zionx-marketing/backend

PROD_DATABASE_URL="tu_url" psql << 'SQL'
-- Nómina ya la registras con el script
-- Estos son los gastos operativos:

BEGIN;

-- Meta Ads
INSERT INTO journal_entries (date, description, account_code, debit, credit)
VALUES 
  ('2026-03-24', 'Meta Ads - Campañas Marzo', '6001', 15000, 0),
  ('2026-03-24', 'Pago Meta Ads', '1102', 0, 15000);

-- Google Ads
INSERT INTO journal_entries (date, description, account_code, debit, credit)
VALUES 
  ('2026-03-24', 'Google Ads - Marzo', '6002', 8000, 0),
  ('2026-03-24', 'Pago Google Ads', '1102', 0, 8000);

-- Software/Tools
INSERT INTO journal_entries (date, description, account_code, debit, credit)
VALUES 
  ('2026-03-24', 'Software Marketing - Marzo', '6004', 3000, 0),
  ('2026-03-24', 'Pago Software', '1102', 0, 3000);

-- Renta
INSERT INTO journal_entries (date, description, account_code, debit, credit)
VALUES 
  ('2026-03-24', 'Renta Oficina - Marzo', '6200', 10000, 0),
  ('2026-03-24', 'Pago Renta', '1102', 0, 10000);

COMMIT;
SQL
```

Ajusta los montos con tus gastos reales.

---

## 📊 Después de Registrar Todos los Gastos

Ejecuta:
```bash
node generate-financial-statements.js
```

Verás el Estado de Resultados completo:

```
═══════════════════════════════════════════════
ESTADO DE RESULTADOS - Marzo 2026
═══════════════════════════════════════════════

INGRESOS:
  Ingresos por Servicios ............ $23,896.00
  ───────────────────────────────────────────────
  TOTAL INGRESOS .................... $23,896.00

GASTOS OPERATIVOS:
  Sueldos ........................... $109,500.00
  Meta Ads .......................... $15,000.00
  Google Ads ........................ $8,000.00
  Software .......................... $3,000.00
  Renta ............................. $10,000.00
  ───────────────────────────────────────────────
  TOTAL GASTOS ...................... $145,500.00

═══════════════════════════════════════════════
UTILIDAD NETA ....................... -$121,604.00
Margen Neto ......................... -509%
═══════════════════════════════════════════════
```

---

## 🎯 Resumen

### ✅ LO QUE YA FUNCIONA:

1. **Ingresos** → Se registran automáticamente al crear facturas
2. **Pagos** → Se registran y actualizan Banco/Caja
3. **Estado de Resultados** → Lee correctamente de journal_entries
4. **Sistema contable** → Doble partida funcionando

### ❌ LO QUE FALTA:

1. **Registrar nómina** → Usa `record-payroll-payment.js`
2. **Registrar gastos operativos** → SQL manual o interfaz web
3. **Gastos recurrentes** → Meta Ads, Google Ads, software, renta

---

## 🚀 SIGUIENTE PASO (Ahora)

### 1. Espera que termine el deploy (5 minutos)

### 2. Registra tu nómina de marzo:
```bash
cd ~/zionx-marketing/backend
PROD_DATABASE_URL="postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway" \
node record-payroll-payment.js
```

### 3. Registra tus gastos operativos

Haz una lista de gastos reales de marzo y regístralos

### 4. Genera el Estado de Resultados:
```bash
PROD_DATABASE_URL="postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway" \
node generate-financial-statements.js
```

---

## 📱 En la Interfaz Web

También puedes ver el Estado de Resultados en:

1. **https://zionx-marketing.vercel.app**
2. **Equipo & Nómina → Estados Financieros**
3. O busca **"Income Statement"** o **"Profit & Loss"**

El endpoint es: `/api/hr/financial/profit-loss`

---

## ✅ Confirmación

Tu Estado de Resultados:
- ✅ **ESTÁ conectado** a journal_entries
- ✅ **YA MUESTRA** ingresos ($23,896)
- ✅ **LEERÁ automáticamente** los gastos cuando los registres
- ✅ **CALCULARÁ** utilidad neta correctamente
- ✅ **INCLUIRÁ** nómina, Meta Ads, Google Ads, todo

**Solo necesitas registrar tus gastos reales!** 💰

---

**Siguiente:** Registra tu nómina y gastos, luego verás el Estado de Resultados completo.
