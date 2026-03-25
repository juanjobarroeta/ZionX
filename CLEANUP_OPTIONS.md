# 🧹 Limpiar Datos de Prueba - Opciones

## 🎯 Tu Situación

Tienes datos de prueba mezclados con datos reales:
- ✅ **19 clientes reales** migrados
- ✅ **8 empleados reales** migrados
- ✅ **56 cuentas contables** configuradas
- ⚠️ **3 facturas** (algunas de prueba?)
- ⚠️ **1 nómina** ($5,000 - parcial/prueba)

---

## ✅ OPCIÓN 1: Reversar Entradas Individuales (RECOMENDADO)

**Para:** Cuando tienes datos reales que quieres conservar

### Ventajas:
- ✅ Conservas clientes y empleados
- ✅ Conservas configuración contable
- ✅ Solo eliminas las transacciones de prueba
- ✅ Más rápido que re-migrar todo
- ✅ Práctica contable profesional

### Desventajas:
- ⏱️ Requiere identificar cada entrada de prueba
- 🔧 Proceso manual para cada transacción

### Cómo Hacerlo:

#### A. Cancelar Facturas de Prueba

```bash
# Desde la interfaz web:
1. Ve a cada factura de prueba
2. Click "✗ Cancelar Factura"
3. Ingresa razón: "Factura de prueba"
4. ✅ Sistema reversa journal entries automáticamente
```

**Resultado:**
- Factura → status 'cancelled'
- Journal entries reversados
- Ingresos ajustados
- Por cobrar limpiado

#### B. Eliminar Nómina de Prueba

```sql
-- Conectar a producción
PROD_DATABASE_URL="tu_url" psql

-- Ver períodos de nómina
SELECT id, period_name, status, total_gross FROM payroll_periods;

-- Si el período 3 es de prueba ($5,000):
BEGIN;

-- Eliminar entries de nómina
DELETE FROM payroll_entries WHERE payroll_period_id = 3;

-- Eliminar período
DELETE FROM payroll_periods WHERE id = 3;

-- Eliminar journal entries relacionados
DELETE FROM journal_entries WHERE source_type = 'payroll' AND source_id = 0;

COMMIT;
```

**Resultado:**
- Nómina de prueba eliminada
- Journal entries eliminados
- Gastos ajustados
- Banco/Caja corregido

---

## 🔄 OPCIÓN 2: Wipe Completo y Empezar Fresh (NO RECOMENDADO)

**Para:** Si TODA tu data es de prueba y no has importado nada real

### Ventajas:
- 🧹 Base de datos completamente limpia
- 🆕 Empiezas con IDs desde 1
- 📊 Sin ruido de pruebas

### Desventajas:
- ❌ Pierdes los 19 clientes migrados
- ❌ Pierdes los 8 empleados configurados
- ❌ Pierdes las 56 cuentas contables
- ❌ Tienes que re-migrar TODO
- ⏱️ 2+ horas de trabajo perdido

### Cómo Hacerlo:

```bash
# SOLO SI ESTÁS 100% SEGURO
cd ~/zionx-marketing/backend

PROD_DATABASE_URL="tu_url" psql << 'SQL'
BEGIN;

-- Eliminar todas las transacciones
TRUNCATE invoice_payments CASCADE;
TRUNCATE invoices CASCADE;
TRUNCATE payroll_entries CASCADE;
TRUNCATE payroll_periods CASCADE;
TRUNCATE journal_entries CASCADE;

-- Eliminar clientes y empleados (opcional)
-- TRUNCATE customers CASCADE;
-- TRUNCATE users CASCADE;
-- TRUNCATE team_members CASCADE;

-- Reiniciar secuencias
ALTER SEQUENCE invoices_id_seq RESTART WITH 1;
ALTER SEQUENCE payroll_periods_id_seq RESTART WITH 1;
ALTER SEQUENCE journal_entries_id_seq RESTART WITH 1;

COMMIT;
SQL

# Luego re-migrar:
node migrate-to-production.js
node migrate-team-members.js
```

---

## 💡 MI RECOMENDACIÓN: Opción 1

**Porque:**
1. Ya tienes 19 clientes y 8 empleados reales migrados ✅
2. Solo tienes 3-4 transacciones de prueba ⚠️
3. Es más rápido reversar pocas transacciones que re-migrar todo
4. Es práctica profesional (audit trail)

---

## 🎯 Plan de Limpieza Recomendado

### PASO 1: Identificar Qué Es Prueba

```bash
# Revisar facturas
PROD_DATABASE_URL="tu_url" psql -c "
SELECT id, invoice_number, customer_id, total, status, 
       created_at::date
FROM invoices 
ORDER BY id;
"

# Revisar nómina
PROD_DATABASE_URL="tu_url" psql -c "
SELECT id, period_name, total_gross, status, created_at::date
FROM payroll_periods 
ORDER BY id;
"
```

### PASO 2: Marcar Qué Eliminar

**Facturas:**
- INV-2026-0001? ¿Es real o prueba?
- INV-2026-0002? ¿Es real o prueba?
- INV-2026-0003? ¿Es real o prueba?

**Nómina:**
- $5,000 período? Definitivamente prueba (muy bajo)

### PASO 3: Eliminar Solo Las Pruebas

**Para facturas de prueba:**
```
1. Ve a la factura en Vercel
2. Click "✗ Cancelar Factura"
3. Razón: "Factura de prueba - limpieza inicial"
4. ✅ Sistema reversa todo automáticamente
```

**Para nómina de prueba:**
```sql
-- Desde psql
DELETE FROM payroll_entries WHERE payroll_period_id = 3;
DELETE FROM payroll_periods WHERE id = 3;
DELETE FROM journal_entries 
WHERE source_type = 'payroll' AND created_at::date = '2026-03-24';
```

### PASO 4: Verificar

```bash
node generate-financial-statements.js
```

Deberías ver:
- Ingresos: $0 (si cancelaste todas las facturas)
- Gastos: $0 (si eliminaste la nómina de prueba)
- Banco: $0
- Todo limpio ✅

---

## 🏢 Práctica Contable Profesional

### ✅ CORRECTO:
- Cancelar facturas con razón documentada
- Reversar journal entries correctamente
- Mantener audit trail
- Conservar data maestra (clientes, empleados, catálogo)

### ❌ INCORRECTO:
- DELETE directo de journal_entries sin reversa
- Wipe completo cuando hay data real
- Modificar journal entries existentes
- Perder audit trail

---

## 🎯 Mi Recomendación Específica Para Ti

**Haz esto:**

1. **Cancela las facturas de prueba** desde la interfaz
   - Usa el botón "Cancelar Factura"
   - Deja que el sistema reverse automáticamente

2. **Elimina manualmente la nómina de prueba** ($5,000)
   - Es muy baja para ser real
   - DELETE de payroll_periods y entries

3. **Conserva todo lo demás**
   - 19 clientes
   - 8 empleados
   - 56 cuentas contables
   - Configuración

4. **Empieza limpio con datos reales**
   - Crea facturas reales para tus clientes
   - Procesa nómina completa ($109,500)
   - Registra gastos operativos reales

---

## ⚠️ Si Aún Así Quieres Wipe Completo

Solo hazlo SI:
- ❌ TODAS las facturas son de prueba
- ❌ La nómina es falsa
- ❌ No te importa re-migrar clientes/empleados
- ❌ Quieres empezar absolutamente desde cero

**Entonces:**
1. Ejecuta el script de reset
2. Re-migra clientes y empleados
3. Pierdes ~2 horas de trabajo

---

## 📝 Script para Limpieza Selectiva

Créalo con lo que realmente quieres eliminar:

```javascript
// cleanup-test-data.js
const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanup() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🧹 LIMPIANDO DATOS DE PRUEBA...\n');
    
    // Delete test payroll (period 3 with $5,000)
    await client.query('DELETE FROM payroll_entries WHERE payroll_period_id = 3');
    await client.query('DELETE FROM payroll_periods WHERE id = 3');
    console.log('✅ Nómina de prueba eliminada');
    
    // Delete payroll journal entries
    await client.query("DELETE FROM journal_entries WHERE source_type = 'payroll'");
    console.log('✅ Journal entries de nómina eliminados');
    
    // Optional: Cancel test invoices (or use web interface)
    // await client.query("UPDATE invoices SET status = 'cancelled' WHERE id IN (1, 2)");
    
    await client.query('COMMIT');
    
    console.log('\n✅ Limpieza completada');
    console.log('📊 Datos reales conservados:');
    console.log('   • 19 clientes');
    console.log('   • 11 usuarios');
    console.log('   • 8 empleados en team_members');
    console.log('   • 56 cuentas contables');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();
```

---

## 🎯 RESPUESTA FINAL

**¿Individual o Wipe?**

**→ INDIVIDUAL** porque:
1. Tienes 19 clientes reales migrados
2. Tienes 8 empleados reales configurados
3. Solo 3-4 transacciones son de prueba
4. Re-migrar tomaría 2+ horas

**Pasos:**
1. Cancela facturas de prueba (desde web)
2. Elimina nómina de prueba (SQL)
3. Verifica con `generate-financial-statements.js`
4. Empieza con datos reales

**NO hagas wipe completo** - perderías todo el trabajo de hoy.

---

**¿Necesitas ayuda para identificar cuáles son de prueba?** Dime qué facturas y nómina son reales vs prueba y te ayudo a limpiar selectivamente. 🧹