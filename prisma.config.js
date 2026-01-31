// prisma.config.js
const { encodeURIComponent } = require('url');

// Fonction de nettoyage
const clean = (val) => {
    if (!val) return '';
    return val.replace(/^['"]|['"]$/g, '').trim();
};

const user = clean(process.env.POSTGRES_USER) || 'sigiluser';
const pwd = clean(process.env.POSTGRES_PASSWORD);
const db_name = clean(process.env.POSTGRES_DB) || 'sigilos';
const host = process.env.NODE_ENV === 'production' ? 'db-prod' : 'localhost';

module.exports = {
    schema: "prisma/schema.prisma",
    datasource: {
        url: `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:5432/${db_name}?schema=public`,
    },
};
