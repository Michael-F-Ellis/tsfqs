#!/bin/bash

# Port to serve on
PORT=8081

echo "Cleaning up port $PORT..."
# Find PID occupying the port and kill it
pid=$(lsof -t -i:$PORT)
if [ -n "$pid" ]; then
  echo "Killing process $pid on port $PORT"
  kill $pid
fi

echo "Compiling..."
# Ensure fresh build
tsgo

if [ $? -eq 0 ]; then
  echo "Compilation successful."
  echo "Starting server on http://127.0.0.1:$PORT (Caching Disabled)"
  npx http-server -p $PORT -c-1
else
  echo "Compilation failed!"
  exit 1
fi
