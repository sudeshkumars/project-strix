'use strict'

const fs   = require('fs')
const path = require('path')

const TRANSCRIPT_DIR = path.join(__dirname, '../data/transcripts')

/**
 * Fetch messages from a channel and generate an HTML transcript.
 * Saves to data/transcripts/<ticketId>.html and returns the file path.
 *
 * @param {import('discord.js').TextChannel} channel
 * @param {number} ticketId
 * @param {object} meta  — { openedBy, guildName, category, closedBy }
 * @returns {Promise<string>} file path
 */
async function generateHtmlTranscript (channel, ticketId, meta = {}) {
  fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true })

  // Fetch up to 500 messages
  const allMessages = []
  let lastId

  while (true) {
    const options = { limit: 100 }
    if (lastId) options.before = lastId

    const batch = await channel.messages.fetch(options)
    if (!batch.size) break

    allMessages.push(...batch.values())
    lastId = batch.last()?.id
    if (batch.size < 100) break
  }

  allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)

  const html = buildHtml(allMessages, ticketId, meta, channel)
  const filePath = path.join(TRANSCRIPT_DIR, `ticket-${ticketId}.html`)
  fs.writeFileSync(filePath, html, 'utf8')

  return filePath
}

function buildHtml (messages, ticketId, meta, channel) {
  const { openedBy = 'Unknown', guildName = 'Unknown', category = 'General', closedBy = 'Unknown' } = meta
  const now = new Date().toUTCString()
  const msgCount = messages.length

  const messageRows = messages.map(m => {
    const time    = new Date(m.createdTimestamp).toUTCString()
    const content = escapeHtml(m.content || '')
    const embeds  = m.embeds.map(e => `
      <div class="embed" style="border-left:4px solid #${e.color?.toString(16).padStart(6,'0') ?? '5865F2'}">
        ${e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : ''}
        ${e.description ? `<div class="embed-desc">${escapeHtml(e.description)}</div>` : ''}
      </div>
    `).join('')

    const attachments = [...m.attachments.values()].map(a =>
      a.contentType?.startsWith('image/')
        ? `<img src="${a.url}" class="attachment" alt="attachment">`
        : `<a href="${a.url}" class="attachment-link">${escapeHtml(a.name)}</a>`
    ).join('')

    const avatarUrl = m.author.displayAvatarURL({ extension: 'png', size: 64 })
    const isBot     = m.author.bot

    return `
    <div class="message${isBot ? ' bot' : ''}">
      <img src="${avatarUrl}" class="avatar" onerror="this.style.display='none'">
      <div class="msg-body">
        <div class="msg-header">
          <span class="username${isBot ? ' bot-tag' : ''}">${escapeHtml(m.author.tag)}</span>
          ${isBot ? '<span class="badge">BOT</span>' : ''}
          <span class="timestamp">${time}</span>
        </div>
        ${content ? `<div class="msg-content">${content}</div>` : ''}
        ${embeds}
        ${attachments}
      </div>
    </div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ticket #${ticketId} Transcript</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #313338; color: #dbdee1; font-family: 'gg sans', sans-serif; font-size: 14px; }
  .header { background: #1e1f22; padding: 20px 32px; border-bottom: 2px solid #5865F2; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { color: #fff; font-size: 20px; }
  .meta { display: flex; gap: 20px; flex-wrap: wrap; padding: 12px 32px; background: #2b2d31; border-bottom: 1px solid #404249; font-size: 13px; color: #b5bac1; }
  .meta span b { color: #dbdee1; }
  .messages { padding: 16px 32px; display: flex; flex-direction: column; gap: 4px; }
  .message { display: flex; gap: 12px; padding: 4px 8px; border-radius: 4px; }
  .message:hover { background: #2e3035; }
  .message.bot { opacity: 0.85; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
  .msg-body { flex: 1; min-width: 0; }
  .msg-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
  .username { color: #fff; font-weight: 600; font-size: 15px; }
  .username.bot-tag { color: #5865F2; }
  .badge { background: #5865F2; color: #fff; font-size: 10px; padding: 1px 5px; border-radius: 3px; font-weight: 700; letter-spacing: .4px; }
  .timestamp { color: #87898c; font-size: 12px; }
  .msg-content { color: #dbdee1; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .embed { background: #2b2d31; border-radius: 4px; padding: 10px 14px; margin-top: 6px; max-width: 520px; }
  .embed-title { color: #fff; font-weight: 600; margin-bottom: 4px; }
  .embed-desc { color: #dbdee1; font-size: 13px; white-space: pre-wrap; }
  .attachment { max-width: 400px; max-height: 300px; border-radius: 4px; margin-top: 6px; display: block; }
  .attachment-link { color: #00aff4; text-decoration: none; display: block; margin-top: 4px; }
  .attachment-link:hover { text-decoration: underline; }
  .footer { text-align: center; padding: 20px; color: #87898c; font-size: 12px; border-top: 1px solid #404249; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>🎫 Ticket #${ticketId} — ${escapeHtml(guildName)}</h1>
    <div style="color:#87898c;font-size:13px;margin-top:4px">Generated by Stryx</div>
  </div>
  <div style="color:#87898c;font-size:13px">${msgCount} messages</div>
</div>

<div class="meta">
  <span>📁 <b>Category:</b> ${escapeHtml(category)}</span>
  <span>👤 <b>Opened by:</b> ${escapeHtml(openedBy)}</span>
  <span>🔒 <b>Closed by:</b> ${escapeHtml(closedBy)}</span>
  <span>📅 <b>Generated:</b> ${now}</span>
  <span>#️⃣ <b>Channel:</b> ${escapeHtml(channel.name)}</span>
</div>

<div class="messages">
${messageRows}
</div>

<div class="footer">Stryx Ticket Transcript • Ticket #${ticketId} • ${now}</div>
</body>
</html>`
}

function escapeHtml (str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

module.exports = { generateHtmlTranscript }
