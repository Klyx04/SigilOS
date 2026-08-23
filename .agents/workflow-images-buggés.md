sudo docker compose -f docker-compose.prod.yml --env-file .env.beta up -d --no-build --force-recreate app-beta
