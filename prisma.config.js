//prisma.config.js
module.exports = {
    schema: "prisma/schema.prisma",
    datasource: {
        // On construit l'URL proprement en encodant le mot de passe
        // Cela permet d'utiliser des caractères comme #, & ou $ sans erreur
        url: `postgresql://${process.env.POSTGRES_USER}:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@db-prod:5432/${process.env.POSTGRES_DB}?schema=public`,
    },
};
