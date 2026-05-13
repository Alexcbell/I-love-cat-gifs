# GIF Bot

A Discord bot for GIF-only Media-Share channels, user-owned GIF columns, duplicate GIF warnings, link filtering, levels, and staff configuration.

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
/config helperrole role:@Helper
/config moderatorrole role:@Moderator
/config adminrole role:@Admin
/config boosterrole role:@Server Booster
/config memberrole role:@Member
/config unverifiedrole role:@Unverified
/config updateschannel channel:#bot-updates
/config adminupdates channel:#admin-bot-updates
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

- GIF-only deletion is off by default. Staff can enable it with `/mediashare gifonly channel:#channel enabled:true`.
- Default GIF limit is 50.
- When the limit is exceeded, the oldest tracked GIF message is deleted.
- Invalid messages are deleted only when GIF-only deletion is enabled.
- Messages from users with Administrator or Manage Server permissions are never deleted by the bot.
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

Allow text captions alongside GIFs:

```text
/mediashare captions channel:#channel enabled:true
```

### Duplicate GIFs

If duplicate warnings are enabled, the bot DMs the user with links to both messages:

```text
Duplicate GIF detected.

Your message: [link]
Original message: [link]
```

Members can use `/gif` to pull a random archived GIF. Optional filters: `channel`, `user`, or `mine:true`.

### Levels

- Normal messages are worth 10 XP.
- GIF messages are worth 20 XP.
- Levels are based on total XP and are tracked per server.
- Each message is counted once, so history scans can be safely run again later.

Useful level commands:

```text
/level rank
/level rank user:@User
/level leaderboard
/level scan channel:#general limit:5000
/level scan limit:1000
```

`/level scan` is staff-only. With a channel, it scans that channel's previous messages. Without a channel, it scans text channels the bot can view and read. The bot can only award XP for old conversations it has permission to fetch through Discord message history.

### Owned columns

- Staff creates columns.
- Members with the configured member role can view. The default role ID is `1501345523368464456`.
- Users with the configured unverified role are hidden from member channels. The default role ID is `1501346525819699342`.
- Only owner, collaborators, and staff can post.
- Owners can use `/columnadd` and `/columnremove`.
- Owners can use `/column gifonly channel:#channel enabled:true` to enable non-GIF deletion for their column.
- Owners can use `/column captions channel:#channel enabled:true` to allow captions with GIFs.
- Owners can use `/column syncperms`, `/column lock`, `/column unlock`, and `/column rename`.
- Staff can use `/column archive` to freeze a column without deleting it.
- Server boosters get unlimited GIFs only in their owned column.

Useful column commands:

```text
/column info channel:#column
/column syncperms channel:#column
/column lock channel:#column
/column unlock channel:#column
/column rename channel:#column name:new-name
/column archive channel:#column
```

Check bot configuration and stale channel records:

```text
/bot health
/bot announce message:Hii~ I added something new for everyone!
```

Public member-facing update notes are posted once per update to the configured updates channel. The default channel ID is `1501699868224131184`.

Admin update reports are posted once per update to the configured admin updates channel. The default channel ID is `1501702021374546071`.

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
