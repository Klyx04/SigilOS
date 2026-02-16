#!/bin/sh
# =============================================================================
# SigilOS Docker Entrypoint
# Syncs static files from build into Docker volume before starting the server
# =============================================================================

# Copy static uploads from build-time backup into the volume (if they don't exist)
# The -n flag prevents overwriting user-uploaded files
if [ -d "/app/public-static-uploads" ]; then
    echo "📂 Syncing static uploads into volume..."
    cp -rn /app/public-static-uploads/* /app/public/uploads/ 2>/dev/null || true
fi

# Start the Next.js server
exec node server.js
