# 🚀 Guía: Migrar a Producción (Railway)

## 📋 Situación Actual

- ✅ **Local:** 18 clientes + 7 empleados importados en `zionx_dev`
- ❌ **Producción (Vercel/Railway):** Solo 1 cliente visible
- 🎯 **Objetivo:** Migrar todos los datos a producción

---

## 🔧 OPCIÓN 1: Migración Automática (Recomendada)

### Paso 1: Obtener DATABASE_URL de Railway

1. Ve a: https://railway.app/
2. Abre tu proyecto ZIONX
3. Click en el servicio **PostgreSQL**
4. Ve a **Connect** tab
5. Copia el **DATABASE_URL** (empieza con `postgresql://...`)

**Ejemplo:**
```
postgresql://postgres:password@host.railway.app:5432/railway
```

### Paso 2: Ejecutar Migración

```bash
cd ~/zionx-marketing/backend

# Opción A: Pasar DATABASE_URL como argumento
node migrate-to-production.js "postgresql://user:pass@host:port/db"

# Opción B: El script te pedirá el DATABASE_URL
node migrate-to-production.js
```

### Paso 3: Confirmar

El script te pedirá confirmación:
```
Type "YES" to proceed:
```

Escribe `YES` y presiona Enter.

### Paso 4: Verificar

Abre tu app en Vercel y verás:
- 18 clientes en el CRM
- 7 empleados (8 incluyendo el admin original)

---

## 🔧 OPCIÓN 2: Migración Manual por Partes

Si prefieres hacerlo paso a paso:

### A. Solo Clientes

```bash
cd ~/zionx-marketing/backend

# Crear script específico
cat > migrate-customers-prod.js << 'SCRIPT'
// Usa el código de migrate-zionx-customers.js
// Pero conecta a DATABASE_URL de producción
SCRIPT

# Ejecutar con DATABASE_URL
DATABASE_URL="tu_railway_url" node migrate-customers-prod.js
```

### B. Solo Empleados

```bash
DATABASE_URL="tu_railway_url" node migrate-employees.js
```

---

## 🔧 OPCIÓN 3: Usando Railway CLI

Si tienes Railway CLI instalado:

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link al proyecto
cd ~/zionx-marketing/backend
railway link

# Ejecutar migración en Railway
railway run node migrate-to-production.js
```

---

## 📊 Lo Que Se Migrará

### Clientes (18)
- TUKIAMA
- Psiquiatra Abigail
- CICLO
- Miami Ad School
- Irán Sanchez
- Krei Glacé
- Dabuten
- REDI
- Medicina Funcional
- Tolé Tolé
- Glaucoma Puebla
- Curated Design
- Bici de cleta
- La Vie en Rose
- Aasan
- Fracc El Rey
- Cantina Dolores
- Grupo Constructor

### Empleados (7)
- **Miranda Ramírez** (Admin)
- **Pedro Mijangos** (Admin)
- **Karen Sánchez** (Manager)
- **Rosa González** (Manager)
- **Valeria Chávez** (Manager)
- **María Fernanda Hernández** (User)
- **Paola López** (User)

**Todos con password:** `zionx2024`

---

## ⚠️ ANTES DE MIGRAR

### 1. Verificar Base de Datos de Producción

```bash
# Conectar a Railway DB (usando DATABASE_URL)
psql "your_railway_database_url"

# Ver qué hay actualmente
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM users;
\q
```

### 2. Hacer Backup (Opcional pero Recomendado)

```bash
# Backup de producción antes de migrar
pg_dump "your_railway_database_url" > production_backup_before_migration.sql
```

### 3. Verificar Schema

Asegúrate que las tablas `customers` y `users` existen en producción con la estructura correcta.

---

## 🚨 Problemas Comunes

### "No such table: customers"
```bash
# La base de datos de producción no tiene el schema
# Ejecuta schema.sql en producción primero:
psql "your_railway_database_url" < backend/schema.sql
```

### "Connection refused"
- Verifica que el DATABASE_URL sea correcto
- Asegúrate de incluir el SSL flag en la conexión
- Revisa los logs de Railway

### "User already exists"
- El script omitirá empleados que ya existen (por email)
- Clientes se agregarán como nuevos registros
- Si quieres evitar duplicados de clientes, limpia la tabla primero

---

## 🔍 VERIFICAR MIGRACIÓN EXITOSA

Después de migrar, verifica:

### En la Aplicación Web
1. Abre: https://tu-app.vercel.app/crm
2. Deberías ver 18 clientes
3. Login con empleado: `mirandavela101@gmail.com` / `zionx2024`

### En Railway
```bash
# Conectar a producción
psql "your_railway_database_url"

# Verificar clientes
SELECT COUNT(*) FROM customers;
-- Debe mostrar: 18 (o más si ya había clientes)

# Verificar empleados
SELECT COUNT(*) FROM users;
-- Debe mostrar: 8 (o más si ya había usuarios)

# Ver clientes importados
SELECT id, first_name, last_name, phone 
FROM customers 
ORDER BY id DESC 
LIMIT 18;

# Ver empleados importados  
SELECT id, name, email, role 
FROM users 
WHERE email LIKE '%@gmail.com' 
ORDER BY id;
```

---

## 📝 Script de Migración Completo

El archivo `migrate-to-production.js` hace:

1. ✅ Se conecta a Railway con SSL
2. ✅ Pide confirmación antes de proceder
3. ✅ Importa 18 clientes
4. ✅ Importa 7 empleados
5. ✅ Usa transacciones (rollback en caso de error)
6. ✅ Omite duplicados (empleados por email)
7. ✅ Muestra progreso en tiempo real
8. ✅ Genera reporte final

---

## 🎯 EJECUCIÓN PASO A PASO

### 1. Preparar
```bash
cd ~/zionx-marketing/backend
```

### 2. Obtener DATABASE_URL
- Railway Dashboard > PostgreSQL > Connect > DATABASE_URL
- Copiar todo el string (empieza con `postgresql://`)

### 3. Ejecutar
```bash
node migrate-to-production.js
# Pegar DATABASE_URL cuando lo pida
# Escribir YES para confirmar
```

### 4. Esperar
La migración toma ~10-30 segundos.

### 5. Verificar
Abre tu app en Vercel y verifica que los 18 clientes aparezcan.

---

## 🔐 Después de Migrar

### Distribuir Credenciales al Equipo

Envía a cada empleado:

```
¡Hola [Nombre]!

Tu cuenta en ZIONX Marketing está lista.

🔑 Acceso:
   URL: https://zionx-marketing.vercel.app
   Email: [su_email]
   Password temporal: zionx2024

⚠️ IMPORTANTE: Cambia tu contraseña al primer login.
```

**Lista de emails:**
- mirandavela101@gmail.com (Admin)
- dipedromijangos@gmail.com (Admin)
- karensanice@gmail.com (Manager)
- roosasch@gmail.com (Manager)
- valeria.chabe97@gmail.com (Manager)
- mariahsegon@gmail.com (User)
- paola.lopezlu@gmail.com (User)

---

## 🆘 Si Algo Sale Mal

### Rollback
Si la migración falla, usa el backup:
```bash
psql "your_railway_database_url" < production_backup_before_migration.sql
```

### Limpiar y Reintentar
```bash
# Conectar a Railway
psql "your_railway_database_url"

# Eliminar datos importados (si necesitas reiniciar)
DELETE FROM customers WHERE id > [id_anterior];
DELETE FROM users WHERE email LIKE '%@gmail.com';

# Salir y reintentar
\q
node migrate-to-production.js
```

---

## 📞 SOPORTE

Si tienes problemas:

1. **Verifica conexión:** `psql "your_railway_database_url"`
2. **Revisa logs de Railway:** Railway Dashboard > Deployments > Logs
3. **Ejecuta verificación:** `node verify-complete-migration.js` (con DATABASE_URL de producción)

---

## 🎊 ¡Listo!

Una vez migrado a producción:
- ✅ 18 clientes en Vercel
- ✅ 7 empleados con acceso
- ✅ Sistema completamente operativo
- ✅ Tu equipo puede trabajar desde cualquier lugar

🚀 **¡Tu agencia ZIONX en producción!**
