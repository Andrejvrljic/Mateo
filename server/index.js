// Startet das Spiel lokal: npm start  ->  http://localhost:3000
import { startServer } from './app.js';
startServer({ port: Number(process.env.PORT) || 3000, ...(process.env.DB_PATH ? { dbPath: process.env.DB_PATH } : {}) });
