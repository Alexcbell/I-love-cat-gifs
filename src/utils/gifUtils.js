const URL_REGEX = /(https?:\/\/[^\s<>()]+)/gi;

const GIF_HOSTS = [
  'tenor.com',
  'www.tenor.com',
  'media.tenor.com',
  'giphy.com',
  'www.giphy.com',
  'media.giphy.com',
  'i.giphy.com',
  'imgur.com',
  'i.imgur.com',
  'cdn.discordapp.com',
  'media.discordapp.net'
];

function extractUrls(content = '') {
  return [...content.matchAll(URL_REGEX)].map(match => sanitizeUrl(match[1]));
}

function sanitizeUrl(url) {
  return url.replace(/[),.]+$/g, '').trim();
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.searchParams.sort();
    return parsed.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function isGifUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (path.endsWith('.gif')) return true;
    if (host === 'media.tenor.com') return true;
    if (host === 'media.giphy.com' || host === 'i.giphy.com') return true;
    if (host === 'cdn.discordapp.com' || host === 'media.discordapp.net') {
      return path.includes('.gif');
    }

    if (host === 'tenor.com' || host === 'www.tenor.com') return path.includes('/view/');
    if (host === 'giphy.com' || host === 'www.giphy.com') {
      return path.includes('/gifs/') || path.includes('/clips/');
    }
    if (host === 'i.imgur.com') return path.endsWith('.gif');

    return GIF_HOSTS.includes(host) && path.endsWith('.gif');
  } catch {
    return false;
  }
}

function isGifAttachment(attachment) {
  const name = attachment.name?.toLowerCase() ?? '';
  const contentType = attachment.contentType?.toLowerCase() ?? '';
  return name.endsWith('.gif') || contentType === 'image/gif';
}

function getGifItemsFromMessage(message) {
  const urls = extractUrls(message.content).filter(isGifUrl);
  const attachments = [...message.attachments.values()]
    .filter(isGifAttachment)
    .map(att => att.url);
  return [...urls, ...attachments].map(url => ({ url, normalizedUrl: normalizeUrl(url) }));
}

function hasAnyLink(message) {
  return extractUrls(message.content).length > 0;
}

function hasOnlyGifContent(message, attachmentsEnabled = true, captionsEnabled = false) {
  const urls = extractUrls(message.content);
  const hasNonGifUrl = urls.some(url => !isGifUrl(url));
  if (hasNonGifUrl) return { ok: false, reason: 'Only GIF links are allowed in this channel.' };

  if (!attachmentsEnabled && message.attachments.size > 0) {
    return { ok: false, reason: 'Attachments are currently not allowed in this channel.' };
  }

  const hasBadAttachment = [...message.attachments.values()].some(att => !isGifAttachment(att));
  if (hasBadAttachment) return { ok: false, reason: 'Only GIF attachments are allowed in this channel.' };

  const hasGif = urls.some(isGifUrl) || [...message.attachments.values()].some(isGifAttachment);
  if (!hasGif) return { ok: false, reason: 'Media-Share channels only allow GIF links or GIF attachments.' };

  const textWithoutUrls = urls.reduce((text, url) => text.replace(url, ''), message.content).trim();
  if (!captionsEnabled && textWithoutUrls.length > 0) {
    return { ok: false, reason: 'Text messages are not allowed in Media-Share channels.' };
  }

  return { ok: true, reason: null };
}

module.exports = {
  extractUrls,
  normalizeUrl,
  isGifUrl,
  isGifAttachment,
  getGifItemsFromMessage,
  hasAnyLink,
  hasOnlyGifContent
};
