// prisma.config.js
require('dotenv').config();

// Fonction de nettoyage
const clean = (val) => {
    if (!val) return '';
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const user = clean(process.env.POSTGRES_USER) || 'sigiluser';
const pwd = clean(process.env.POSTGRES_PASSWORD);
const db_name = clean(process.env.POSTGRES_DB) || 'sigilos';
const host = process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db-prod' : 'localhost');

module.exports = {
    schema: "prisma/schema.prisma",
    datasource: {
        // encodeURIComponent est une fonction globale dans Node.js
        url: `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5432/${db_name}?schema=public`,
    },
};
