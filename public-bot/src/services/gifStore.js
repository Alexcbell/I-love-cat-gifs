const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'gifs.json');
const MAX_RECORDS_PER_GUILD = 5000;

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { guilds: {} };
  }
}

function writeStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function getGuildRecords(store, guildId) {
  if (!store.guilds[guildId]) store.guilds[guildId] = [];
  return store.guilds[guildId];
}

function recordGifMessage(message, gifItem) {
  const store = readStore();
  const records = getGuildRecords(store, message.guild.id);
  const existingIndex = records.findIndex(record => record.messageId === message.id && record.normalizedUrl === gifItem.normalizedUrl);

  const record = {
    guildId: message.guild.id,
    channelId: message.channel.id,
    messageId: message.id,
    userId: message.author.id,
    username: message.member?.displayName || message.author.username,
    url: gifItem.url,
    normalizedUrl: gifItem.normalizedUrl,
    messageUrl: message.url,
    createdAt: Math.floor(message.createdTimestamp / 1000)
  };

  if (existingIndex >= 0) records[existingIndex] = record;
  else records.push(record);

  if (records.length > MAX_RECORDS_PER_GUILD) {
    records.splice(0, records.length - MAX_RECORDS_PER_GUILD);
  }

  writeStore(store);
}

function getRandomGif({ guildId, visibleChannelIds, channelId, userId }) {
  const store = readStore();
  const visible = new Set(visibleChannelIds);
  const records = getGuildRecords(store, guildId)
    .filter(record => visible.has(record.channelId))
    .filter(record => !channelId || record.channelId === channelId)
    .filter(record => !userId || record.userId === userId);

  if (!records.length) return null;
  return records[Math.floor(Math.random() * records.length)];
}

module.exports = {
  recordGifMessage,
  getRandomGif
};
