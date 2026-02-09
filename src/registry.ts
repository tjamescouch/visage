import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { HandleRecord, TransactionRecord } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'data', 'visage.db');

export class Registry {
  private db: Database.Database;

  constructor(dbPath: string = DB_PATH) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS handles (
        handle TEXT PRIMARY KEY,
        owner_agent_id TEXT NOT NULL,
        price_paid REAL NOT NULL,
        listed_price REAL,
        registered_at TEXT NOT NULL DEFAULT (datetime('now')),
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        handle TEXT NOT NULL,
        from_agent TEXT,
        to_agent TEXT NOT NULL,
        price REAL NOT NULL,
        proposal_id TEXT,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_handles_owner ON handles(owner_agent_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_handle ON transactions(handle);
    `);
  }

  isAvailable(handle: string): boolean {
    const row = this.db.prepare('SELECT handle FROM handles WHERE handle = ?').get(handle.toLowerCase());
    return !row;
  }

  getHandle(handle: string): HandleRecord | undefined {
    return this.db.prepare('SELECT * FROM handles WHERE handle = ?').get(handle.toLowerCase()) as HandleRecord | undefined;
  }

  getHandlesByOwner(agentId: string): HandleRecord[] {
    return this.db.prepare('SELECT * FROM handles WHERE owner_agent_id = ? ORDER BY registered_at DESC').all(agentId) as HandleRecord[];
  }

  register(handle: string, agentId: string, price: number, proposalId: string | null): void {
    const h = handle.toLowerCase();
    const registerTx = this.db.transaction(() => {
      this.db.prepare(
        'INSERT INTO handles (handle, owner_agent_id, price_paid, status) VALUES (?, ?, ?, ?)'
      ).run(h, agentId, price, 'active');

      this.db.prepare(
        'INSERT INTO transactions (handle, from_agent, to_agent, price, proposal_id, type) VALUES (?, NULL, ?, ?, ?, ?)'
      ).run(h, agentId, price, proposalId, 'purchase');
    });
    registerTx();
  }

  listForSale(handle: string, agentId: string, price: number): boolean {
    const h = handle.toLowerCase();
    const record = this.getHandle(h);
    if (!record || record.owner_agent_id !== agentId) return false;

    this.db.prepare('UPDATE handles SET listed_price = ?, status = ? WHERE handle = ?')
      .run(price, 'listed', h);
    return true;
  }

  transfer(handle: string, fromAgent: string, toAgent: string, price: number, proposalId: string | null): boolean {
    const h = handle.toLowerCase();
    const record = this.getHandle(h);
    if (!record || record.owner_agent_id !== fromAgent) return false;

    const transferTx = this.db.transaction(() => {
      this.db.prepare(
        'UPDATE handles SET owner_agent_id = ?, price_paid = ?, listed_price = NULL, status = ? WHERE handle = ?'
      ).run(toAgent, price, 'active', h);

      this.db.prepare(
        'INSERT INTO transactions (handle, from_agent, to_agent, price, proposal_id, type) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(h, fromAgent, toAgent, price, proposalId, 'resale');
    });
    transferTx();
    return true;
  }

  getListedHandles(): HandleRecord[] {
    return this.db.prepare("SELECT * FROM handles WHERE status = 'listed' ORDER BY listed_price ASC").all() as HandleRecord[];
  }

  getTransactions(handle: string): TransactionRecord[] {
    return this.db.prepare('SELECT * FROM transactions WHERE handle = ? ORDER BY timestamp DESC').all(handle.toLowerCase()) as TransactionRecord[];
  }

  getRecentRegistrations(limit: number = 10): HandleRecord[] {
    return this.db.prepare('SELECT * FROM handles ORDER BY registered_at DESC LIMIT ?').all(limit) as HandleRecord[];
  }

  close(): void {
    this.db.close();
  }
}
