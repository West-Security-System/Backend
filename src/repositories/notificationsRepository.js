const database = require('../db');

function listByUser(userId, limit) {
  return database.listNotificationsByUser(userId, limit);
}

function countUnread(userId) {
  return database.countUnreadNotifications(userId);
}

function markRead(userId) {
  return database.markNotificationsRead(userId);
}

module.exports = { listByUser, countUnread, markRead };