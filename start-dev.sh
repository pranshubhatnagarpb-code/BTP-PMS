#!/bin/bash

# Start API server
echo "Starting API server..."
node server.js &
API_PID=$!

# Wait for API server to start
sleep 3

# Start Vite dev server
echo "Starting Vite development server..."
npm run dev &
VITE_PID=$!

# Function to kill both servers on exit
cleanup() {
    echo "Stopping servers..."
    kill $API_PID 2>/dev/null
    kill $VITE_PID 2>/dev/null
    exit
}

# Set up trap to catch Ctrl+C
trap cleanup INT

echo "Both servers are running!"
echo "API server: http://localhost:3000"
echo "Vite dev server: http://localhost:8082"
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait
