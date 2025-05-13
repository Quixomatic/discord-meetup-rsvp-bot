#!/bin/bash
# Troubleshooting script for GitHub Actions Docker build

# Display system information
echo "=== System Information ==="
uname -a
echo ""

# Display Docker information
echo "=== Docker Information ==="
docker --version
echo ""

# List all files in the current directory
echo "=== Repository Contents ==="
ls -la
echo ""

# Check if Dockerfile exists
echo "=== Dockerfile Check ==="
if [ -f "Dockerfile" ]; then
  echo "Dockerfile exists in the current directory"
  echo "Dockerfile contents:"
  cat Dockerfile
else
  echo "ERROR: Dockerfile not found in the current directory"
  
  # Search for Dockerfile in subdirectories
  echo ""
  echo "Searching for Dockerfile in subdirectories:"
  find . -name "Dockerfile" -type f
fi
echo ""

# Check build context
echo "=== Build Context ==="
echo "Current directory: $(pwd)"
echo ""

# Try a test build
echo "=== Test Build ==="
docker build --no-cache -t test-image . || echo "Docker build failed"
echo ""

echo "=== Troubleshooting Complete ==="