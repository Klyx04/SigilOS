"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
require("dotenv/config");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var zonesData, zones, _i, zonesData_1, z, zone, monstersData, _loop_1, _a, monstersData_1, m, dungeonsData, _b, dungeonsData_1, d;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('🌱 Start seeding...');
                    zonesData = [
                        { name: 'Ile de Moon', level: 200 },
                        { name: 'Frigost 3', level: 190 },
                        { name: 'Sufokia', level: 100 },
                        { name: 'Bonta', level: 50 },
                        { name: 'Tour des Rêves', level: 200 },
                    ];
                    zones = [];
                    _i = 0, zonesData_1 = zonesData;
                    _c.label = 1;
                case 1:
                    if (!(_i < zonesData_1.length)) return [3 /*break*/, 4];
                    z = zonesData_1[_i];
                    return [4 /*yield*/, prisma.zone.upsert({
                            where: { name: z.name },
                            update: {},
                            create: z,
                        })];
                case 2:
                    zone = _c.sent();
                    zones.push(zone);
                    console.log("Created Zone: ".concat(zone.name));
                    _c.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    monstersData = [
                        { name: 'Tofu Maléfique', zoneName: 'Bonta' },
                        { name: 'Gelée Royale Bleue', zoneName: 'Frigost 3' }, // Juste pour l'exemple
                        { name: 'Kanigrou', zoneName: 'Ile de Moon' },
                        { name: 'Rêveur', zoneName: 'Tour des Rêves' },
                        { name: 'Kralamoure', zoneName: 'Sufokia' },
                    ];
                    _loop_1 = function (m) {
                        var zone;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    zone = zones.find(function (z) { return z.name === m.zoneName; });
                                    if (!zone) return [3 /*break*/, 2];
                                    return [4 /*yield*/, prisma.monster.create({
                                            data: {
                                                name: m.name,
                                                zoneId: zone.id
                                            }
                                        })];
                                case 1:
                                    _d.sent();
                                    console.log("Created Monster: ".concat(m.name, " in ").concat(zone.name));
                                    _d.label = 2;
                                case 2: return [2 /*return*/];
                            }
                        });
                    };
                    _a = 0, monstersData_1 = monstersData;
                    _c.label = 5;
                case 5:
                    if (!(_a < monstersData_1.length)) return [3 /*break*/, 8];
                    m = monstersData_1[_a];
                    return [5 /*yield**/, _loop_1(m)];
                case 6:
                    _c.sent();
                    _c.label = 7;
                case 7:
                    _a++;
                    return [3 /*break*/, 5];
                case 8:
                    dungeonsData = [
                        { name: 'Le Chouque', bossName: 'Le Chouque', level: 100, dpnlUrl: 'https://dofusdb.fr/fr/database/dungeon/103' },
                        { name: 'Ougah', bossName: 'Ougah', level: 180 },
                        { name: 'Ilyzaelle', bossName: 'Ilyzaelle', level: 200, dpnlUrl: 'https://dofusdb.fr/fr/database/dungeon/112' },
                        { name: 'Korriandre', bossName: 'Korriandre', level: 190 },
                        { name: 'Comte Harebourg', bossName: 'Comte Harebourg', level: 200 },
                    ];
                    _b = 0, dungeonsData_1 = dungeonsData;
                    _c.label = 9;
                case 9:
                    if (!(_b < dungeonsData_1.length)) return [3 /*break*/, 12];
                    d = dungeonsData_1[_b];
                    return [4 /*yield*/, prisma.dungeon.upsert({
                            where: { name: d.name },
                            update: {},
                            create: d,
                        })];
                case 10:
                    _c.sent();
                    console.log("Created Dungeon: ".concat(d.name));
                    _c.label = 11;
                case 11:
                    _b++;
                    return [3 /*break*/, 9];
                case 12:
                    console.log('✅ Seeding finished.');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
