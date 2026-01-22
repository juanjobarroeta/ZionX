#!/bin/bash

echo "🚀 Starting CrediYA Database Reset..."
echo "⚠️  WARNING: This will DELETE ALL DATA and recreate the database from scratch!"
echo ""

read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" = "yes" ]; then
    echo "🗑️  Proceeding with database reset..."
    echo ""
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check if the reset script exists
    if [ ! -f "reset-database.js" ]; then
        echo "❌ reset-database.js not found. Please make sure you're in the correct directory."
        exit 1
    fi
    
    # Run the reset script
    echo "🔧 Running database reset script..."
    node reset-database.js
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Database reset completed successfully!"
        echo "🎯 You can now test the system with a clean database."
    else
        echo ""
        echo "❌ Database reset failed. Please check the error messages above."
        exit 1
    fi
else
    echo "❌ Database reset cancelled."
    exit 0
fi
