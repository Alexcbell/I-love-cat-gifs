# GIF Bot

A Discord bot for GIF-only Media-Share channels, user-owned GIF columns, duplicate GIF warnings, link filtering, and staff configuration.

## Requirements

- Node.js 22.12.0 or newer
- A Discord bot application
- Bot permissions:
  - Manage Channels
  - Manage Messages
  - View Channels
  - Send Messages
  - Embed Links
  - Attach Files
  - Read Message History
- Privileged Gateway Intent enabled in the Discord Developer Portal:
  - Message Content Intent
  - Server Members Intent

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
GUILD_ID=your_test_server_id_here
```

Deploy slash commands:

```bash
npm run deploy
```

Start the bot:

```bash
npm start
```

## Recommended first-time configuration

Set logging, staff role, and booster role:

```text
/config modlog channel:#bot-logs
/config staffrole role:@Moderator
/config boosterrole role:@Server Booster
```

Create a column type:

```text
/type create name:anime category:#Anime-GIFs
```

Create a user-owned column:

```text
/column create owner:@User type:anime name:user-gifs
```

Add a Media-Share channel:

```text
/mediashare add channel:#gifs limit:50
```

Enable general-channel non-GIF link filtering:

```text
/linkfilter enable channel:#general
```

## Main behavior

### Media-Share channels

- Only GIF links or GIF attachments are allowed.
- Default GIF limit is 50.
- When the limit is exceeded, the oldest tracked GIF message is deleted.
- Invalid messages are deleted.
- If deletion fails, the bot replies with:

```text
This message should not be here :(
Reason: [reason]
```

### Attachments

Disable attachments in a Media-Share channel:

```text
/mediashare attachments channel:#channel enabled:false
```

Enable them again:

```text
/mediashare attachments channel:#channel enabled:true
```

### Duplicate GIFs

If duplicate warnings are enabled, the bot DMs the user with links to both messages:

```text
Duplicate GIF detected.

Your message: [link]
Original message: [link]
```

### Owned columns

- Staff creates columns.
- Everyone can view.
- Only owner, collaborators, and staff can post.
- Owners can use `/columnadd` and `/columnremove`.
- Server boosters get unlimited GIFs only in their owned column.

## Deploying on DigitalOcean with PM2

```bash
sudo apt update
sudo apt install -y nodejs npm
sudo npm install -g pm2
npm install
npm run deploy
pm2 start src/index.js --name gif-bot
pm2 save
pm2 startup
```

If your droplet installs an older Node version, install Node 22 using NodeSource or nvm before running the bot.
