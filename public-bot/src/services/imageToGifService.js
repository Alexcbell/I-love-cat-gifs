const { AttachmentBuilder } = require('discord.js');
const { isConvertibleImageAttachment } = require('../utils/gifUtils');

async function convertImageAttachmentToGif(attachment) {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    throw new Error('Image-to-GIF conversion needs the `sharp` package installed.');
  }

  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`Could not download the image (${response.status}).`);

  const input = Buffer.from(await response.arrayBuffer());
  const output = await sharp(input, { animated: false })
    .rotate()
    .resize({
      width: 512,
      height: 512,
      fit: 'inside',
      withoutEnlargement: true
    })
    .gif()
    .toBuffer();

  return new AttachmentBuilder(output, { name: 'converted.gif' });
}

async function handleGifReply(message) {
  if (message.content.trim().toLowerCase() !== '-gif') return false;
  if (!message.reference?.messageId) {
    await message.reply('Reply to an image with `-gif` and I can convert it.').catch(() => null);
    return true;
  }

  const referenced = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
  if (!referenced) {
    await message.reply("I couldn't fetch the message you replied to.").catch(() => null);
    return true;
  }

  const attachment = [...referenced.attachments.values()].find(isConvertibleImageAttachment);
  if (!attachment) {
    await message.reply('That reply does not include a PNG, JPG, WebP, AVIF, or other static image I can convert.').catch(() => null);
    return true;
  }

  await message.channel.sendTyping().catch(() => null);
  try {
    const gif = await convertImageAttachmentToGif(attachment);
    await message.reply({
      content: `${message.author.username}, here you go.`,
      files: [gif],
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    await message.reply(`I could not convert that image yet: ${error.message}`).catch(() => null);
  }

  return true;
}

module.exports = { handleGifReply };
