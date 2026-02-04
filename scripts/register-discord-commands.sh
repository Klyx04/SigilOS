#!/bin/bash

# Script to register the /status slash command with Discord
# Run this once per bot to enable the command

# Load environment variables from .env.prod
if [ -f .env.prod ]; then
    export $(cat .env.prod | grep -v '^#' | xargs)
fi

# Check required variables
if [ -z "$DISCORD_BOT_TOKEN" ] || [ -z "$DISCORD_CLIENT_ID" ]; then
    echo "❌ Error: DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID must be set"
    echo "   Add them to your .env.prod file"
    exit 1
fi

echo "🚀 Registering /status command with Discord..."

# Register global command (available in all servers where bot is installed)
curl -X POST \
    -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "status",
        "description": "Affiche le statut des services SigilOS",
        "type": 1
    }' \
    "https://discord.com/api/v10/applications/$DISCORD_CLIENT_ID/commands"

echo ""
echo "✅ Command registered! It may take up to 1 hour to appear in Discord."
echo "   For instant testing, use a guild-specific command instead."
