module.exports = async function download(cmd, text) {
  let reply = null;
  if (cmd === 'sticker') reply = 'Send image with caption *sticker* to make sticker';
  else if (cmd === 'toimg') reply = 'Reply to sticker with *toimg*';
  else if (cmd === 'tovideo') reply = 'Reply to sticker with *tovideo*';
  else if (cmd === 'download') reply = 'Download: Send link';
  return reply;
};
