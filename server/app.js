import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import appRoutes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';
import { seedDatabase } from './config/seed.js';
import { connect, close } from './config/database.js';

const root = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(root, '..', 'dist');

const app = express();

app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', appRoutes);

// Servir el frontend compilado (producción)
if (existsSync(join(DIST, 'index.html'))) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(join(DIST, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 4000);

connect()
  .then(() => seedDatabase())
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`✦ Finance Person API escuchando en http://localhost:${PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal} recibido: cerrando servidor y MongoDB...`);
      server.close(async () => {
        await close();
        process.exit(0);
      });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })
  .catch((err) => {
    console.error('Error al inicializar la base de datos:', err);
    process.exit(1);
  });

export default app;
