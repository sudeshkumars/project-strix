'use strict'

const { SlashCommandBuilder, ChannelType } = require('discord.js')
const db                                   = require('../../../shared/db')
const { infoCard, buildCardPayload }       = require('../../../shared/components')
const { calcLevel, fullTime, relativeTime } = require('../../../shared/utils')
const { resolveTier, tierName }            = require('../../../shared/permissions')

const VERIFICATION = ['None', 'Low', 'Medium', 'High', 'Very High']

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('View information about anything in this server')
    .addSubcommand(s => s
      .setName('server')
      .setDescription('View server information')
    )
    .addSubcommand(s => s
      .setName('user')
      .setDescription('View information about a user')
      .addUserOption(o => o.setName('user').setDescription('User to look up').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('bot')
      .setDescription('View bot information and statistics')
    )
    .addSubcommand(s => s
      .setName('role')
      .setDescription('View information about a role')
      .addRoleOption(o => o.setName('role').setDescription('Role to look up').setRequired(true))
    ),

  async execute (client, interaction) {
    await interaction.deferReply()

    const sub = interaction.options.getSubcommand()

    if (sub === 'server') return infoServer(interaction, client)
    if (sub === 'user')   return infoUser(interaction, client)
    if (sub === 'bot')    return infoBot(interaction, client)
    if (sub === 'role')   return infoRole(interaction)
  }
}

// ─── /info server ─────────────────────────────────────────────────────────────

async function infoServer (interaction, client) {
  const guild   = interaction.guild
  const guildId = guild.id

  await guild.fetch()

  const members  = guild.members.cache
  const bots     = members.filter(m => m.user.bot).size
  const humans   = guild.memberCount - bots
  const channels = guild.channels.cache
  const text     = channels.filter(c => c.type === ChannelType.GuildText).size
  const voice    = channels.filter(c => c.isVoiceBased()).size
  const cats     = channels.filter(c => c.type === ChannelType.GuildCategory).size
  const roles    = guild.roles.cache.size - 1
  const emojis   = guild.emojis.cache.size
  const boosts   = guild.premiumSubscriptionCount ?? 0
  const tier     = guild.premiumTier

  const stats     = db.getActivityStats(guildId, 7)
  const totalMsg  = stats.reduce((a, b) => a + (b.messages ?? 0), 0)
  const totalJoin = stats.reduce((a, b) => a + (b.joins ?? 0), 0)

  const lines = [
    `**ID** \u2014 ${guild.id}`,
    `**Owner** \u2014 <@${guild.ownerId}>`,
    `**Created** \u2014 ${fullTime(Math.floor(guild.createdTimestamp / 1000))}`,
    `**Members** \u2014 \u{1f465} ${humans} humans | \u{1f916} ${bots} bots`,
    `**Channels** \u2014 \u{1f4ac} ${text} text | \u{1f50a} ${voice} voice | \u{1f4c1} ${cats} cats`,
    `**Roles** \u2014 ${roles}`,
    `**Emojis** \u2014 ${emojis}`,
    `**Boosts** \u2014 ${boosts} (Tier ${tier})`,
    `**Verification** \u2014 ${VERIFICATION[guild.verificationLevel] ?? 'Unknown'}`,
    `**7d Activity** \u2014 \u{1f4e8} ${totalMsg} msgs | \u{1f4e5} ${totalJoin} joins`
  ]

  if (guild.description) lines.unshift(guild.description)

  const features = guild.features.slice(0, 6).map(f => `\`${f}\``).join(', ')
  if (features) lines.push(`**Features** \u2014 ${features}`)

  await interaction.editReply(infoCard(`\u{1f3e0} ${guild.name}`, lines, {
    thumbnail: guild.iconURL({ size: 256 }) || undefined,
    image: guild.bannerURL({ size: 1024 }) || undefined
  }))
}

// ─── /info user ───────────────────────────────────────────────────────────────

async function infoUser (interaction, client) {
  const target  = interaction.options.getUser('user') ?? interaction.user
  const guildId = interaction.guild.id
  const config  = interaction.guildConfig

  let member
  try { member = await interaction.guild.members.fetch(target.id) } catch {}

  const row       = db.getUser(target.id, guildId)
  const { level } = row ? calcLevel(row.xp) : { level: 0 }
  const rank      = row ? db.getUserRank(target.id, guildId) : null
  const caseCount = db.getCaseCount(guildId, target.id).count
  const warnPts   = db.getActiveWarnPoints(guildId, target.id, config?.warn_decay_days ?? 30)
  const tier      = member ? tierName(resolveTier(member, config)) : 'N/A'

  const roles = member
    ? [...member.roles.cache.values()]
        .filter(r => r.id !== interaction.guild.roles.everyone.id)
        .sort((a, b) => b.position - a.position)
        .slice(0, 10)
        .map(r => `${r}`)
        .join(', ') || 'None'
    : 'Not in server'

  const lines = [
    `**ID** \u2014 ${target.id}`,
    `**Bot** \u2014 ${target.bot ? 'Yes' : 'No'}`,
    `**Tier** \u2014 ${tier}`,
    `**Created** \u2014 ${fullTime(Math.floor(target.createdTimestamp / 1000))}`,
    `**Joined** \u2014 ${member ? fullTime(Math.floor(member.joinedTimestamp / 1000)) : 'N/A'}`,
    `**Nickname** \u2014 ${member?.nickname ?? 'None'}`,
    `**XP / Level** \u2014 ${row ? `${row.xp} XP | Level ${level}` : 'No data'}`,
    `**Rank** \u2014 ${rank ? `#${rank.rank}` : 'N/A'}`,
    `**Rep** \u2014 ${row ? String(row.rep) : '0'}`,
    `**Cases** \u2014 ${caseCount}`,
    `**Warn Points** \u2014 ${warnPts}`,
    `**Messages** \u2014 ${row ? String(row.messages) : '0'}`,
    `**Roles** \u2014 ${roles}`
  ]

  if (member?.premiumSince) {
    lines.push(`**Boosting since** \u2014 ${relativeTime(Math.floor(member.premiumSinceTimestamp / 1000))}`)
  }

  await interaction.editReply(infoCard(`\u{1f464} ${target.tag}`, lines, {
    thumbnail: target.displayAvatarURL({ size: 256 })
  }))
}

// ─── /info bot ────────────────────────────────────────────────────────────────

async function infoBot (interaction, client) {
  const uptimeMs  = client.uptime ?? 0
  const startedAt = Math.floor((Date.now() - uptimeMs) / 1000)
  const guildCount = client.guilds.cache.size
  const userCount  = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)
  const cmdCount   = client.commands?.size ?? 0

  const stats = db.getBotStats(7)
  const totalCmds = stats.reduce((a, b) => a + (b.commands_fired ?? 0), 0)

  const lines = [
    `**ID** \u2014 ${client.user.id}`,
    `**Guilds** \u2014 ${guildCount}`,
    `**Users** \u2014 ${userCount}`,
    `**Commands** \u2014 ${cmdCount}`,
    `**Ping** \u2014 ${client.ws.ping}ms`,
    `**Online Since** \u2014 ${fullTime(startedAt)}`,
    `**Uptime** \u2014 ${formatUptime(uptimeMs)}`,
    `**7d Commands** \u2014 ${totalCmds}`,
    `**Node.js** \u2014 ${process.version}`
  ]

  await interaction.editReply(infoCard(`\u{1f916} ${client.user.tag}`, lines, {
    thumbnail: client.user.displayAvatarURL({ size: 256 })
  }))
}

// ─── /info role ───────────────────────────────────────────────────────────────

async function infoRole (interaction) {
  const role = interaction.options.getRole('role')

  const perms = role.permissions.toArray()
    .slice(0, 8)
    .map(p => `\`${p}\``)
    .join(', ') || 'None'

  const lines = [
    `**ID** \u2014 ${role.id}`,
    `**Color** \u2014 ${role.hexColor}`,
    `**Position** \u2014 ${role.position}`,
    `**Mentionable** \u2014 ${role.mentionable ? 'Yes' : 'No'}`,
    `**Hoisted** \u2014 ${role.hoist ? 'Yes' : 'No'}`,
    `**Managed** \u2014 ${role.managed ? 'Yes (bot role)' : 'No'}`,
    `**Members** \u2014 ${role.members.size}`,
    `**Created** \u2014 ${fullTime(Math.floor(role.createdTimestamp / 1000))}`,
    `**Permissions** \u2014 ${perms}`
  ]

  await interaction.editReply(buildCardPayload({
    accent: role.color || 'info',
    title: `\u{1f3ad} ${role.name}`,
    lines
  }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime (ms) {
  const s   = Math.floor(ms / 1000)
  const d   = Math.floor(s / 86400)
  const h   = Math.floor((s % 86400) / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${sec}s`].filter(Boolean).join(' ')
}
