#!/bin/bash

# Setup script for SudoHardware project

echo "🚀 SudoHardware - Setup"
echo "=============================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"
echo ""


echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
    echo ""
    echo "🎯 Next steps:"
    echo "   1. Run the server: npm start"
    echo "   2. Open http://localhost:3000 in your browser"
    echo "   3. Products database will be created automatically"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi
