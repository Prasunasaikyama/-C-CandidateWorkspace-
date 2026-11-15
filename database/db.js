/**
 * Database Connector for Enterprise Multi-Touch Attribution System
 * Uses Node.js native DatabaseSync (node:sqlite)
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

class DatabaseConnection {
  constructor(dbPath) {
    const resolvedPath = dbPath || path.join(__dirname, 'attribution.db');
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.dbPath = resolvedPath;
    this.db = new DatabaseSync(resolvedPath);
    
    // Performance and integrity pragmas
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  transaction(fn) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = fn(this);
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  close() {
    this.db.close();
  }
}

// Singleton helper or factory
let instance = null;

function getDb(customPath) {
  if (!instance || customPath) {
    instance = new DatabaseConnection(customPath);
  }
  return instance;
}

module.exports = {
  DatabaseConnection,
  getDb
};
