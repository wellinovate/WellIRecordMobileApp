// Shared setup for tests that need a real MongoDB. They run only when MONGODB_URI_TEST is set
// (CI starts a mongo:7 service; locally any MongoDB or FerretDB works). Each run uses its own
// database and drops it at the end.
import mongoose from 'mongoose';

export const TEST_URI = process.env.MONGODB_URI_TEST || '';
export const hasDb = Boolean(TEST_URI);
let dbName = '';

export async function connect() {
  dbName = `wr_it_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const u = new URL(TEST_URI);
  u.pathname = `/${dbName}`;
  await mongoose.connect(u.toString(), { serverSelectionTimeoutMS: 8000 });
}

export async function disconnect() {
  try {
    await mongoose.connection.dropDatabase();
  } finally {
    await mongoose.disconnect();
  }
}
