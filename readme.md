# D.Kumail MD

<p align="center">
  <img src="https://img.shields.io/badge/D.Kumail%20MD-v1.0.0-brightgreen?style=for-the-badge" alt="version" />
  <img src="https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge" alt="nodejs" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="license" />
</p>

A powerful WhatsApp bot framework with multi-session support and extensive configuration options.

## Features

- Multi-device & multi-session support
- Module-based plugin system
- Group management (kick, promote, demote, mute, warn, antilink)
- Sticker maker & media converters
- Auto status read & react
- Welcome/goodbye messages
- Chatbot, TTS, polls, broadcast
- Scheduler & cron jobs
- Health server for Railway/Render/Koyeb
- Docker & PM2 support

---

## Get Session ID

<p align="center">
  <a href="https://dk-md.org">
    <img src="https://img.shields.io/badge/Get%20Session-D.Kumail%20MD-brightgreen?style=for-the-badge" alt="session" />
  </a>
</p>

1. Visit the D.Kumail MD session generator
2. Enter your WhatsApp number with country code
3. Copy the pairing code
4. Open WhatsApp > Settings > Linked Devices > Link a Device
5. Tap "Link with phone number instead"
6. Enter the pairing code
7. You'll receive your session ID on WhatsApp

---

## Deploy

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Fork this repo
2. Go to Railway > New Project > Deploy from GitHub
3. Set environment variables (see below)
4. Deploy!

### Docker

```bash
docker build -t dkumail-md .
docker run -e SESSION=DKML~xxxx -e SESSION_URL=https://your-site.replit.app dkumail-md
```

### VPS / Local

```bash
git clone https://github.com/YOUR_USERNAME/dkumail-md.git
cd dkumail-md
yarn install
```

Create `config.env`:
```env
SESSION=DKML~your_session_id
SESSION_URL=https://your-session-site.replit.app
SUDO=923001234567
MODE=private
```

Start:
```bash
npm start
```

Or without PM2:
```bash
node index.js
```

Stop/Restart:
```bash
pm2 stop dkumail-md
pm2 restart dkumail-md
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION` | - | Session ID (required, e.g. `DKML~a3f8b2c1e9`) |
| `SESSION_URL` | - | Session generator site URL (required for DKML~ IDs) |
| `SUDO` | - | Owner WhatsApp number(s), comma-separated |
| `MODE` | `private` | `private` / `public` |
| `HANDLERS` | `.,` | Command prefix(es) |
| `BOT_NAME` | `D.Kumail MD` | Bot display name |
| `STICKER_DATA` | `D.Kumail MD` | Sticker pack name |
| `DATABASE_URL` | `./bot.db` | PostgreSQL URL or SQLite path |
| `CHATBOT` | `off` | Chatbot mode |
| `LANGUAGE` | `english` | Bot language |
| `WARN` | `4` | Warn limit before kick |
| `ANTI_DELETE` | `false` | Anti-delete messages |
| `AUTO_UPDATE` | `true` | Auto-update bot |
| `USE_SERVER` | `true` | Health server on/off |
| `PORT` | `3000` | Server port |

---

## File Structure

```
dkumail-md/
├── index.js
├── main.js
├── config.js
├── core/
│   ├── auth.js
│   ├── bot.js
│   ├── handler.js
│   ├── manager.js
│   ├── database.js
│   ├── store.js
│   ├── helpers.js
│   ├── schedulers.js
│   ├── session-loader.js
│   └── constructors/
├── plugins/
│   ├── commands.js
│   ├── group.js
│   ├── converters.js
│   ├── manage.js
│   ├── media.js
│   ├── chatbot.js
│   ├── schedule.js
│   └── ...
├── Dockerfile
├── package.json
└── readme.md
```

---

## Credits

- **D.Kumail** - Bot development & customization
- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API

## License

MIT License - D.Kumail MD

---

<p align="center">
  <b>D.Kumail MD</b>
</p>
