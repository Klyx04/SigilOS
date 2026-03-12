const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const db = new PrismaClient();
db.bounty.count().then(c => console.log('Count:', c)).catch(e => console.error(e)).finally(() => db.$disconnect());
