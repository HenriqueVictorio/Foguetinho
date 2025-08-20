import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'foguetinho.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  balance INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  crash_multiplier REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  cashed_out_at_multiplier REAL,
  result TEXT CHECK(result IN ('win','lose')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(round_id) REFERENCES rounds(id)
);
`);

export function createUser({ id, name, balance }) {
  const stmt = db.prepare('INSERT INTO users (id, name, balance) VALUES (?, ?, ?)');
  stmt.run(id, name, balance);
}

export function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function updateUserBalance(id, delta) {
  const stmt = db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?');
  stmt.run(delta, id);
}

export function setUserBalance(id, value) {
  const stmt = db.prepare('UPDATE users SET balance = ? WHERE id = ?');
  stmt.run(value, id);
}

export function topUsers(limit = 20) {
  return db.prepare('SELECT id, name, balance FROM users ORDER BY balance DESC LIMIT ?').all(limit);
}

export function createRound({ id, start_time }) {
  db.prepare('INSERT INTO rounds (id, start_time) VALUES (?, ?)').run(id, start_time);
}

export function endRound({ id, end_time, crash_multiplier }) {
  db.prepare('UPDATE rounds SET end_time = ?, crash_multiplier = ? WHERE id = ?').run(end_time, crash_multiplier, id);
}

export function placeBet({ id, user_id, round_id, amount }) {
  db.prepare('INSERT INTO bets (id, user_id, round_id, amount) VALUES (?, ?, ?, ?)')
    .run(id, user_id, round_id, amount);
}

export function cashOut({ bet_id, multiplier, win }) {
  db.prepare('UPDATE bets SET cashed_out_at_multiplier = ?, result = ? WHERE id = ?')
    .run(multiplier, win ? 'win' : 'lose', bet_id);
}

export function getUserBetsInRound(user_id, round_id) {
  return db.prepare('SELECT * FROM bets WHERE user_id = ? AND round_id = ?').all(user_id, round_id);
}

export function loseUncashedBetsForRound(round_id) {
  // Marks all bets of a round that haven't been resolved as lost
  db.prepare("UPDATE bets SET result = 'lose' WHERE round_id = ? AND result IS NULL").run(round_id);
}
