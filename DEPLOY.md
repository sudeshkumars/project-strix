# Stryx — Deploy Guide

## Requirements
- Node.js >= 22.12.0
- npm >= 10

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
BOT_TOKEN=your_bot_token
CLIENT_ID=your_application_id
BOT_OWNER_ID=your_discord_user_id
NODE_ENV=development          # change to production when live
DEV_GUILD_ID=your_test_guild  # only needed in development
```

---

## 3. Initialise the database

```bash
npm run migrate
```

Creates `data/stryx.db` with all 30 tables and indexes.

---

## 4. Deploy slash commands

**Development** (instant, guild-scoped):
```bash
NODE_ENV=development npm run deploy
```

**Production** (global, ~1 hour propagation):
```bash
NODE_ENV=production npm run deploy
```

Commands are hashed — re-running only deploys if something changed.

---

## 5. Start the bot

```bash
# Development
npm run dev

# Production
npm start
```

---

## Pterodactyl / Panel deploy

Working directory: `/home/container/stryx`

Start command:
```
node src/index.js
```

Install command:
```
npm install --production
```

Set all env vars in the panel's startup variables tab.

---

## PM2 (optional)

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## File structure summary

```
stryx/
├── src/
│   ├── index.js                  ← Boot entry
│   ├── commands/
│   │   ├── mod/                  ← ban, kick, mute, warn, case, purge...
│   │   ├── automod/              ← automod rules
│   │   ├── tickets/              ← ticket system
│   │   ├── roles/                ← role panels, temp roles
│   │   ├── levels/               ← xp, rank, leaderboard, level roles
│   │   ├── community/            ← welcome, suggest, giveaway, rep
│   │   ├── tags/                 ← custom commands
│   │   ├── scheduler/            ← scheduled messages
│   │   ├── config/               ← server config
│   │   ├── utility/              ← help, userinfo, serverinfo, ping...
│   │   ├── unique/               ← bansync, tempvoice, modactivity...
│   │   └── owner/                ← eval, blacklist, broadcast, botstats
│   ├── events/                   ← Discord gateway events
│   ├── interactions/
│   │   ├── buttons/
│   │   ├── modals/
│   │   └── menus/
│   ├── handlers/                 ← auto-loaders
│   ├── middleware/               ← pipeline (blacklist, perm, cooldown)
│   └── tasks/                    ← cron jobs
├── shared/
│   ├── db.js                     ← SQLite + all queries
│   ├── logger.js                 ← Winston logger
│   ├── embed.js                  ← Embed builders
│   ├── permissions.js            ← Tier resolution
│   ├── cache.js                  ← Guild config cache
│   └── utils.js                  ← Helpers
├── scripts/
│   ├── deploy.js                 ← Slash command deployer
│   └── migrate.js                ← DB runner
├── data/                         ← stryx.db, transcripts, fonts
└── logs/                         ← winston log files
```

---

## Adding a new command

1. Create `src/commands/<category>/mycommand.js`
2. Export `{ data, execute, permLevel?, cooldown?, guildOnly? }`
3. Restart — auto-loader picks it up
4. Run `npm run deploy` to register the slash command

## Adding a new event

1. Create `src/events/myevent.js`
2. Export `{ name, once?, execute(client, ...args) }`
3. Restart — auto-loader picks it up

## Adding a new task

1. Create `src/tasks/mytask.js`
2. Export `{ name, interval, execute(client) }` with valid cron
3. Restart — auto-loader picks it up
