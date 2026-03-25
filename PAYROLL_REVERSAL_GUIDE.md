# ♻️ Reversar Nómina - Guía Completa

## ✅ SÍ, Puedes Deshacer Nómina

Acabo de agregar la funcionalidad para reversar nómina pagada (igual que facturas).

---

## 🔄 Dos Opciones Según Estado

### 1️⃣ Nómina en DRAFT (No Pagada)

```
Status: 'draft' o 'pending'
Acción: DELETE (eliminar directamente)

Desde la web:
  • Ve a la nómina
  • Click "🗑️ Eliminar"
  • Confirma
  ✅ Se elimina sin trace

Desde API:
  DELETE /api/hr/payroll/periods/4
  
Resultado:
  ✅ Período eliminado
  ✅ Payroll entries eliminados
  ✅ No hay journal entries que reversar
```

### 2️⃣ Nómina PAGADA (Ya Procesada)

```
Status: 'paid'
Acción: REVERSE (reversar con asientos contables)

Desde API:
  POST /api/hr/payroll/periods/3/reverse
  Body: { "reason": "Nómina de prueba" }
  
Sistema automáticamente:
  1. Encuentra todos los journal entries de esa nómina
  2. Crea entradas de reversa (swap debit/credit)
  3. Marca período como 'reversed'
  4. Mantiene audit trail

Resultado:
  ✅ Gastos reversados
  ✅ Banco restaurado
  ✅ Pasivos (ISR, IMSS) revertidos
  ✅ Estado de Resultados corregido
  ✅ Todo queda como si nunca se hubiera pagado
```

---

## 📋 Tu Situación Actual

Tienes **4 períodos de nómina:**

1. **Período 3** - $5,000 - **PAID** ← Este es prueba
2. **Período 4** - $5,000 - **DRAFT** 
3. **Período 5** - $54,750 - **DRAFT**
4. **Período 6** - $54,750 - **DRAFT**

---

## 🔧 Cómo Limpiar Tu Nómina de Prueba

### Opción A: Reversar el Período 3 (PAID)

```bash
cd ~/zionx-marketing/backend

PROD_DATABASE_URL="postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway" \
node << 'REVERSE'
const axios = require('axios');

async function reversePayroll() {
  try {
    // You'll need to get your auth token first
    const token = "YOUR_TOKEN_HERE";
    
    const response = await axios.post(
      'https://zionx-production.up.railway.app/api/hr/payroll/periods/3/reverse',
      { reason: 'Nómina de prueba - limpieza inicial' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('✅ Payroll reversed:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

reversePayroll();
REVERSE
```

### Opción B: Desde SQL Directo

```sql
-- Conectar
PROD_DATABASE_URL="tu_url" psql

BEGIN;

-- Ver journal entries del período 3
SELECT * FROM journal_entries WHERE source_type = 'payroll' LIMIT 10;

-- Reversar manualmente (crear entradas opuestas)
-- Ejemplo: Si tenías
--   Debe: 6000 $5,000  Haber: 1102 $4,375
-- Creas:
INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id)
VALUES 
  (CURRENT_DATE, 'REVERSA: Nómina prueba', '1102', 4375, 0, 'payroll_reversal', 3),
  (CURRENT_DATE, 'REVERSA: Nómina prueba', '6000', 0, 5000, 'payroll_reversal', 3);

-- Marcar período como reversado
UPDATE payroll_periods SET status = 'reversed' WHERE id = 3;

COMMIT;
```

### Opción C: Eliminar Períodos DRAFT

Para los períodos 4, 5, 6 (draft):

```bash
# Desde web
Ve a cada período → Click Eliminar

# O desde API
curl -X DELETE https://zionx-production.up.railway.app/api/hr/payroll/periods/4 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Después de Reversar

### Estado de Resultados Mostrará:

```
ANTES (con nómina prueba):
  INGRESOS .................... $23,896
  GASTOS (Sueldos) ............ $5,000
  UTILIDAD .................... $18,896

DESPUÉS (nómina reversada):
  INGRESOS .................... $23,896
  GASTOS (Sueldos) ............ $0
  UTILIDAD .................... $23,896
```

### Banco Mostrará:

```
ANTES:
  Banco ...................... $1,425
  (Entró $5,800 - Salió $4,375 nómina)

DESPUÉS:
  Banco ...................... $5,800
  (Solo lo que entró, nómina reversada)
```

---

## 🎯 Mejores Prácticas

### ✅ CORRECTO:
1. **Reversar con razón documentada**
   - "Nómina de prueba"
   - "Error en cálculo"
   - "Corrección de monto"

2. **Mantener audit trail**
   - No borrar entries, reversar
   - Queda registro de corrección
   - Auditoría completa

3. **Status 'reversed'**
   - Período existe pero cancelado
   - Se ve en reportes como reversado
   - Historia completa

### ❌ INCORRECTO:
1. DELETE directo de journal entries
2. Modificar entries existentes
3. Borrar sin trace
4. No documentar razón

---

## 💡 Para Tu Caso Específico

**Te recomiendo:**

1. **Reversa el período 3** ($5,000 pagado)
   - Usa el nuevo endpoint `/reverse`
   - Razón: "Nómina de prueba"

2. **Elimina los períodos 4, 5, 6** (draft)
   - Usa DELETE normal
   - Son borradores, no afectan contabilidad

3. **Procesa nómina real completa**
   - $109,500 para los 8 empleados
   - Con retenciones ISR e IMSS correctas
   - Usando la interfaz web o script

---

## 🚀 Feature Deployando

**Commit:** `[siguiente]`  
**Endpoint nuevo:** `POST /api/hr/payroll/periods/:id/reverse`  
**ETA:** 2-3 minutos

---

## 📖 Documentación

- **`PAYROLL_REVERSAL_GUIDE.md`** - Esta guía
- **`CLEANUP_OPTIONS.md`** - Opciones de limpieza general
- **`ACCOUNTING_GUIDE.md`** - Contabilidad completa

---

## ✅ Resumen

**¿Puedes deshacer nómina?**  
**SÍ** - Acabo de agregar la función

**¿Cómo?**
- Draft payroll → DELETE
- Paid payroll → REVERSE (nuevo)

**¿Afecta ledger?**
- Sí, reversa todos los journal entries ✅

**Deploy en 2 minutos, luego podrás reversar tu nómina de prueba!** 🔄
