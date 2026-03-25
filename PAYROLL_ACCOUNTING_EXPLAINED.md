# 💼 Contabilidad de Nómina - Cómo Funciona

## 📊 Lo Que Viste en Tu Ledger

```
Sueldos .................... D: $5,000  |  C: $0      |  Balance: $5,000
Banco ...................... D: $5,800  |  C: $4,375  |  Balance: $1,425
```

---

## ✅ Estructura de Nómina en Contabilidad

### Práctica Estándar (Lo Correcto)

En contabilidad **NO se crea una cuenta por cada empleado**. Se usa:

**UNA cuenta de "Sueldos" (6000) para TODOS los empleados**

### ¿Por qué?

1. **Simplifica** el catálogo de cuentas
2. **Facilita** reportes y análisis
3. **Estándar** contable mexicano (NIF)
4. **Más eficiente** para auditorías

### Detalle por Empleado

El detalle de **quién recibió cuánto** va en:
- ✅ Tabla `payroll_entries` (cada empleado)
- ✅ Tabla `team_members` (datos de empleado)
- ✅ Reportes de nómina específicos

**NO en el catálogo de cuentas.**

---

## 📋 Asientos Contables de Nómina

### Estructura Completa (4 Entradas)

Cuando pagas nómina de $109,500:

```
1. Debe:  6000 (Sueldos) ............... $109,500.00  [GASTO]
   
2. Haber: 1102 (Banco) ................. $97,537.50   [PAGO NETO]
   
3. Haber: 2106 (ISR por Pagar) ......... $10,950.00   [RETENCIÓN]
   
4. Haber: 2107 (IMSS por Pagar) ........ $2,737.50    [RETENCIÓN]
```

**Balance:** $109,500 débitos = $111,225 créditos (oops, should balance)

### Cálculo Correcto:

```
Sueldo Bruto .................. $109,500.00
  - ISR Retenido (10%) ........ -$10,950.00
  - IMSS Retenido (2.5%) ...... -$2,737.50
  ────────────────────────────────────────
= Pago Neto ................... $95,812.50

Journal Entries:
──────────────────────────────────────────
Debe:  6000 (Sueldos) ........... $109,500.00
   Haber: 1102 (Banco) ........... $95,812.50
   Haber: 2106 (ISR por Pagar) ... $10,950.00
   Haber: 2107 (IMSS por Pagar) .. $2,737.50
   ────────────────────────────────────────
   Balance: $109,500 = $109,500 ✅
```

---

## 🔍 Lo Que Veo en Tu Ledger

### Tu procesamiento actual:

```
Sueldos (6000) ......... $5,000 débito
Banco (1102) ........... $4,375 crédito
```

**Análisis:**
- ✅ La cuenta Sueldos SÍ está afectada ($5,000)
- ✅ El Banco SÍ está afectado (-$4,375)
- ❌ Falta ISR por Pagar (2106)
- ❌ Falta IMSS por Pagar (2107)
- ⚠️ Solo procesaste $5,000 (no los $109,500 completos)

---

## 💡 ¿Querías Ver Detalle por Empleado?

### Opción A: Reporte de Nómina (Recomendado)

**En la interfaz web:**
1. Ve a **Equipo & Nómina → Nómina**
2. Click en el período procesado
3. Verás tabla con:
   - Nombre de cada empleado
   - Sueldo bruto individual
   - Retenciones individuales
   - Pago neto individual

**Ejemplo:**
| Empleado | Sueldo Bruto | ISR | IMSS | Neto |
|----------|--------------|-----|------|------|
| Miranda Ramírez | $25,000 | $2,500 | $625 | $21,875 |
| Pedro Mijangos | $21,000 | $2,100 | $525 | $18,375 |
| ... | ... | ... | ... | ... |

### Opción B: Subcuentas por Empleado (No Recomendado)

Si **realmente** quieres cuentas individuales:

```
6000-0001  Sueldo Miranda Ramírez
6000-0002  Sueldo Pedro Mijangos
6000-0003  Sueldo Karen Sánchez
...
```

**PERO esto:**
- ❌ Complica el catálogo de cuentas (56 + 8 = 64 cuentas)
- ❌ No es práctica estándar
- ❌ Hace más difícil reportes agregados
- ❌ No añade valor (el detalle ya está en payroll_entries)

---

## 📊 Cómo Ver Detalle de Nómina

### Método 1: Desde la App Web

```
/people → Gestión de Equipo
/payroll → Ver nóminas procesadas
Click en período → Ver detalle por empleado
```

### Método 2: Query SQL

```sql
SELECT 
  tm.name as empleado,
  pe.base_salary,
  pe.gross_pay,
  pe.isr_tax,
  pe.imss_employee,
  pe.total_deductions,
  pe.net_pay
FROM payroll_entries pe
JOIN team_members tm ON pe.team_member_id = tm.id
JOIN payroll_periods pp ON pe.payroll_period_id = pp.id
WHERE pp.id = 3
ORDER BY pe.net_pay DESC;
```

### Método 3: Exportar a Excel

Desde la interfaz, exporta el detalle de nómina a Excel.

---

## 🔧 Si Quieres Corregir el Pago Actual

Tu payroll de $5,000 está incompleto. Para el full payroll:

### Opción A: Procesar Nómina Completa desde App

1. Ve a **Nómina** en tu app
2. Crea nuevo período "Marzo 2026 - Completa"
3. Click "Generar Nómina" (auto-calcula para 8 empleados)
4. Revisa que muestre $109,500 total
5. Click "Procesar Pago"
6. ✅ Se crean los 4 asientos contables correctos

### Opción B: Usar el Script CLI

```bash
cd ~/zionx-marketing/backend
PROD_DATABASE_URL="tu_url" node record-payroll-payment.js

# Ingresa:
# Período: Nómina Completa Marzo 2026
# Fecha: 2026-03-31  
# Método: banco
# Confirma: YES
```

Esto creará los 4 asientos correctos con retenciones.

---

## 📖 Estructura Contable Correcta

### Para Nómina Completa ($109,500)

```
═══════════════════════════════════════════════════════════════
ASIENTOS CONTABLES DE NÓMINA
═══════════════════════════════════════════════════════════════

1. Debe:  6000 Sueldos ................... $109,500.00
   (Registra el gasto total de sueldos)

2. Haber: 1102 Banco ..................... $95,812.50
   (Sale del banco el pago neto a empleados)

3. Haber: 2106 ISR por Pagar ............. $10,950.00
   (Quedas a deber el ISR al SAT)

4. Haber: 2107 IMSS por Pagar ............ $2,737.50
   (Quedas a deber el IMSS al IMSS)

═══════════════════════════════════════════════════════════════
Balance: $109,500 = $95,812.50 + $10,950 + $2,737.50 ✅
═══════════════════════════════════════════════════════════════
```

### Desglose Individual (En Tabla Separada)

| Empleado | Sueldo | ISR | IMSS | Neto |
|----------|--------|-----|------|------|
| Miranda | $25,000 | $2,500 | $625 | $21,875 |
| Pedro | $21,000 | $2,100 | $525 | $18,375 |
| Karen | $17,000 | $1,700 | $425 | $14,875 |
| Rosa | $10,000 | $1,000 | $250 | $8,750 |
| Valeria | $10,000 | $1,000 | $250 | $8,750 |
| M. Fernanda | $10,000 | $1,000 | $250 | $8,750 |
| Paola | $6,500 | $650 | $162.50 | $5,687.50 |
| **TOTAL** | **$109,500** | **$10,950** | **$2,737.50** | **$95,812.50** |

**Este detalle va en `payroll_entries`, NO en chart of accounts.**

---

## 🎯 Resumen

### ✅ Lo Correcto:
- **UNA cuenta "Sueldos" (6000)** para todos los empleados
- **Detalle individual** en tabla `payroll_entries`
- **Retenciones** en cuentas 2106 y 2107

### ❌ Lo Incorrecto:
- ❌ Una cuenta contable por cada empleado (innecesario)
- ❌ No registrar retenciones (falta ISR, IMSS)

### 🔧 Tu Situación Actual:
- ⚠️ Solo procesaste $5,000 (parcial)
- ⚠️ Faltan retenciones ISR/IMSS
- ⚠️ Necesitas procesar el resto ($104,500)

---

## 🚀 Recomendación

**Procesa la nómina completa** desde la interfaz web:

1. Ve a `/payroll` en tu app
2. Crea período de nómina para los 8 empleados
3. Click "Generar" (calcula automático)
4. Revisa los montos
5. Click "Procesar Pago"
6. ✅ Se crean los 4 asientos correctos

**O** si prefieres CLI, usa el script `record-payroll-payment.js` que calcula todo automáticamente.

---

**Tu contabilidad está bien estructurada. Solo necesitas procesar la nómina completa!** 💼
