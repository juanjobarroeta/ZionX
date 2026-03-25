#!/bin/bash

# ZIONX Production Migration - Simple Wrapper
# This script makes it easy to migrate to Railway production database

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     MIGRACIÓN A PRODUCCIÓN - ZIONX (Railway → Vercel)         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Esto migrará a PRODUCCIÓN:"
echo "   • 18 clientes"
echo "   • 7 empleados"
echo ""
echo "⚠️  IMPORTANTE: Necesitas tu DATABASE_URL de Railway"
echo ""
echo "🔍 Para obtener tu DATABASE_URL:"
echo "   1. Ve a: https://railway.app/"
echo "   2. Abre tu proyecto ZIONX"
echo "   3. Click en PostgreSQL"
echo "   4. Tab 'Connect'"
echo "   5. Copia DATABASE_URL"
echo ""
echo "────────────────────────────────────────────────────────────────"
echo ""

# Check if DATABASE_URL is provided as argument
if [ ! -z "$1" ]; then
  export DATABASE_URL="$1"
  echo "✅ DATABASE_URL recibido como argumento"
else
  echo "💡 Puedes ejecutar: ./migrate-production-simple.sh 'postgresql://...'"
  echo ""
fi

# Run the migration
node migrate-to-production.js

echo ""
echo "────────────────────────────────────────────────────────────────"
echo ""
echo "✅ Migración completada!"
echo ""
echo "🌐 Verifica en tu app de Vercel:"
echo "   https://zionx-marketing.vercel.app/crm"
echo ""
echo "📧 Envía credenciales a tu equipo:"
echo "   Abre: ../EMPLOYEE_CREDENTIALS.md"
echo ""
