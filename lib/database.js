// Database - stores deleted messages for AntiDelete
const deletedCache = new Map();
function saveMsg(id, text) {
  if (text) deletedCache.set(id, text);
  if (deletedCache.size > 200) deletedCache.delete(deletedCache.keys().next().value);
}
function getMsg(id) { return deletedCache.get(id); }
module.exports = { deletedCache, saveMsg, getMsg };
