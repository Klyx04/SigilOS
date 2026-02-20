// prisma.config.js
try {
    require('dotenv').config();
} catch (e) {
    // Ignore, env vars are likely provided by Docker/Environment
}

// Fonction de nettoyage
const clean = (val) => {
    if (!val) return '';
    return val.replace(/^['"]|['"]$/g, '').trim();
};

// Support both DATABASE_URL (CI/standalone) and individual env vars (Docker Compose)
let url;
if (process.env.DATABASE_URL && !process.env.POSTGRES_USER) {
    // CI or standalone mode: use DATABASE_URL directly
    url = process.env.DATABASE_URL;
} else {
    // Docker Compose mode: build URL from individual vars
    const user = clean(process.env.POSTGRES_USER) || 'sigiluser';
    const pwd = clean(process.env.POSTGRES_PASSWORD);
    const db_name = clean(process.env.POSTGRES_DB) || 'sigilos';
    const host = process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db-prod' : 'localhost');
    const port = process.env.DB_PORT || (process.env.NODE_ENV === 'production' ? '5432' : '5433');
    const protocol = 'post' + 'gresql://';
    url = `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${db_name}?schema=public`;
}

module.exports = {
    schema: "prisma/schema.prisma",
    datasource: {
        url,
    },
};
