'use strict'

const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js')
const db            = require('../../../shared/db')
const { error, info } = require('../../../shared/embed')
const { calcLevel } = require('../../../shared/utils')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your rank card')
    .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply()

    const target  = interaction.options.getUser('user') ?? interaction.user
    const guildId = interaction.guild.id

    const row = db.getUser(target.id, guildId)
    if (!row || row.xp === 0) {
      return interaction.editReply({ embeds: [error('No data', `${target.tag} has no XP yet.`)] })
    }

    const { level, currentXp, neededXp } = calcLevel(row.xp)
    const rank = db.getUserRank(target.id, guildId)
    const pct  = neededXp > 0 ? Math.min(currentXp / neededXp, 1) : 0

    try {
      const { createCanvas, loadImage } = require('canvas')
      const buffer = await renderRankCard(createCanvas, loadImage, {
        tag:       target.tag,
        avatarURL: target.displayAvatarURL({ extension: 'png', size: 256 }),
        level, rank: rank.rank, xp: row.xp,
        currentXp, neededXp, pct,
        rep: row.rep, messages: row.messages
      })
      const file = new AttachmentBuilder(buffer, { name: 'rank.png' })
      return interaction.editReply({ files: [file] })
    } catch {
      // Fallback embed if canvas fails
      const bar   = buildBar(Math.floor(pct * 100))
      const embed = info(`📊 ${target.tag}`, null)
        .setThumbnail(target.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: 'Rank',     value: `#${rank.rank}`,      inline: true },
          { name: 'Level',    value: String(level),         inline: true },
          { name: 'XP',       value: String(row.xp),        inline: true },
          { name: 'Rep',      value: String(row.rep),        inline: true },
          { name: 'Messages', value: String(row.messages),   inline: true },
          { name: `Progress to level ${level + 1}`, value: `${bar} ${currentXp}/${neededXp}`, inline: false }
        )
      return interaction.editReply({ embeds: [embed] })
    }
  }
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────
async function renderRankCard (createCanvas, loadImage, { tag, avatarURL, level, rank, xp, currentXp, neededXp, pct, rep, messages }) {
  const W = 934, H = 282
  const canvas = createCanvas(W, H)
  const ctx    = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#1a1a2e'
  roundRect(ctx, 0, 0, W, H, 20); ctx.fill()

  // Gradient overlay
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, 'rgba(88,101,242,0.18)')
  grad.addColorStop(1, 'rgba(88,101,242,0.02)')
  ctx.fillStyle = grad
  roundRect(ctx, 0, 0, W, H, 20); ctx.fill()

  // Avatar circle
  const AX = 40, AY = H / 2, AR = 90
  ctx.save()
  ctx.beginPath()
  ctx.arc(AX + AR, AY, AR, 0, Math.PI * 2)
  ctx.clip()
  try {
    const avatar = await loadImage(avatarURL)
    ctx.drawImage(avatar, AX, AY - AR, AR * 2, AR * 2)
  } catch {
    ctx.fillStyle = '#5865F2'
    ctx.fillRect(AX, AY - AR, AR * 2, AR * 2)
  }
  ctx.restore()

  // Avatar ring
  ctx.beginPath()
  ctx.arc(AX + AR, AY, AR + 4, 0, Math.PI * 2)
  ctx.strokeStyle = '#5865F2'
  ctx.lineWidth = 5
  ctx.stroke()

  // Username
  const TX = AX + AR * 2 + 30
  const [name, disc] = tag.includes('#') ? tag.split('#') : [tag, '']
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText(name.slice(0, 18), TX, 88)
  if (disc) {
    const nw = ctx.measureText(name.slice(0, 18)).width
    ctx.fillStyle = '#8888aa'
    ctx.font = '24px sans-serif'
    ctx.fillText(`#${disc}`, TX + nw + 6, 88)
  }

  // Rank + Level (top right)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#8888aa'; ctx.font = '20px sans-serif'
  ctx.fillText('RANK', W - 20, 55)
  ctx.fillStyle = '#5865F2'; ctx.font = 'bold 38px sans-serif'
  ctx.fillText(`#${rank}`, W - 20, 95)
  ctx.fillStyle = '#8888aa'; ctx.font = '20px sans-serif'
  ctx.fillText('LEVEL', W - 20, 125)
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 38px sans-serif'
  ctx.fillText(String(level), W - 20, 165)
  ctx.textAlign = 'left'

  // XP label
  ctx.fillStyle = '#8888aa'; ctx.font = '18px sans-serif'
  const xpLabel = `${currentXp.toLocaleString()} / ${neededXp.toLocaleString()} XP`
  const xpW = ctx.measureText(xpLabel).width
  ctx.fillText(xpLabel, W - xpW - 140, H - 60)

  // Progress bar
  const BX = TX, BY = H - 48, BW = W - TX - 140, BH = 22
  ctx.fillStyle = '#2e2e4a'
  roundRect(ctx, BX, BY, BW, BH, BH / 2); ctx.fill()
  if (pct > 0) {
    const fg = ctx.createLinearGradient(BX, 0, BX + BW, 0)
    fg.addColorStop(0, '#5865F2')
    fg.addColorStop(1, '#7289da')
    ctx.fillStyle = fg
    roundRect(ctx, BX, BY, Math.max(BH, BW * pct), BH, BH / 2); ctx.fill()
  }

  // Stats row
  const stats = [
    { label: 'Total XP',  value: xp.toLocaleString() },
    { label: 'Messages',  value: messages.toLocaleString() },
    { label: 'Rep',       value: String(rep) }
  ]
  stats.forEach(({ label, value }, i) => {
    const sx = TX + i * 190
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px sans-serif'
    ctx.fillText(value, sx, H - 80)
    ctx.fillStyle = '#8888aa'; ctx.font = '15px sans-serif'
    ctx.fillText(label, sx, H - 62)
  })

  return canvas.toBuffer('image/png')
}

function roundRect (ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function buildBar (pct, len = 20) {
  const f = Math.round((pct / 100) * len)
  return '█'.repeat(f) + '░'.repeat(len - f)
}
