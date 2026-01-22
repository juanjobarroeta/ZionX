#!/bin/bash

echo "🚀 Starting Foundation Template Servers..."

# Kill any existing processes
pkill -f "vite|node index.js" 2>/dev/null

# Navigate to project root
cd "$(dirname "$0")"

echo "📁 Current directory: $(pwd)"

# Start backend
echo "🔧 Starting backend server..."
cd backend
node index.js &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# Start frontend
echo "🎨 Starting frontend server..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "🎉 Both servers are starting..."
echo "📊 Backend: http://localhost:5001"
echo "🌐 Frontend: http://localhost:5174"
echo ""
echo "🔐 Test credentials:"
echo "   Email: admin@test.com"
echo "   Password: admin123"
echo ""
echo "⏳ Wait 5-10 seconds, then visit http://localhost:5174"
echo ""
echo "💡 To stop servers: pkill -f \"vite|node index.js\""

# Wait a bit and test
sleep 5
echo "🧪 Testing servers..."

if curl -s http://localhost:5001 > /dev/null; then
    echo "✅ Backend is responding"
else
    echo "❌ Backend not responding"
fi

if curl -s http://localhost:5174 > /dev/null; then
    echo "✅ Frontend is responding"
else
    echo "❌ Frontend not responding (may still be starting)"
fi

echo ""
echo "🎯 Ready! Go to http://localhost:5174"


