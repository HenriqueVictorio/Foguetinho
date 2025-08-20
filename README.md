# Foguetinho (Protótipo Crash Game)

Protótipo simples com:
- Backend Node.js + Express + WebSocket
- Banco SQLite (better-sqlite3)
- Frontend HTML/JS estático

Regras:
- Saldo inicial: 1000 moedas por usuário
- Rodadas de 10s, multiplicador sobe e em algum ponto "explode"
- Aposte e saque antes do crash
- Ranking em tempo real

## Como rodar (Windows / PowerShell)

1. Instale dependências do servidor:

```
cd server; npm install
```

2. Suba o servidor (porta 3001):

```
npm run dev
```

3. Abra o cliente abrindo o arquivo `client/public/index.html` no navegador.

Obs: Para servir estaticamente o cliente, use qualquer servidor HTTP simples, como o Live Server do VS Code.

## Notas
- Este é um protótipo sem autenticação real. Cadastro é apenas por nome.
- O modelo de distribuição do crash é exponencial com limite em 10x.
- Para 120 usuários simultâneos, mova para uma hospedagem com 2 vCPU / 2 GB RAM e considere Postgres.
