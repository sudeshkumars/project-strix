'use strict'

const Database = require('better-sqlite3')
const path     = require('path')
const fs       = require('fs')

const DB_PATH = path.join(__dirname, '../data/stryx.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

let db

// ─── Init ────────────────────────────────────────────────────────────────────
function init () {
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate()
  return db
}

function getDb () {
  if (!db) init()
  return db
}

const now = () => Math.floor(Date.now() / 1000)

// ─── Migrations ──────────────────────────────────────────────────────────────
function migrate () {
  db.exec(`
    CREATE TABLE IF NOT EXISTS guilds (
      guild_id   TEXT PRIMARY KEY,
      prefix     TEXT    DEFAULT '!',
      language   TEXT    DEFAULT 'en',
      joined_at  INTEGER,
      active     INTEGER DEFAULT 1,
      owner_id   TEXT
    );

    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id             TEXT PRIMARY KEY,
      mod_roles            TEXT DEFAULT '[]',
      admin_roles          TEXT DEFAULT '[]',
      mute_role            TEXT,
      verify_role          TEXT,
      log_channel          TEXT,
      mod_channel          TEXT,
      welcome_channel      TEXT,
      goodbye_channel      TEXT,
      suggestions_channel  TEXT,
      starboard_channel    TEXT,
      updates_channel_id   TEXT,
      log_routes           TEXT DEFAULT '{}',
      log_ignore_roles     TEXT DEFAULT '[]',
      log_ignore_channels  TEXT DEFAULT '[]',
      welcome_style        TEXT DEFAULT 'embed',
      welcome_message      TEXT DEFAULT 'Welcome {user} to {server}!',
      welcome_color        TEXT DEFAULT '#5865F2',
      welcome_bg_url       TEXT,
      welcome_dm           INTEGER DEFAULT 0,
      welcome_dm_message   TEXT,
      welcome_autorole     TEXT DEFAULT '[]',
      welcome_show_avatar  INTEGER DEFAULT 1,
      goodbye_message      TEXT DEFAULT '{username} has left {server}.',
      warn_threshold       INTEGER DEFAULT 3,
      warn_decay_days      INTEGER DEFAULT 30,
      dm_on_action         INTEGER DEFAULT 1,
      appeal_channel       TEXT,
      case_channel         TEXT,
      xp_min               INTEGER DEFAULT 15,
      xp_max               INTEGER DEFAULT 25,
      xp_cooldown          INTEGER DEFAULT 60,
      levelup_channel      TEXT,
      levelup_message      TEXT DEFAULT 'GG {user}, you reached level {level}!',
      xp_blacklist         TEXT DEFAULT '{}',
      xp_multipliers       TEXT DEFAULT '[]',
      star_threshold       INTEGER DEFAULT 3,
      star_emoji           TEXT DEFAULT '⭐',
      ticket_category      TEXT,
      ticket_support_role  TEXT,
      ticket_auto_close    INTEGER DEFAULT 0,
      webhook_id           TEXT,
      webhook_url          TEXT,
      modules              TEXT DEFAULT '{}',
      setup_complete       INTEGER DEFAULT 0,
      api_enabled          INTEGER DEFAULT 0,
      api_key              TEXT,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS automod_rules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id        TEXT NOT NULL,
      trigger_type    TEXT NOT NULL,
      threshold       INTEGER,
      window_secs     INTEGER DEFAULT 10,
      action          TEXT NOT NULL,
      duration        INTEGER,
      ignore_roles    TEXT DEFAULT '[]',
      ignore_channels TEXT DEFAULT '[]',
      word_list       TEXT DEFAULT '[]',
      enabled         INTEGER DEFAULT 1,
      created_at      INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id       TEXT NOT NULL,
      guild_id      TEXT NOT NULL,
      xp            INTEGER DEFAULT 0,
      level         INTEGER DEFAULT 0,
      messages      INTEGER DEFAULT 0,
      voice_minutes INTEGER DEFAULT 0,
      last_active   INTEGER,
      last_xp       INTEGER DEFAULT 0,
      rep           INTEGER DEFAULT 0,
      last_rep      INTEGER DEFAULT 0,
      birthday      TEXT,
      flags         TEXT DEFAULT '{}',
      PRIMARY KEY (user_id, guild_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cases (
      case_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      mod_id     TEXT NOT NULL,
      type       TEXT NOT NULL,
      reason     TEXT,
      active     INTEGER DEFAULT 1,
      expires_at INTEGER,
      created_at INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS warnings (
      warn_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      mod_id     TEXT NOT NULL,
      reason     TEXT,
      points     INTEGER DEFAULT 1,
      pardoned   INTEGER DEFAULT 0,
      case_id    INTEGER,
      created_at INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE,
      FOREIGN KEY (case_id)  REFERENCES cases(case_id)
    );

    CREATE TABLE IF NOT EXISTS temp_punishments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      type       TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      active     INTEGER DEFAULT 1,
      case_id    INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
      ticket_id  INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      channel_id TEXT,
      status     TEXT DEFAULT 'open',
      category   TEXT,
      priority   TEXT DEFAULT 'medium',
      claimed_by TEXT,
      closed_at  INTEGER,
      feedback   TEXT,
      transcript TEXT,
      created_at INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS role_panels (
      panel_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id      TEXT NOT NULL,
      channel_id    TEXT,
      message_id    TEXT,
      title         TEXT,
      style         TEXT DEFAULT 'button',
      exclusive     INTEGER DEFAULT 0,
      required_role TEXT,
      roles         TEXT DEFAULT '[]',
      created_at    INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS custom_commands (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id      TEXT NOT NULL,
      trigger       TEXT NOT NULL,
      response      TEXT NOT NULL,
      type          TEXT DEFAULT 'tag',
      perm_level    TEXT DEFAULT 'user',
      regex         INTEGER DEFAULT 0,
      channel_scope TEXT DEFAULT '[]',
      cooldown      INTEGER DEFAULT 0,
      uses          INTEGER DEFAULT 0,
      created_at    INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      content    TEXT,
      embed      TEXT,
      cron       TEXT,
      last_run   INTEGER,
      enabled    INTEGER DEFAULT 1,
      created_at INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS level_roles (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      level    INTEGER NOT NULL,
      role_id  TEXT NOT NULL,
      UNIQUE(guild_id, level),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id    TEXT NOT NULL,
      executor_id TEXT,
      action      TEXT NOT NULL,
      target_id   TEXT,
      details     TEXT,
      created_at  INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS eval_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      executor_id TEXT NOT NULL,
      input       TEXT,
      output      TEXT,
      created_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS blacklist_guilds (
      guild_id TEXT PRIMARY KEY,
      reason   TEXT,
      added_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS blacklist_users (
      user_id  TEXT PRIMARY KEY,
      reason   TEXT,
      added_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      token      TEXT NOT NULL UNIQUE,
      guild_id   TEXT NOT NULL,
      scopes     TEXT DEFAULT '[]',
      created_at INTEGER,
      expires_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS broadcast_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT,
      type       TEXT,
      content    TEXT,
      sent_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      skip_count INTEGER DEFAULT 0,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS bot_stats (
      date           TEXT PRIMARY KEY,
      commands_fired INTEGER DEFAULT 0,
      joins          INTEGER DEFAULT 0,
      leaves         INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS activity_stats (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id      TEXT NOT NULL,
      date          TEXT NOT NULL,
      messages      INTEGER DEFAULT 0,
      joins         INTEGER DEFAULT 0,
      leaves        INTEGER DEFAULT 0,
      voice_minutes INTEGER DEFAULT 0,
      UNIQUE(guild_id, date),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bansync_guilds (
      guild_id         TEXT NOT NULL,
      trusted_guild_id TEXT NOT NULL,
      added_at         INTEGER,
      PRIMARY KEY (guild_id, trusted_guild_id)
    );

    CREATE TABLE IF NOT EXISTS reputation (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id    TEXT NOT NULL,
      giver_id    TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      created_at  INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      word       TEXT NOT NULL,
      created_at INTEGER,
      UNIQUE(guild_id, user_id, word),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS giveaways (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id      TEXT NOT NULL,
      channel_id    TEXT NOT NULL,
      message_id    TEXT,
      prize         TEXT NOT NULL,
      winners       INTEGER DEFAULT 1,
      ends_at       INTEGER NOT NULL,
      ended         INTEGER DEFAULT 0,
      required_role TEXT,
      bonus_role    TEXT,
      bonus_entries INTEGER DEFAULT 1,
      created_by    TEXT,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      content    TEXT NOT NULL,
      status     TEXT DEFAULT 'pending',
      mod_note   TEXT,
      message_id TEXT,
      created_at INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS temp_roles (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      role_id    TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      active     INTEGER DEFAULT 1,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS temp_voice (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      owner_id   TEXT NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mod_notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      mod_id     TEXT NOT NULL,
      note       TEXT NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS xp_multipliers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      role_id    TEXT NOT NULL,
      multiplier REAL DEFAULT 1.0,
      UNIQUE(guild_id, role_id),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS embed_templates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id    TEXT NOT NULL,
      name        TEXT NOT NULL,
      title       TEXT,
      description TEXT,
      color       TEXT,
      footer      TEXT,
      image       TEXT,
      thumbnail   TEXT,
      author_name TEXT,
      author_icon TEXT,
      fields      TEXT DEFAULT '[]',
      created_by  TEXT,
      created_at  INTEGER,
      UNIQUE(guild_id, name),
      FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cases_guild_user    ON cases(guild_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_users_guild         ON users(guild_id);
    CREATE INDEX IF NOT EXISTS idx_temp_active         ON temp_punishments(active, expires_at);
    CREATE INDEX IF NOT EXISTS idx_temp_roles_active   ON temp_roles(active, expires_at);
    CREATE INDEX IF NOT EXISTS idx_tickets_guild       ON tickets(guild_id);
    CREATE INDEX IF NOT EXISTS idx_activity_guild_date ON activity_stats(guild_id, date);
    CREATE INDEX IF NOT EXISTS idx_audit_guild         ON audit_log(guild_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_automod_guild       ON automod_rules(guild_id);
    CREATE INDEX IF NOT EXISTS idx_custom_cmds_guild   ON custom_commands(guild_id);
    CREATE INDEX IF NOT EXISTS idx_highlights_guild    ON highlights(guild_id);
    CREATE INDEX IF NOT EXISTS idx_xp_multi_guild      ON xp_multipliers(guild_id);
    CREATE INDEX IF NOT EXISTS idx_embed_templates_guild ON embed_templates(guild_id);
  `)
}

// ══════════════════════════════════════════════════════════════════
// GUILDS
// ══════════════════════════════════════════════════════════════════

function createGuild (guildId, ownerId) {
  getDb().prepare(`INSERT OR IGNORE INTO guilds (guild_id, owner_id, joined_at) VALUES (?,?,?)`)
    .run(guildId, ownerId, now())
}

function getGuild (guildId) {
  return getDb().prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId)
}

function getAllGuilds () {
  return getDb().prepare('SELECT * FROM guilds WHERE active = 1').all()
}

function setGuildInactive (guildId) {
  getDb().prepare('UPDATE guilds SET active = 0 WHERE guild_id = ?').run(guildId)
}

function deleteGuildData (guildId) {
  const tables = [
    'activity_stats','audit_log','automod_rules','bansync_guilds',
    'cases','custom_commands','giveaways','guild_config','highlights',
    'level_roles','reputation','role_panels','scheduled_messages',
    'suggestions','temp_punishments','temp_roles','temp_voice',
    'tickets','users','warnings'
  ]
  getDb().transaction(() => {
    for (const t of tables) getDb().prepare(`DELETE FROM ${t} WHERE guild_id = ?`).run(guildId)
    getDb().prepare('DELETE FROM guilds WHERE guild_id = ?').run(guildId)
  })()
}

// ══════════════════════════════════════════════════════════════════
// GUILD CONFIG
// ══════════════════════════════════════════════════════════════════

function createGuildConfig (guildId) {
  getDb().prepare('INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)').run(guildId)
}

function getGuildConfig (guildId) {
  return getDb().prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId)
}

const VALID_CONFIG_COLUMNS = [
  'mod_roles', 'admin_roles', 'mute_role', 'verify_role',
  'log_channel', 'mod_channel', 'welcome_channel', 'goodbye_channel',
  'suggestions_channel', 'starboard_channel', 'updates_channel_id',
  'log_routes', 'log_ignore_roles', 'log_ignore_channels',
  'welcome_style', 'welcome_message', 'welcome_color', 'welcome_bg_url',
  'welcome_dm', 'welcome_dm_message', 'welcome_autorole',
  'welcome_show_avatar', 'goodbye_message',
  'warn_threshold', 'warn_decay_days', 'dm_on_action', 'appeal_channel', 'case_channel',
  'xp_min', 'xp_max', 'xp_cooldown', 'levelup_channel', 'levelup_message',
  'xp_blacklist', 'xp_multipliers',
  'star_threshold', 'star_emoji',
  'ticket_category', 'ticket_support_role', 'ticket_auto_close',
  'webhook_id', 'webhook_url',
  'modules', 'setup_complete', 'api_enabled', 'api_key'
]

function updateGuildConfig (guildId, fields) {
  const keys = Object.keys(fields).filter(k => VALID_CONFIG_COLUMNS.includes(k))
  if (!keys.length) return
  const set = keys.map(k => `${k} = ?`).join(', ')
  const values = keys.map(k => fields[k])
  getDb().prepare(`UPDATE guild_config SET ${set} WHERE guild_id = ?`)
    .run(...values, guildId)
}

function getAllWebhooks () {
  return getDb().prepare(`SELECT guild_id, webhook_url, webhook_id FROM guild_config WHERE webhook_url IS NOT NULL`).all()
}

function clearWebhook (guildId) {
  getDb().prepare('UPDATE guild_config SET webhook_url = NULL, webhook_id = NULL WHERE guild_id = ?').run(guildId)
}

// ══════════════════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════════════════

function upsertUser (userId, guildId) {
  getDb().prepare('INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?,?)').run(userId, guildId)
}

function getUser (userId, guildId) {
  return getDb().prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId)
}

function updateUser (userId, guildId, fields) {
  const keys = Object.keys(fields)
  if (!keys.length) return
  const set = keys.map(k => `${k} = ?`).join(', ')
  getDb().prepare(`UPDATE users SET ${set} WHERE user_id = ? AND guild_id = ?`)
    .run(...Object.values(fields), userId, guildId)
}

function getLeaderboard (guildId, type = 'xp', limit = 10, offset = 0) {
  const col = type === 'voice' ? 'voice_minutes' : 'xp'
  return getDb().prepare(`SELECT * FROM users WHERE guild_id = ? ORDER BY ${col} DESC LIMIT ? OFFSET ?`)
    .all(guildId, limit, offset)
}

function getUserRank (userId, guildId) {
  return getDb().prepare(`
    SELECT COUNT(*)+1 AS rank FROM users
    WHERE guild_id = ? AND xp > (SELECT xp FROM users WHERE user_id = ? AND guild_id = ?)
  `).get(guildId, userId, guildId)
}

function addXp (userId, guildId, amount) {
  upsertUser(userId, guildId)
  getDb().prepare(`
    UPDATE users SET xp = xp+?, messages = messages+1, last_xp = ?, last_active = ?
    WHERE user_id = ? AND guild_id = ?
  `).run(amount, now(), now(), userId, guildId)
  return getUser(userId, guildId)
}

function setXp (userId, guildId, amount) {
  upsertUser(userId, guildId)
  getDb().prepare('UPDATE users SET xp = ?, level = 0 WHERE user_id = ? AND guild_id = ?')
    .run(amount, userId, guildId)
}

function setLevel (userId, guildId, level) {
  getDb().prepare('UPDATE users SET level = ? WHERE user_id = ? AND guild_id = ?').run(level, userId, guildId)
}

function resetUserXp (userId, guildId) {
  getDb().prepare('UPDATE users SET xp = 0, level = 0 WHERE user_id = ? AND guild_id = ?').run(userId, guildId)
}

function addVoiceMinutes (userId, guildId, minutes) {
  upsertUser(userId, guildId)
  getDb().prepare('UPDATE users SET voice_minutes = voice_minutes+? WHERE user_id = ? AND guild_id = ?')
    .run(minutes, userId, guildId)
}

function getTodayBirthdays (month, day) {
  const key = `${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  return getDb().prepare('SELECT user_id, guild_id FROM users WHERE birthday = ?').all(key)
}

// ══════════════════════════════════════════════════════════════════
// CASES
// ══════════════════════════════════════════════════════════════════

function createCase (guildId, userId, modId, type, reason, expiresAt = null) {
  return getDb().prepare(`
    INSERT INTO cases (guild_id, user_id, mod_id, type, reason, expires_at, created_at)
    VALUES (?,?,?,?,?,?,?)
  `).run(guildId, userId, modId, type, reason, expiresAt, now()).lastInsertRowid
}

function getCase (caseId, guildId) {
  return getDb().prepare('SELECT * FROM cases WHERE case_id = ? AND guild_id = ?').get(caseId, guildId)
}

function getCases (guildId, userId, limit = 10, offset = 0) {
  return getDb().prepare(`
    SELECT * FROM cases WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(guildId, userId, limit, offset)
}

function getCaseCount (guildId, userId) {
  return getDb().prepare('SELECT COUNT(*) AS count FROM cases WHERE guild_id = ? AND user_id = ?').get(guildId, userId)
}

function updateCaseReason (caseId, guildId, reason) {
  getDb().prepare('UPDATE cases SET reason = ? WHERE case_id = ? AND guild_id = ?').run(reason, caseId, guildId)
}

function deactivateCase (caseId, guildId) {
  getDb().prepare('UPDATE cases SET active = 0 WHERE case_id = ? AND guild_id = ?').run(caseId, guildId)
}

function getModStats (guildId, modId, since = 0) {
  return getDb().prepare(`
    SELECT type, COUNT(*) AS count FROM cases
    WHERE guild_id = ? AND mod_id = ? AND created_at >= ? GROUP BY type
  `).all(guildId, modId, since)
}

// ══════════════════════════════════════════════════════════════════
// WARNINGS
// ══════════════════════════════════════════════════════════════════

function createWarning (guildId, userId, modId, reason, points = 1, caseId = null) {
  return getDb().prepare(`
    INSERT INTO warnings (guild_id, user_id, mod_id, reason, points, case_id, created_at)
    VALUES (?,?,?,?,?,?,?)
  `).run(guildId, userId, modId, reason, points, caseId, now()).lastInsertRowid
}

function getWarnings (guildId, userId, includeExpired = false, decayDays = 30) {
  if (includeExpired) {
    return getDb().prepare(`
      SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? AND pardoned = 0 ORDER BY created_at DESC
    `).all(guildId, userId)
  }
  const cutoff = now() - (decayDays * 86400)
  return getDb().prepare(`
    SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? AND pardoned = 0 AND created_at >= ?
    ORDER BY created_at DESC
  `).all(guildId, userId, cutoff)
}

function getActiveWarnPoints (guildId, userId, decayDays = 30) {
  const cutoff = now() - (decayDays * 86400)
  return getDb().prepare(`
    SELECT COALESCE(SUM(points),0) AS total FROM warnings
    WHERE guild_id = ? AND user_id = ? AND pardoned = 0 AND created_at >= ?
  `).get(guildId, userId, cutoff).total
}

function pardonWarning (warnId, guildId) {
  getDb().prepare('UPDATE warnings SET pardoned = 1 WHERE warn_id = ? AND guild_id = ?').run(warnId, guildId)
}

// ══════════════════════════════════════════════════════════════════
// TEMP PUNISHMENTS
// ══════════════════════════════════════════════════════════════════

function createTempPunishment (guildId, userId, type, expiresAt, caseId = null) {
  getDb().prepare(`
    INSERT INTO temp_punishments (guild_id, user_id, type, expires_at, case_id) VALUES (?,?,?,?,?)
  `).run(guildId, userId, type, expiresAt, caseId)
}

function getActiveTempPunishment (guildId, userId, type) {
  return getDb().prepare(`
    SELECT * FROM temp_punishments WHERE guild_id = ? AND user_id = ? AND type = ? AND active = 1
  `).get(guildId, userId, type)
}

function getExpiredTempPunishments () {
  return getDb().prepare('SELECT * FROM temp_punishments WHERE active = 1 AND expires_at <= ?').all(now())
}

function deactivateTempPunishment (id) {
  getDb().prepare('UPDATE temp_punishments SET active = 0 WHERE id = ?').run(id)
}

function clearTempPunishment (guildId, userId, type) {
  getDb().prepare(`
    UPDATE temp_punishments SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = ? AND active = 1
  `).run(guildId, userId, type)
}

// ══════════════════════════════════════════════════════════════════
// TICKETS
// ══════════════════════════════════════════════════════════════════

function createTicket (guildId, userId, channelId, category = null) {
  return getDb().prepare(`
    INSERT INTO tickets (guild_id, user_id, channel_id, category, created_at) VALUES (?,?,?,?,?)
  `).run(guildId, userId, channelId, category, now()).lastInsertRowid
}

function getTicket (ticketId) {
  return getDb().prepare('SELECT * FROM tickets WHERE ticket_id = ?').get(ticketId)
}

function getTicketByChannel (channelId) {
  return getDb().prepare("SELECT * FROM tickets WHERE channel_id = ? AND status != 'closed'").get(channelId)
}

function getOpenTickets (guildId) {
  return getDb().prepare("SELECT * FROM tickets WHERE guild_id = ? AND status != 'closed'").all(guildId)
}

function getStaleTickets (guildId, olderThanHours) {
  const cutoff = now() - (olderThanHours * 3600)
  return getDb().prepare("SELECT * FROM tickets WHERE guild_id = ? AND status = 'open' AND created_at < ?")
    .all(guildId, cutoff)
}

function updateTicket (ticketId, fields) {
  const keys = Object.keys(fields)
  if (!keys.length) return
  const set = keys.map(k => `${k} = ?`).join(', ')
  getDb().prepare(`UPDATE tickets SET ${set} WHERE ticket_id = ?`).run(...Object.values(fields), ticketId)
}

function getTicketStats (guildId) {
  return getDb().prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='open'    THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status='closed'  THEN 1 ELSE 0 END) AS closed,
      SUM(CASE WHEN status='claimed' THEN 1 ELSE 0 END) AS claimed
    FROM tickets WHERE guild_id = ?
  `).get(guildId)
}

// ══════════════════════════════════════════════════════════════════
// ROLE PANELS
// ══════════════════════════════════════════════════════════════════

function createRolePanel (guildId, title, style = 'button') {
  return getDb().prepare(`
    INSERT INTO role_panels (guild_id, title, style, created_at) VALUES (?,?,?,?)
  `).run(guildId, title, style, now()).lastInsertRowid
}

function getRolePanel (panelId, guildId) {
  return getDb().prepare('SELECT * FROM role_panels WHERE panel_id = ? AND guild_id = ?').get(panelId, guildId)
}

function getRolePanels (guildId) {
  return getDb().prepare('SELECT * FROM role_panels WHERE guild_id = ?').all(guildId)
}

function updateRolePanel (panelId, guildId, fields) {
  const keys = Object.keys(fields)
  if (!keys.length) return
  const set = keys.map(k => `${k} = ?`).join(', ')
  getDb().prepare(`UPDATE role_panels SET ${set} WHERE panel_id = ? AND guild_id = ?`)
    .run(...Object.values(fields), panelId, guildId)
}

function deleteRolePanel (panelId, guildId) {
  getDb().prepare('DELETE FROM role_panels WHERE panel_id = ? AND guild_id = ?').run(panelId, guildId)
}

// ══════════════════════════════════════════════════════════════════
// AUTOMOD RULES
// ══════════════════════════════════════════════════════════════════

function getAutomodRules (guildId) {
  return getDb().prepare('SELECT * FROM automod_rules WHERE guild_id = ? AND enabled = 1').all(guildId)
}

function getAllAutomodRules (guildId) {
  return getDb().prepare('SELECT * FROM automod_rules WHERE guild_id = ?').all(guildId)
}

function createAutomodRule (guildId, triggerType, threshold, windowSecs, action, duration, ignoreRoles, ignoreChannels, wordList) {
  return getDb().prepare(`
    INSERT INTO automod_rules
      (guild_id, trigger_type, threshold, window_secs, action, duration, ignore_roles, ignore_channels, word_list, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    guildId, triggerType, threshold, windowSecs, action, duration,
    JSON.stringify(ignoreRoles || []), JSON.stringify(ignoreChannels || []),
    JSON.stringify(wordList || []), now()
  ).lastInsertRowid
}

function updateAutomodRule (ruleId, guildId, fields) {
  const keys = Object.keys(fields)
  if (!keys.length) return
  const set = keys.map(k => `${k} = ?`).join(', ')
  getDb().prepare(`UPDATE automod_rules SET ${set} WHERE id = ? AND guild_id = ?`)
    .run(...Object.values(fields), ruleId, guildId)
}

function toggleAutomodRule (ruleId, guildId) {
  getDb().prepare(`
    UPDATE automod_rules SET enabled = CASE WHEN enabled=1 THEN 0 ELSE 1 END WHERE id = ? AND guild_id = ?
  `).run(ruleId, guildId)
}

function deleteAutomodRule (ruleId, guildId) {
  getDb().prepare('DELETE FROM automod_rules WHERE id = ? AND guild_id = ?').run(ruleId, guildId)
}

// ══════════════════════════════════════════════════════════════════
// CUSTOM COMMANDS / TAGS
// ══════════════════════════════════════════════════════════════════

function createTag (guildId, trigger, response, permLevel, regex, channelScope) {
  return getDb().prepare(`
    INSERT INTO custom_commands (guild_id, trigger, response, type, perm_level, regex, channel_scope, created_at)
    VALUES (?,?,?,'tag',?,?,?,?)
  `).run(guildId, trigger, response, permLevel, regex ? 1 : 0, JSON.stringify(channelScope || []), now()).lastInsertRowid
}

function getTag (guildId, trigger) {
  return getDb().prepare('SELECT * FROM custom_commands WHERE guild_id = ? AND trigger = ?').get(guildId, trigger)
}

function getTags (guildId, limit = 20, offset = 0) {
  return getDb().prepare(`
    SELECT * FROM custom_commands WHERE guild_id = ? ORDER BY trigger ASC LIMIT ? OFFSET ?
  `).all(guildId, limit, offset)
}

function updateTag (id, guildId, fields) {
  const keys = Object.keys(fields)
  if (!keys.length) return
  const set = keys.map(k => `${k} = ?`).join(', ')
  getDb().prepare(`UPDATE custom_commands SET ${set} WHERE id = ? AND guild_id = ?`)
    .run(...Object.values(fields), id, guildId)
}

function deleteTag (guildId, trigger) {
  getDb().prepare('DELETE FROM custom_commands WHERE guild_id = ? AND trigger = ?').run(guildId, trigger)
}

function incrementTagUses (id) {
  getDb().prepare('UPDATE custom_commands SET uses = uses+1 WHERE id = ?').run(id)
}

// ══════════════════════════════════════════════════════════════════
// SCHEDULED MESSAGES
// ══════════════════════════════════════════════════════════════════

function createScheduledMessage (guildId, channelId, content, embed, cron) {
  return getDb().prepare(`
    INSERT INTO scheduled_messages (guild_id, channel_id, content, embed, cron, created_at)
    VALUES (?,?,?,?,?,?)
  `).run(guildId, channelId, content, embed ? JSON.stringify(embed) : null, cron, now()).lastInsertRowid
}

function getScheduledMessages (guildId) {
  return getDb().prepare('SELECT * FROM scheduled_messages WHERE guild_id = ? AND enabled = 1').all(guildId)
}

function getAllScheduledMessages () {
  return getDb().prepare('SELECT * FROM scheduled_messages WHERE enabled = 1').all()
}

function updateScheduledMessage (id, guildId, fields) {
  const keys = Object.keys(fields)
  if (!keys.length) return
  const set = keys.map(k => `${k} = ?`).join(', ')
  getDb().prepare(`UPDATE scheduled_messages SET ${set} WHERE id = ? AND guild_id = ?`)
    .run(...Object.values(fields), id, guildId)
}

function deleteScheduledMessage (id, guildId) {
  getDb().prepare('DELETE FROM scheduled_messages WHERE id = ? AND guild_id = ?').run(id, guildId)
}

function updateScheduledLastRun (id) {
  getDb().prepare('UPDATE scheduled_messages SET last_run = ? WHERE id = ?').run(now(), id)
}

// ══════════════════════════════════════════════════════════════════
// LEVEL ROLES
// ══════════════════════════════════════════════════════════════════

function setLevelRole (guildId, level, roleId) {
  getDb().prepare('INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?,?,?)').run(guildId, level, roleId)
}

function getLevelRoles (guildId) {
  return getDb().prepare('SELECT * FROM level_roles WHERE guild_id = ? ORDER BY level ASC').all(guildId)
}

function deleteLevelRole (guildId, level) {
  getDb().prepare('DELETE FROM level_roles WHERE guild_id = ? AND level = ?').run(guildId, level)
}

// ══════════════════════════════════════════════════════════════════
// AUDIT LOG
// ══════════════════════════════════════════════════════════════════

function writeAuditLog (guildId, executorId, action, targetId, details = null) {
  getDb().prepare(`
    INSERT INTO audit_log (guild_id, executor_id, action, target_id, details, created_at) VALUES (?,?,?,?,?,?)
  `).run(guildId, executorId, action, targetId, details ? JSON.stringify(details) : null, now())
}

function getAuditLog (guildId, limit = 20, offset = 0) {
  return getDb().prepare(`
    SELECT * FROM audit_log WHERE guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(guildId, limit, offset)
}

// ══════════════════════════════════════════════════════════════════
// EVAL LOG
// ══════════════════════════════════════════════════════════════════

function writeEvalLog (executorId, input, output) {
  getDb().prepare('INSERT INTO eval_log (executor_id, input, output, created_at) VALUES (?,?,?,?)')
    .run(executorId, input, output, now())
}

// ══════════════════════════════════════════════════════════════════
// BLACKLISTS
// ══════════════════════════════════════════════════════════════════

function blacklistGuild (guildId, reason) {
  getDb().prepare('INSERT OR REPLACE INTO blacklist_guilds (guild_id, reason, added_at) VALUES (?,?,?)')
    .run(guildId, reason, now())
}

function unblacklistGuild (guildId) {
  getDb().prepare('DELETE FROM blacklist_guilds WHERE guild_id = ?').run(guildId)
}

function isGuildBlacklisted (guildId) {
  return !!getDb().prepare('SELECT 1 FROM blacklist_guilds WHERE guild_id = ?').get(guildId)
}

function blacklistUser (userId, reason) {
  getDb().prepare('INSERT OR REPLACE INTO blacklist_users (user_id, reason, added_at) VALUES (?,?,?)')
    .run(userId, reason, now())
}

function unblacklistUser (userId) {
  getDb().prepare('DELETE FROM blacklist_users WHERE user_id = ?').run(userId)
}

function isUserBlacklisted (userId) {
  return !!getDb().prepare('SELECT 1 FROM blacklist_users WHERE user_id = ?').get(userId)
}

function getBlacklistedGuilds () {
  return getDb().prepare('SELECT * FROM blacklist_guilds ORDER BY added_at DESC').all()
}

function getBlacklistedUsers () {
  return getDb().prepare('SELECT * FROM blacklist_users ORDER BY added_at DESC').all()
}

// ══════════════════════════════════════════════════════════════════
// BROADCAST LOG
// ══════════════════════════════════════════════════════════════════

function insertBroadcastLog (title, type, content, sentCount, failCount, skipCount) {
  getDb().prepare(`
    INSERT INTO broadcast_log (title, type, content, sent_count, fail_count, skip_count, created_at)
    VALUES (?,?,?,?,?,?,?)
  `).run(title, type, content, sentCount, failCount, skipCount, now())
}

// ══════════════════════════════════════════════════════════════════
// BOT STATS
// ══════════════════════════════════════════════════════════════════

function incrementBotStat (field) {
  const date = new Date().toISOString().slice(0, 10)
  getDb().prepare(`
    INSERT INTO bot_stats (date, ${field}) VALUES (?,1)
    ON CONFLICT(date) DO UPDATE SET ${field} = ${field}+1
  `).run(date)
}

function getBotStats (days = 7) {
  return getDb().prepare('SELECT * FROM bot_stats ORDER BY date DESC LIMIT ?').all(days)
}

// ══════════════════════════════════════════════════════════════════
// ACTIVITY STATS
// ══════════════════════════════════════════════════════════════════

function incrementActivityStat (guildId, field, amount = 1) {
  const date = new Date().toISOString().slice(0, 10)
  getDb().prepare(`
    INSERT INTO activity_stats (guild_id, date, ${field}) VALUES (?,?,?)
    ON CONFLICT(guild_id, date) DO UPDATE SET ${field} = ${field}+?
  `).run(guildId, date, amount, amount)
}

function getActivityStats (guildId, days = 7) {
  return getDb().prepare('SELECT * FROM activity_stats WHERE guild_id = ? ORDER BY date DESC LIMIT ?').all(guildId, days)
}

// ══════════════════════════════════════════════════════════════════
// BANSYNC
// ══════════════════════════════════════════════════════════════════

function addBansyncGuild (guildId, trustedGuildId) {
  getDb().prepare('INSERT OR IGNORE INTO bansync_guilds (guild_id, trusted_guild_id, added_at) VALUES (?,?,?)')
    .run(guildId, trustedGuildId, now())
}

function removeBansyncGuild (guildId, trustedGuildId) {
  getDb().prepare('DELETE FROM bansync_guilds WHERE guild_id = ? AND trusted_guild_id = ?').run(guildId, trustedGuildId)
}

function getBansyncGuilds (guildId) {
  return getDb().prepare('SELECT * FROM bansync_guilds WHERE guild_id = ?').all(guildId)
}

function getBansyncSubscribers (trustedGuildId) {
  return getDb().prepare('SELECT * FROM bansync_guilds WHERE trusted_guild_id = ?').all(trustedGuildId)
}

// ══════════════════════════════════════════════════════════════════
// REPUTATION
// ══════════════════════════════════════════════════════════════════

function giveRep (guildId, giverId, receiverId) {
  getDb().prepare('INSERT INTO reputation (guild_id, giver_id, receiver_id, created_at) VALUES (?,?,?,?)')
    .run(guildId, giverId, receiverId, now())
  getDb().prepare('UPDATE users SET rep = rep+1, last_rep = ? WHERE user_id = ? AND guild_id = ?')
    .run(now(), giverId, guildId)
}

function getRepLeaderboard (guildId, limit = 10) {
  return getDb().prepare('SELECT user_id, rep FROM users WHERE guild_id = ? ORDER BY rep DESC LIMIT ?').all(guildId, limit)
}

// ══════════════════════════════════════════════════════════════════
// HIGHLIGHTS
// ══════════════════════════════════════════════════════════════════

function addHighlight (guildId, userId, word) {
  getDb().prepare('INSERT OR IGNORE INTO highlights (guild_id, user_id, word, created_at) VALUES (?,?,?,?)')
    .run(guildId, userId, word.toLowerCase(), now())
}

function removeHighlight (guildId, userId, word) {
  getDb().prepare('DELETE FROM highlights WHERE guild_id = ? AND user_id = ? AND word = ?')
    .run(guildId, userId, word.toLowerCase())
}

function getHighlights (guildId) {
  return getDb().prepare('SELECT * FROM highlights WHERE guild_id = ?').all(guildId)
}

function getUserHighlights (guildId, userId) {
  return getDb().prepare('SELECT * FROM highlights WHERE guild_id = ? AND user_id = ?').all(guildId, userId)
}

// ══════════════════════════════════════════════════════════════════
// GIVEAWAYS
// ══════════════════════════════════════════════════════════════════

function createGiveaway (guildId, channelId, prize, winners, endsAt, requiredRole, bonusRole, bonusEntries, createdBy) {
  return getDb().prepare(`
    INSERT INTO giveaways (guild_id, channel_id, prize, winners, ends_at, required_role, bonus_role, bonus_entries, created_by)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(guildId, channelId, prize, winners, endsAt, requiredRole, bonusRole, bonusEntries, createdBy).lastInsertRowid
}

function getGiveaway (id) {
  return getDb().prepare('SELECT * FROM giveaways WHERE id = ?').get(id)
}

function getGiveawayByMessage (messageId) {
  return getDb().prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId)
}

function updateGiveaway (id, fields) {
  const keys = Object.keys(fields)
  if (!keys.length) return
  const set = keys.map(k => `${k} = ?`).join(', ')
  getDb().prepare(`UPDATE giveaways SET ${set} WHERE id = ?`).run(...Object.values(fields), id)
}

function getActiveGiveaways () {
  return getDb().prepare('SELECT * FROM giveaways WHERE ended = 0').all()
}

// ══════════════════════════════════════════════════════════════════
// SUGGESTIONS
// ══════════════════════════════════════════════════════════════════

function createSuggestion (guildId, userId, content) {
  return getDb().prepare(`
    INSERT INTO suggestions (guild_id, user_id, content, created_at) VALUES (?,?,?,?)
  `).run(guildId, userId, content, now()).lastInsertRowid
}

function getSuggestion (id, guildId) {
  return getDb().prepare('SELECT * FROM suggestions WHERE id = ? AND guild_id = ?').get(id, guildId)
}

function updateSuggestion (id, guildId, fields) {
  const keys = Object.keys(fields)
  if (!keys.length) return
  const set = keys.map(k => `${k} = ?`).join(', ')
  getDb().prepare(`UPDATE suggestions SET ${set} WHERE id = ? AND guild_id = ?`)
    .run(...Object.values(fields), id, guildId)
}

// ══════════════════════════════════════════════════════════════════
// TEMP ROLES
// ══════════════════════════════════════════════════════════════════

function createTempRole (guildId, userId, roleId, expiresAt) {
  getDb().prepare('INSERT INTO temp_roles (guild_id, user_id, role_id, expires_at) VALUES (?,?,?,?)')
    .run(guildId, userId, roleId, expiresAt)
}

function getExpiredTempRoles () {
  return getDb().prepare('SELECT * FROM temp_roles WHERE active = 1 AND expires_at <= ?').all(now())
}

function deactivateTempRole (id) {
  getDb().prepare('UPDATE temp_roles SET active = 0 WHERE id = ?').run(id)
}

// ══════════════════════════════════════════════════════════════════
// TEMP VOICE
// ══════════════════════════════════════════════════════════════════

function createTempVoice (guildId, channelId, ownerId) {
  getDb().prepare('INSERT INTO temp_voice (guild_id, channel_id, owner_id, created_at) VALUES (?,?,?,?)')
    .run(guildId, channelId, ownerId, now())
}

function getTempVoice (channelId) {
  return getDb().prepare('SELECT * FROM temp_voice WHERE channel_id = ?').get(channelId)
}

function deleteTempVoice (channelId) {
  getDb().prepare('DELETE FROM temp_voice WHERE channel_id = ?').run(channelId)
}

function getTempVoiceByOwner (guildId, ownerId) {
  return getDb().prepare('SELECT * FROM temp_voice WHERE guild_id = ? AND owner_id = ?').get(guildId, ownerId)
}

// ══════════════════════════════════════════════════════════════════
// MOD NOTES
// ══════════════════════════════════════════════════════════════════

function createNote (guildId, userId, modId, note) {
  return getDb().prepare(`
    INSERT INTO mod_notes (guild_id, user_id, mod_id, note, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(guildId, userId, modId, note, Math.floor(Date.now() / 1000)).lastInsertRowid
}

function getNotes (guildId, userId) {
  return getDb().prepare(`
    SELECT * FROM mod_notes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC
  `).all(guildId, userId)
}

function deleteNote (noteId, guildId) {
  return getDb().prepare('DELETE FROM mod_notes WHERE id = ? AND guild_id = ?').run(noteId, guildId)
}

// ══════════════════════════════════════════════════════════════════
// EMBED TEMPLATES
// ══════════════════════════════════════════════════════════════════

function createEmbedTemplate (guildId, name, data, createdBy) {
  return getDb().prepare(`
    INSERT INTO embed_templates (guild_id, name, title, description, color, footer, image, thumbnail, author_name, author_icon, fields, created_by, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    guildId, name,
    data.title || null, data.description || null, data.color || null,
    data.footer || null, data.image || null, data.thumbnail || null,
    data.author_name || null, data.author_icon || null,
    JSON.stringify(data.fields || []),
    createdBy, Math.floor(Date.now() / 1000)
  ).lastInsertRowid
}

function getEmbedTemplate (guildId, name) {
  return getDb().prepare('SELECT * FROM embed_templates WHERE guild_id = ? AND name = ?').get(guildId, name)
}

function getEmbedTemplates (guildId) {
  return getDb().prepare('SELECT * FROM embed_templates WHERE guild_id = ? ORDER BY name ASC').all(guildId)
}

function deleteEmbedTemplate (guildId, name) {
  return getDb().prepare('DELETE FROM embed_templates WHERE guild_id = ? AND name = ?').run(guildId, name)
}

// ══════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════

module.exports = {
  init, getDb,
  // guilds
  createGuild, getGuild, getAllGuilds, setGuildInactive, deleteGuildData,
  // guild config
  createGuildConfig, getGuildConfig, updateGuildConfig, getAllWebhooks, clearWebhook,
  // users
  upsertUser, getUser, updateUser, getLeaderboard, getUserRank,
  addXp, setXp, setLevel, resetUserXp, addVoiceMinutes, getTodayBirthdays,
  // cases
  createCase, getCase, getCases, getCaseCount, updateCaseReason, deactivateCase, getModStats,
  // warnings
  createWarning, getWarnings, getActiveWarnPoints, pardonWarning,
  // temp punishments
  createTempPunishment, getActiveTempPunishment, getExpiredTempPunishments,
  deactivateTempPunishment, clearTempPunishment,
  // tickets
  createTicket, getTicket, getTicketByChannel, getOpenTickets, getStaleTickets,
  updateTicket, getTicketStats,
  // role panels
  createRolePanel, getRolePanel, getRolePanels, updateRolePanel, deleteRolePanel,
  // automod
  getAutomodRules, getAllAutomodRules, createAutomodRule, updateAutomodRule,
  toggleAutomodRule, deleteAutomodRule,
  // tags
  createTag, getTag, getTags, updateTag, deleteTag, incrementTagUses,
  // scheduler
  createScheduledMessage, getScheduledMessages, getAllScheduledMessages,
  updateScheduledMessage, deleteScheduledMessage, updateScheduledLastRun,
  // level roles
  setLevelRole, getLevelRoles, deleteLevelRole,
  // audit log
  writeAuditLog, getAuditLog,
  // eval log
  writeEvalLog,
  // blacklists
  blacklistGuild, unblacklistGuild, isGuildBlacklisted,
  blacklistUser, unblacklistUser, isUserBlacklisted,
  getBlacklistedGuilds, getBlacklistedUsers,
  // broadcast
  insertBroadcastLog,
  // stats
  incrementBotStat, getBotStats, incrementActivityStat, getActivityStats,
  // bansync
  addBansyncGuild, removeBansyncGuild, getBansyncGuilds, getBansyncSubscribers,
  // reputation
  giveRep, getRepLeaderboard,
  // highlights
  addHighlight, removeHighlight, getHighlights, getUserHighlights,
  // giveaways
  createGiveaway, getGiveaway, getGiveawayByMessage, updateGiveaway, getActiveGiveaways,
  // suggestions
  createSuggestion, getSuggestion, updateSuggestion,
  // temp roles
  createTempRole, getExpiredTempRoles, deactivateTempRole,
  // temp voice
  createTempVoice, getTempVoice, deleteTempVoice, getTempVoiceByOwner,
  // mod notes
  createNote, getNotes, deleteNote,
  // embed templates
  createEmbedTemplate, getEmbedTemplate, getEmbedTemplates, deleteEmbedTemplate
}
