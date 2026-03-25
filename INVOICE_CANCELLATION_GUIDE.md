# 📋 Cancelación de Facturas y Contabilidad

## ✅ AHORA SÍ AFECTA EL LEDGER (Journal Entries)

He actualizado el sistema para que cancelar una factura **SÍ reverse los asientos contables**.

---

## 🔄 Cómo Funciona Ahora

### Cuando CREAS una Factura

```
Crear factura por $6,936.80
  ↓
Sistema crea journal_entries:
  Debe:  1103-0001 (Cliente) .......... $6,936.80
  Haber: 4002 (Ingresos) .............. $5,980.00
  Haber: 2003 (IVA por Cobrar) ........ $956.80
  ↓
Estado de Resultados:
  INGRESOS: +$5,980 ✅
```

### Cuando CANCELAS la Factura (NUEVO ✅)

```
Click "✗ Cancelar Factura"
Ingresas razón: "Cambio de servicios"
  ↓
Sistema AUTOMÁTICAMENTE:
  1. Marca factura como 'cancelled'
  2. REVERSA los journal entries:
     
     Debe:  4002 (Ingresos) ............ $5,980.00  (reversa)
     Haber: 1103-0001 (Cliente) ........ $5,980.00  (reversa)
     
     Debe:  2003 (IVA por Cobrar) ...... $956.80   (reversa)
     Haber: 1103-0001 (Cliente) ........ $956.80   (reversa)
  ↓
Estado de Resultados:
  INGRESOS: $5,980 - $5,980 = $0 ✅
  ↓
Balance:
  Cliente por cobrar: $0 ✅
  IVA por cobrar: $0 ✅
```

**Resultado:** Como si la factura nunca hubiera existido contablemente.

---

## ⚠️ Protecciones Implementadas

### NO Puedes Cancelar Si:

❌ **La factura tiene pagos registrados**

```
Error: "Cannot cancel invoice with payments. Void payments first."
```

**Razón:** Si ya te pagaron, primero tienes que reversar el pago.

**Solución:**
1. Ve al pago registrado
2. Elimina/anula el pago (esto reversa sus journal entries)
3. Luego cancela la factura

---

## 📊 Flujos Completos

### Caso 1: Cancelar Factura Sin Pagos

```
1. Factura creada (INV-2026-0002) - $6,936.80
   ✅ Journal entries creados
   ✅ Ingresos: +$5,980

2. Cliente no ha pagado aún

3. Decides cancelar
   Click "✗ Cancelar Factura"
   Razón: "Servicio cancelado"
   ✅ Factura → status 'cancelled'
   ✅ Journal entries reversados automáticamente
   ✅ Ingresos: $5,980 - $5,980 = $0

4. Estado de Resultados ahora correcto ✅
```

### Caso 2: Cancelar Factura Con Pagos (Requiere 2 Pasos)

```
1. Factura creada (INV-2026-0001) - $14,982.56
   ✅ Journal entries creados
   ✅ Ingresos: +$12,916

2. Cliente pagó $7,000
   ✅ Pago registrado
   ✅ Banco: +$7,000
   ✅ Cliente por cobrar: -$7,000

3. Decides cancelar la factura completa
   Click "✗ Cancelar Factura"
   ❌ Error: "Cannot cancel invoice with payments"
   
4. Primero anula el pago:
   Ve al historial de pagos
   Elimina el pago de $7,000
   ✅ Se reversan los journal entries del pago
   ✅ Banco: -$7,000 (reversado)
   ✅ Cliente: +$7,000 (reversado)

5. Ahora cancela la factura:
   Click "✗ Cancelar Factura"
   ✅ Se reversan los journal entries de la factura
   ✅ Ingresos: $0
   ✅ Todo limpio
```

---

## 🎯 Tipos de Journal Entries

### invoice_generated
- Se crea al generar la factura
- Registra el ingreso (revenue recognition)
- Registra cuenta por cobrar del cliente

### invoice_payment
- Se crea al registrar un pago
- Mueve dinero a Banco/Caja
- Reduce la cuenta por cobrar

### invoice_cancelled ⭐ (NUEVO)
- Se crea al cancelar la factura
- **Reversa todos los invoice_generated entries**
- Deja la contabilidad como si nunca existió

---

## 📋 Asientos por Tipo de Transacción

### Crear Factura
```
Debe:  1103-XXXX (Cliente por cobrar)
   Haber: 4002 (Ingresos)
   Haber: 2003 (IVA por Cobrar)
```

### Registrar Pago
```
Debe:  1102 (Banco)
   Haber: 1103-XXXX (Cliente por cobrar)
```

### Cancelar Factura ⭐ (NUEVO)
```
Debe:  4002 (Ingresos) ............. [reversa]
Debe:  2003 (IVA por Cobrar) ........ [reversa]
   Haber: 1103-XXXX (Cliente) ....... [reversa]
```

**Efecto Neto:** Todos los asientos se cancelan entre sí.

---

## ✅ Ventajas del Sistema

### 1. Auditoría Completa
- ✅ Cada cancelación queda registrada
- ✅ Puedes ver la razón de cancelación
- ✅ Los asientos de reversa son visibles
- ✅ Trail de auditoría completo

### 2. Contabilidad Correcta
- ✅ Estado de Resultados siempre correcto
- ✅ No hay "ingresos fantasma"
- ✅ Por cobrar siempre actualizado
- ✅ IVA correcto

### 3. Flexibilidad
- ✅ Puedes cancelar facturas sin pagos
- ✅ Protección si hay pagos
- ✅ Sistema te guía en el proceso

---

## 🚀 Disponible Después del Deploy

**Commit:** `8c5a8d1` (o siguiente)  
**ETA:** ~3 minutos más

---

## 💡 Mejores Prácticas

### ✅ HAZ ESTO:
1. **Siempre agrega una razón** al cancelar
2. **Verifica que no hay pagos** antes de cancelar
3. **Usa "draft"** si aún estás trabajando en la factura
4. **Cancela solo si es necesario** - mejor crear nueva factura

### ❌ EVITA ESTO:
1. **NO canceles facturas ya pagadas** sin anular el pago primero
2. **NO canceles por error de monto** - mejor crea nota de crédito
3. **NO elimines journal_entries** manualmente
4. **NO modifiques facturas canceladas**

---

## 📊 Ejemplo Real

### Escenario: Cambio de Plan

**Situación:**
- Facturaste Plan A por $6,936.80
- Cliente quiere Plan B por $9,628.00
- Factura no pagada aún

**Solución:**
```
1. Cancela factura Plan A
   ✅ Reversa ingresos y por cobrar
   
2. Crea nueva factura Plan B
   ✅ Registra nuevos ingresos
   
3. Estado de Resultados ahora muestra:
   Ingresos Plan B: $9,628 (correcto) ✅
```

---

## 🎊 RESUMEN

### Antes del Fix:
❌ Cancelar factura dejaba journal entries huérfanos  
❌ Ingresos quedaban inflados  
❌ Por cobrar incorrecto  
❌ Estado de Resultados erróneo  

### Después del Fix ✅:
✅ Cancelar factura reversa journal entries  
✅ Ingresos correctos  
✅ Por cobrar correcto  
✅ Estado de Resultados preciso  
✅ Auditoría completa  

---

**Deploying now. Ready in ~3 minutes!** 🚀
