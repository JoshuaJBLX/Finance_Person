import 'dotenv/config';
import { MongoClient } from 'mongodb';

/**
 * Capa de conexión a MongoDB (Atlas en producción / local en desarrollo).
 *
 * La URI se lee de MONGODB_URI (o MONGODB_ATLAS_URI como alias). El nombre de
 * la base de datos se resuelve en este orden:
 *   1. MONGODB_DB
 *   2. DB_PATH (lo usan las pruebas: genera un nombre único por proceso)
 *   3. MONGODB_DB_NAME
 *   4. finance_person
 */
const uri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || 'mongodb://127.0.0.1:27017';

function resolveDbName() {
  // En pruebas se fuerza una BD efímera aunque el .env defina MONGODB_DB.
  if (process.env.NODE_ENV === 'test') return process.env.MONGODB_TEST_DB || 'finance_person_test';
  if (process.env.MONGODB_DB) return process.env.MONGODB_DB;
  if (process.env.DB_PATH) {
    const base = process.env.DB_PATH.split(/[\\/]/).pop().replace(/\.db$/i, '');
    return `fp_${base}_${process.pid}`;
  }
  return process.env.MONGODB_DB_NAME || 'finance_person';
}

export const DB_NAME = resolveDbName();
export const MONGO_URI = uri;

let client = null;
let database = null;

/** Crea los índices equivalentes a las restricciones del esquema SQLite anterior. */
async function ensureIndexes(db) {
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),

    // NULL/undefined userId = categoría global: no debe entrar en el índice único.
    db.collection('categories').createIndex(
      { userId: 1, name: 1, type: 1 },
      { unique: true, partialFilterExpression: { userId: { $type: 'string' } } }
    ),

    db.collection('accounts').createIndex({ userId: 1, name: 1 }, { unique: true }),
    db.collection('transactions').createIndex({ userId: 1, date: -1 }),
    db.collection('transactions').createIndex({ userId: 1, type: 1 }),
    db.collection('budgets').createIndex({ userId: 1, categoryId: 1, month: 1 }, { unique: true })
  ]);
}

export async function connect() {
  if (database) return database;

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 20
  });
  await client.connect();
  database = client.db(DB_NAME);
  await ensureIndexes(database);

  // Las suites de pruebas usan una BD efímera: se garantiza estado limpio
  // borrando documentos (readWrite basta; dropDatabase requiere dbAdmin).
  if (process.env.NODE_ENV === 'test') {
    const collections = await database.listCollections().toArray();
    await Promise.all(
      collections.map((c) => database.collection(c.name).deleteMany({}))
    );
    await ensureIndexes(database);
  }

  return database;
}

/** Devuelve la BD conectada. Falla rápido si se olvidó llamar a connect(). */
export function getDb() {
  if (!database) {
    throw new Error('MongoDB no conectada: llama a connect() antes de usar la base de datos.');
  }
  return database;
}

export async function close() {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
}

export default { connect, close, getDb, DB_NAME };
