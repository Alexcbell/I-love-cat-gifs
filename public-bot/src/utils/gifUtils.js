const URL_REGEX = /(https?:\/\/[^\s<>()]+)/gi;

function sanitizeUrl(url) {
  return url.replace(/[),.]+$/g, '').trim();
}

function extractUrls(content = '') {
  return [...content.matchAll(URL_REGEX)].map(match => sanitizeUrl(match[1]));
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
    if ((host === 'cdn.discordapp.com' || host === 'media.discordapp.net') && path.includes('.gif')) return true;
    if ((host === 'tenor.com' || host === 'www.tenor.com') && path.includes('/view/')) return true;
    if ((host === 'giphy.com' || host === 'www.giphy.com') && (path.includes('/gifs/') || path.includes('/clips/'))) return true;
    return host === 'i.imgur.com' && path.endsWith('.gif');
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
    .map(attachment => attachment.url);
  return [...urls, ...attachments].map(url => ({ url, normalizedUrl: normalizeUrl(url) }));
}

function isConvertibleImageAttachment(attachment) {
  const name = attachment.name?.toLowerCase() ?? '';
  const contentType = attachment.contentType?.toLowerCase() ?? '';
  if (isGifAttachment(attachment)) return false;
  return contentType.startsWith('image/')
    || ['.png', '.jpg', '.jpeg', '.webp', '.avif'].some(ext => name.endsWith(ext));
}

module.exports = {
  extractUrls,
  normalizeUrl,
  isGifUrl,
  isGifAttachment,
  getGifItemsFromMessage,
  isConvertibleImageAttachment
};
