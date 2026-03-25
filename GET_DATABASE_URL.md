# 🔑 Cómo Obtener tu DATABASE_URL de Railway

## 📍 Tu referencia actual es: `${{ Postgres.DATABASE_URL }}`

Esto es una **variable de Railway**, no el URL real. Necesitas obtener el valor real.

---

## ✅ MÉTODO 1: Railway Dashboard (2 minutos)

### Paso a Paso con Capturas Visuales

#### 1️⃣ Abre Railway
```
https://railway.app/dashboard
```

#### 2️⃣ Encuentra tu Proyecto
- Busca un proyecto llamado "ZIONX", "zionx-marketing", "crediya" o similar
- Click en el proyecto

#### 3️⃣ Identifica el Servicio PostgreSQL
- Verás varios servicios/contenedores
- Busca el que dice **"Postgres"** o tiene ícono de base de datos 🗄️
- Click en ese servicio

#### 4️⃣ Ve a Variables o Connect
Verás tabs arriba:
- **Variables** ← Click aquí
- O **Connect** ← O aquí

#### 5️⃣ Encuentra DATABASE_URL
En la lista de variables verás:
```
DATABASE_URL    postgresql://postgres:abc123...
```

#### 6️⃣ Copia el Valor
- Click en el ícono de **"Copy"** 📋
- O click en **"Show"** 👁️ y copia el texto completo

**Debe empezar con:** `postgresql://`  
**Y verse así:** `postgresql://postgres:xyz123@host.railway.app:7543/railway`

---

## ✅ MÉTODO 2: Instalar Railway CLI (3 minutos)

Si prefieres usar la línea de comandos:

```bash
# 1. Instalar Railway CLI
npm install -g @railway/cli

# 2. Login (abrirá navegador)
railway login

# 3. Link al proyecto
cd ~/zionx-marketing/backend
railway link
# Selecciona tu proyecto ZIONX

# 4. Ver variables
railway variables | grep DATABASE_URL

# O ver todas las variables
railway variables
```

---

## ✅ MÉTODO 3: Desde los Logs (Si ya tienes backend desplegado)

Si tu backend ya está en Railway:

```bash
# En Railway Dashboard:
# 1. Click en tu servicio de backend (Node.js)
# 2. Ve a 'Deployments'
# 3. Click en el deployment más reciente
# 4. Ve a 'Variables' en la sidebar
# 5. Busca DATABASE_URL
```

---

## 🎯 UNA VEZ QUE TENGAS EL DATABASE_URL

Copia el DATABASE_URL completo y ejecuta:

```bash
cd ~/zionx-marketing/backend

# Pégalo directamente en el comando
node migrate-to-production.js "postgresql://postgres:tu_password@host.railway.app:7543/railway"

# O déjalo que te lo pida
node migrate-to-production.js
# (luego pega cuando te lo pida)
```

---

## ⚠️ FORMATO CORRECTO

Tu DATABASE_URL debe verse así:

```
postgresql://usuario:contraseña@host.railway.app:puerto/nombre_db
```

**Ejemplo real:**
```
postgresql://postgres:AbC123XyZ456@containers-us-west-45.railway.app:7543/railway
```

### ❌ NO FUNCIONA:
- `${{ Postgres.DATABASE_URL }}` ← Variable, no el valor
- `postgres://...` ← Falta "ql" (debe ser postgresql://)
- Solo el host sin protocolo

### ✅ SÍ FUNCIONA:
- `postgresql://postgres:pass@host.railway.app:7543/railway`
- Todo en una sola línea
- Incluye protocolo, usuario, password, host, puerto, database

---

## 🚀 DESPUÉS DE OBTENERLO

1. **Guárdalo temporalmente** (en un archivo seguro o .env)
2. **Ejecuta la migración:**
   ```bash
   node migrate-to-production.js "TU_DATABASE_URL_AQUI"
   ```
3. **Confirma** con `YES`
4. **Espera** 10-15 segundos
5. **Verifica** en Vercel

---

## 🎊 Resultado Esperado

Después de migrar con el DATABASE_URL correcto:

**En tu app de Vercel:**
- ✅ 18 clientes en `/crm` (no solo 1)
- ✅ 7 empleados pueden hacer login
- ✅ Todos los datos visibles

---

## 🆘 ¿Sigues Sin Encontrarlo?

### Opción A: Revisar Railway Logs
```bash
# Ve a Railway Dashboard
# Click en tu servicio de backend
# Ve a 'Logs'
# Busca líneas que mencionen DATABASE_URL o PostgreSQL connection
```

### Opción B: Crear Nueva Conexión
```bash
# En Railway Dashboard:
# PostgreSQL service > Settings > Generate Domain
# Esto creará una URL pública que puedes usar
```

### Opción C: Usar Railway Variables en Deploy
Si no puedes obtener el URL, puedo crear un script que se ejecute EN Railway usando las variables de entorno.

---

## 💡 SIGUIENTE PASO

**Opción más fácil:**

1. Abre https://railway.app/dashboard
2. Tu proyecto ZIONX
3. PostgreSQL service
4. Tab "Variables"
5. Copia el valor de DATABASE_URL
6. Pégalo aquí en el chat (puedo ayudarte)

O ejecuta:
```bash
node migrate-to-production.js
# Y pega cuando te lo pida
```

---

**¿Necesitas ayuda para encontrarlo? Compárteme una captura de tu Railway dashboard y te guío.** 👆
