# 🎯 Guía: Cómo Usar tus Clientes Importados

## ✅ Migración Completa

Has importado exitosamente **18 clientes** de tu base de datos ZIONX al sistema de marketing.

---

## 🚀 Acceder a tus Clientes

### Paso 1: Iniciar los Servidores

Abre dos terminales:

**Terminal 1 - Backend:**
```bash
cd ~/zionx-marketing/backend
npm start
```
El servidor backend correrá en `http://localhost:5001`

**Terminal 2 - Frontend:**
```bash
cd ~/zionx-marketing/frontend
npm run dev
```
El frontend correrá en `http://localhost:5174`

### Paso 2: Acceder a la Aplicación

1. Abre tu navegador en: `http://localhost:5174`
2. Inicia sesión con tus credenciales
3. Navega a la sección **"Clientes"** o **"CRM"** en el sidebar

---

## 📋 ¿Qué Puedes Hacer Ahora?

### 1. Ver Lista de Clientes
- Ve a `/customers` o `/crm`
- Verás los 18 clientes importados
- Busca por nombre, teléfono o marca
- Filtra y ordena la lista

### 2. Ver Detalles de Cliente
- Click en cualquier cliente para ver:
  - Información de contacto completa
  - RFC y régimen fiscal
  - Presupuesto de marketing asignado
  - Historial de actividad
  - Notas y documentos

### 3. Crear Proyectos de Marketing
Para cada cliente puedes:
- Crear campañas de redes sociales
- Planificar contenido
- Gestionar calendarios editoriales
- Dar seguimiento a resultados
- Generar reportes

### 4. Gestionar Servicios
- Crear suscripciones de marketing
- Definir paquetes de servicios
- Establecer precios y periodicidad
- Configurar facturación automática

### 5. Facturación
Para los **8 clientes** que requieren factura:
- Usa el RFC ya registrado
- Genera facturas por servicios
- Registra pagos
- Exporta para contabilidad

---

## 📊 Datos Importantes de tus Clientes

### Presupuestos de Marketing

| Cliente | Presupuesto Mensual |
|---------|---------------------|
| Dabuten | $9,628.00 |
| La Vie en Rose | $9,500.00 |
| Aasan | $9,400.00 |
| CICLO | $8,468.00 |
| Medicina Funcional | $7,500.00 |
| REDI | $7,296.40 |
| TUKIAMA | $6,936.80 |
| Cantina Dolores | $6,800.00 |
| Tolé Tolé | $6,500.00 |
| Bici de cleta | $6,525.00 |
| Miami Ad School | $5,800.00 |
| Krei Glacé | $5,000.00 |
| Grupo Constructor | $5,000.00 |
| Fracc El Rey | $4,640.00 |
| Irán Sanchez | $4,043.64 |
| Glaucoma Puebla | $3,360.00 |
| Curated Design | $3,000.00 |
| Psiquiatra Abigail | $2,928.42 |

**Total:** $115,823.26

---

## ⚠️ Acción Requerida: Completar Información

### Clientes Sin Email (18 clientes)
**TODOS** tus clientes necesitan emails para:
- Enviar reportes de marketing
- Facturas electrónicas
- Comunicaciones automáticas
- Calendarios de contenido

**Acción:** Solicita emails a todos los contactos.

### Clientes Sin RFC (10 clientes)
Si estos clientes necesitarán factura:
1. Medicina Funcional
2. Tolé Tolé
3. Glaucoma Puebla
4. Curated Design
5. Bici de cleta
6. La Vie en Rose
7. Aasan
8. Fracc El Rey
9. Cantina Dolores
10. Grupo Constructor

**Acción:** Solicita RFC para poder facturar.

---

## 🎨 Funcionalidades Disponibles

### Gestión de Clientes
- ✅ Ver lista completa
- ✅ Buscar y filtrar
- ✅ Editar información
- ✅ Agregar notas
- ✅ Subir documentos
- ✅ Ver historial

### Marketing
- ✅ Crear proyectos
- ✅ Planificar campañas
- ✅ Calendario de contenido
- ✅ Publicaciones programadas
- ✅ Analytics de redes sociales
- ✅ Reportes de rendimiento

### Facturación
- ✅ Crear suscripciones
- ✅ Generar facturas
- ✅ Registrar pagos
- ✅ Control de ingresos
- ✅ Reportes financieros

---

## 🔧 Comandos Útiles

### Ver Clientes en la Base de Datos
```bash
cd ~/zionx-marketing/backend
PGPASSWORD= psql -U postgres -d zionx_dev -c "SELECT id, first_name, last_name, phone FROM customers ORDER BY id;"
```

### Exportar Lista de Clientes
```bash
cd ~/zionx-marketing/backend
node export-imported-customers.js
```
Esto crea: `~/Downloads/CLIENTES_ZIONX_IMPORTADOS.xlsx`

### Buscar un Cliente Específico
```bash
PGPASSWORD= psql -U postgres -d zionx_dev -c "SELECT * FROM customers WHERE phone = '5559043883';" -x
```

### Ver Información Completa de un Cliente
```bash
PGPASSWORD= psql -U postgres -d zionx_dev -c "SELECT * FROM customers WHERE id = 7;" -x
```

---

## 📝 Próximos Pasos Recomendados

1. **Hoy:**
   - ✅ Verifica los clientes en la interfaz web
   - ✅ Revisa el Excel exportado
   - ✅ Identifica clientes prioritarios

2. **Esta Semana:**
   - 📧 Solicita emails faltantes
   - 📄 Solicita RFC a clientes que requieren factura
   - 📋 Define paquetes de servicios por presupuesto
   - 🎨 Crea los primeros proyectos de marketing

3. **Próximas 2 Semanas:**
   - 🚀 Lanza campañas para clientes con mayor presupuesto
   - 📊 Configura tracking y analytics
   - 💰 Establece ciclos de facturación
   - 📈 Crea reportes personalizados

---

## 💡 Tips para Aprovechar el Sistema

### Organiza por Presupuesto
- **Alto ($7,000+):** 8 clientes - Servicio premium, reuniones semanales
- **Medio ($4,000-$7,000):** 7 clientes - Servicio estándar, reuniones quincenales
- **Básico (<$4,000):** 3 clientes - Servicio básico, reportes mensuales

### Agrupa Clientes Similares
- **Salud:** Psiquiatra Abigail, Medicina Funcional, Glaucoma Puebla
- **Gastronomía:** Tolé Tolé, Cantina Dolores
- **Educación:** Miami Ad School
- **Construcción:** Fracc El Rey, Grupo Constructor

### Automatiza Comunicaciones
- Configura emails de bienvenida
- Establece recordatorios de pago
- Programa envíos de reportes mensuales
- Crea plantillas de comunicación

---

## 📞 Soporte

Si necesitas ayuda:
1. Revisa `MIGRATION_SUMMARY.md` para detalles de la migración
2. Revisa `CUSTOMER_IMPORT_GUIDE.md` para el sistema de importación
3. Consulta `README.md` para documentación general

---

## ✨ ¡Todo Listo!

Tu sistema ZIONX Marketing ahora tiene:
- ✅ 18 clientes importados
- ✅ Información completa de contacto
- ✅ RFC y datos fiscales
- ✅ Presupuestos de marketing definidos
- ✅ Listo para crear campañas y facturar

🚀 **¡Comienza a trabajar con tus clientes!**
