# 📤 Guía de Importación Masiva de Clientes

## ✅ Sistema de Importación Listo

Tu sistema ahora incluye importación masiva de clientes desde Excel con validación automática.

---

## 📋 Paso a Paso

### 1. **Descargar Plantilla Excel**

**Opción A: Desde la aplicación**
1. Ve a `http://localhost:5174/customers/import`
2. Click en **"📥 Descargar Plantilla Excel"**

**Opción B: Archivo ya generado**
- Ubicación: `/backend/Plantilla_Importacion_Clientes.xlsx`
- Ábrelo con Excel, Google Sheets, o Numbers

**Opción C: Desde API**
```bash
curl -O http://localhost:5001/api/customers/template
```

### 2. **Llenar el Excel**

El archivo tiene 2 hojas:

**Hoja 1: "Instrucciones"**
- Guía completa de uso
- Lista de campos disponibles
- Ejemplos de formato

**Hoja 2: "Clientes"**
- 3 filas de ejemplo
- Columnas pre-configuradas
- Formato correcto

#### Campos Requeridos (mínimo):
```
first_name    ✓ Obligatorio
last_name     ✓ Obligatorio  
email         ✓ O phone (al menos uno)
phone         ✓ O email (al menos uno)
```

#### Campos Opcionales:
```
address           - Dirección completa
curp              - CURP (18 caracteres)
rfc               - RFC (12-13 caracteres)
date_of_birth     - Fecha formato YYYY-MM-DD
occupation        - Ocupación/profesión
monthly_income    - Ingreso mensual (número)
notes             - Notas adicionales
```

### 3. **Formato de Datos**

**Fechas:**
```
CORRECTO: 1985-03-15
INCORRECTO: 15/03/1985 o 03-15-1985
```

**Teléfonos:**
```
CORRECTO: 5512345678
INCORRECTO: 55 1234 5678 o (55) 1234-5678
```

**Email:**
```
CORRECTO: cliente@empresa.com
INCORRECTO: cliente@com o cliente.empresa
```

**Ingresos:**
```
CORRECTO: 25000.00 o 25000
INCORRECTO: $25,000 o 25K
```

### 4. **Ejemplo de Datos**

| first_name | last_name | email | phone | address | notes |
|------------|-----------|-------|-------|---------|-------|
| Juan | Pérez García | juan@empresa.com | 5512345678 | Av. Insurgentes 123, CDMX | Cliente Premium |
| María | González | maria@negocio.com | 5587654321 | Calle Reforma 456 | Interesada en Plan Básico |
| Carlos | Martínez | carlos@startup.com | 5598765432 | Polanco, CDMX | Startup tech |

### 5. **Importar a la Aplicación**

**Desde la interfaz web:**
1. Ve a: `http://localhost:5174/customers/import`
2. O navega: **Sidebar → Clientes → Importar Clientes**
3. Click en el área de "arrastrar y soltar"
4. Selecciona tu archivo Excel
5. Click **"📤 Importar Clientes"**

**Desde API (alternativa):**
```bash
curl -X POST http://localhost:5001/api/customers/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/your/clientes.xlsx"
```

### 6. **Resultado de Importación**

La aplicación mostrará:
- ✅ **Importados:** Cuántos clientes se agregaron exitosamente
- ⏭️ **Omitidos:** Cuántos tuvieron errores
- 📊 **Total:** Total de filas procesadas
- ⚠️ **Errores:** Lista de errores (si hubo)

---

## 🎯 Características

### Validación Automática
- ✅ Valida campos requeridos
- ✅ Valida formato de email
- ✅ Valida formato de fecha
- ✅ Detecta duplicados
- ✅ Limpia datos (trim spaces)

### Integración Contable
- ✅ Crea cuentas contables para cada cliente automáticamente
- ✅ Formato: `1103-0001`, `4000-0001`, etc.
- ✅ Listo para facturación

### Manejo de Errores
- ✅ Si una fila falla, continúa con las demás
- ✅ Muestra errores específicos por fila
- ✅ No corrompe datos existentes

---

## 💡 Consejos

### Preparar tus Datos

1. **Limpia tu lista actual:**
   - Elimina filas vacías
   - Verifica emails válidos
   - Estandariza teléfonos (10 dígitos)

2. **Organiza la información:**
   - Un cliente por fila
   - No dejes celdas con espacios vacíos (déjalas completamente vacías)
   - Usa texto plano (sin formato especial)

3. **Prueba con pocos clientes primero:**
   - Importa 5-10 clientes de prueba
   - Verifica que todo se vea correcto
   - Luego importa el resto

### Datos Opcionales

Si no tienes ciertos datos, **déjalos vacíos**:
- CURP/RFC - No son necesarios para facturación
- Fecha de nacimiento - Opcional
- Ingreso mensual - Opcional
- Ocupación - Opcional

Los campos **esenciales** son:
- Nombre completo (first_name + last_name)
- Forma de contacto (email O teléfono)

---

## 🔄 Flujo Completo

```
1. Descargar plantilla
   ↓
2. Llenar con datos reales
   ↓
3. Guardar Excel
   ↓
4. Ir a /customers/import
   ↓
5. Subir archivo
   ↓
6. Revisar resultado
   ↓
7. Ver clientes en /crm
   ↓
8. Crear suscripciones
   ↓
9. Generar facturas
```

---

## 📊 Ejemplo Real

**Tu archivo Excel podría verse así:**

| first_name | last_name | email | phone | notes |
|------------|-----------|-------|-------|-------|
| Restaurante | El Buen Sabor | contacto@buensabor.com | 5512345001 | Necesita manejo de Instagram y Facebook |
| Boutique | Moda Elegante | ventas@modaelegante.com | 5512345002 | Plan Premium - 3 ubicaciones |
| Gimnasio | FitLife | info@fitlife.mx | 5512345003 | Campaña de fin de año |
| Café | Aroma & Sabor | hola@aromaysabor.com | 5512345004 | Contenido orgánico |
| Consultorio | Dr. Salud | citas@drsalud.com | 5512345005 | Gestión de redes médicas |

Importa esto y automáticamente:
- ✅ Se crean 5 clientes
- ✅ Se generan sus cuentas contables
- ✅ Listos para crear suscripciones
- ✅ Listos para facturar

---

## ⚠️ Errores Comunes

### "Email inválido"
```
❌ INCORRECTO: cliente@com, cliente.empresa
✅ CORRECTO: cliente@empresa.com
```

### "Teléfono inválido"
```
❌ INCORRECTO: 55 1234 5678, (55)1234-5678
✅ CORRECTO: 5512345678
```

### "Fecha inválida"
```
❌ INCORRECTO: 15/03/1985, 03-15-1985
✅ CORRECTO: 1985-03-15
```

### "Falta nombre o apellido"
```
Asegúrate que ambos campos estén llenos:
- first_name: Juan
- last_name: Pérez García
```

---

## 🎉 ¡Listo para Usar!

**Ubicación del archivo:**
`/Users/juanjosebarroeta/marketing-software/backend/Plantilla_Importacion_Clientes.xlsx`

**Acceso en la app:**
1. Refresh tu navegador: `http://localhost:5174`
2. Sidebar → **Clientes** → **Importar Clientes**
3. Descarga plantilla
4. Llena con tus datos
5. ¡Importa!

**Después de importar:**
- Los clientes aparecerán en `/crm`
- Podrás crear suscripciones para ellos
- Podrás generar facturas
- Todo con IVA automático (16%)

🚀 **¡Importa tus clientes reales y empieza a facturar!**




