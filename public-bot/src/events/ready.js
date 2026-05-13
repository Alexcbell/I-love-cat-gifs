module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`Public GIF bot logged in as ${client.user.tag}`);
  }
};
