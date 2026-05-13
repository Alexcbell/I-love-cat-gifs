# Public GIF Bot

A small public Discord bot for collecting GIFs it can see and resurfacing them with `/gif`.

It also supports replying to an image with:

```text
-gif
```

The bot downloads the replied-to image and uploads a converted `converted.gif`.

## Setup

```bash
cd public-bot
npm install
cp .env.example .env
```

Fill in `.env`:

```env
DISCORD_TOKEN=your_public_bot_token_here
CLIENT_ID=your_public_bot_application_client_id_here
GUILD_ID=your_test_server_id_here
```

Deploy commands:

```bash
npm run deploy
```

Start:

```bash
npm start
```

## Discord Developer Portal

Enable the Message Content Intent so the bot can:

- notice GIF links and GIF attachments for the archive
- detect `-gif` when someone replies to an image

Recommended invite permissions:

- View Channels
- Send Messages
- Read Message History
- Attach Files
- Embed Links

## Notes

- `GUILD_ID` is optional. With it, slash commands deploy instantly to one test server. Without it, commands deploy globally and can take longer to appear.
- GIF archive data is stored in `data/gifs.json`.
- The archive is per server and capped at 5,000 GIF records per server.
