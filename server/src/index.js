import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { db, createUser, getUser, updateUserBalance, setUserBalance, placeBet, cashOut, getUserBetsInRound, topUsers, loseUncashedBetsForRound } from './db.js';
import { CrashGame } from './game.js';

const app = express();
app.use(cors());
app.use(express.json());

// Root endpoint (informativo)
app.get('/', (req, res) => {
  res.type('html').send(`
    <html>
      <head><meta charset="utf-8"><title>Foguetinho API</title></head>
      <body style="font-family:system-ui;padding:20px;">
        <h1>Foguetinho API</h1>
        <p>Servidor online. Use o frontend com a URL do servidor via parâmetro:</p>
        <pre>https://SEU_FRONT/?server=${req.protocol}://${req.get('host')}</pre>
        <p>Endpoints úteis:</p>
        <ul>
          <li><a href="/api/ranking">/api/ranking</a></li>
        </ul>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log('Server listening on port', PORT);
});

const wss = new WebSocketServer({ server });

const INITIAL_BALANCE = 1000; // moedas

const game = new CrashGame({
  tickMs: 100,
  roundDurationMs: 10000,
  onTick: broadcastState,
  onRoundStart: (s) => broadcast({ type: 'round_start', ...s }),
  onRoundEnd: (s) => {
    broadcast({ type: 'round_end', ...s });
    try {
      loseUncashedBetsForRound(s.roundId);
    } catch (e) {
      console.error('Erro ao finalizar apostas da rodada', e);
    }
  }
});

game.start();

function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

function broadcastState({ roundId, multiplier, crashAt }) {
  broadcast({ type: 'tick', roundId, multiplier, crashAt });
}

// Session-less quick auth: create or get user by name
app.post('/api/signup', (req, res) => {
  const { name } = req.body;
  if (!name || name.length < 2) return res.status(400).json({ error: 'Nome inválido' });
  let user = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
  if (!user) {
    const id = uuidv4();
    createUser({ id, name, balance: INITIAL_BALANCE });
    user = getUser(id);
  }
  return res.json({ id: user.id, name: user.name, balance: user.balance });
});

app.get('/api/ranking', (req, res) => {
  const list = topUsers(20);
  res.json(list);
});

// Bets
app.post('/api/bet', (req, res) => {
  const { userId, amount } = req.body;
  if (!userId || !Number.isInteger(amount) || amount <= 0) return res.status(400).json({ error: 'Dados inválidos' });
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (user.balance < amount) return res.status(400).json({ error: 'Saldo insuficiente' });

  const roundId = game.currentRoundId;
  const betsThisRound = getUserBetsInRound(userId, roundId);
  const alreadyBet = betsThisRound.reduce((s, b) => s + b.amount, 0);
  if (alreadyBet + amount > user.balance) return res.status(400).json({ error: 'Aposta excede saldo disponível' });

  const betId = uuidv4();
  placeBet({ id: betId, user_id: userId, round_id: roundId, amount });
  updateUserBalance(userId, -amount);
  broadcast({ type: 'bet_placed', userId, roundId, betId, amount });
  res.json({ betId, roundId, newBalance: getUser(userId).balance });
});

app.post('/api/cashout', (req, res) => {
  const { userId, betId, atMultiplier } = req.body;
  if (!userId || !betId || typeof atMultiplier !== 'number') return res.status(400).json({ error: 'Dados inválidos' });
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const bet = db.prepare('SELECT * FROM bets WHERE id = ? AND user_id = ?').get(betId, userId);
  if (!bet) return res.status(404).json({ error: 'Aposta não encontrada' });
  if (bet.result) return res.status(400).json({ error: 'Aposta já finalizada' });

  const roundId = game.currentRoundId;
  if (bet.round_id !== roundId) return res.status(400).json({ error: 'Rodada já encerrou' });

  // payout
  const payout = Math.floor(bet.amount * atMultiplier);
  updateUserBalance(userId, payout);
  cashOut({ bet_id: betId, multiplier: atMultiplier, win: true });
  broadcast({ type: 'cashout', userId, betId, atMultiplier, payout, balance: getUser(userId).balance });
  res.json({ payout, balance: getUser(userId).balance });
});

// WebSocket connections: can subscribe to ticks
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', roundId: game.currentRoundId }));
});
