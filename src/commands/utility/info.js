'use strict'

const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js')
const db                                                  = require('../../../shared/db')
const { info, COLORS }                                    = require('../../../shared/embed')
const { calcLevel, fullTime, relativeTime }               = require('../../../shared/utils')
const { resolveTier, tierName }                           = require('../../../shared/permissions')

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

  const embed = info(`🏠 ${guild.name}`, null)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: 'ID',           value: guild.id,                                            inline: true },
      { name: 'Owner',        value: `<@${guild.ownerId}>`,                               inline: true },
      { name: 'Created',      value: fullTime(Math.floor(guild.createdTimestamp / 1000)), inline: true },
      { name: 'Members',      value: `👥 ${humans} humans | 🤖 ${bots} bots`,            inline: true },
      { name: 'Channels',     value: `💬 ${text} text | 🔊 ${voice} voice | 📁 ${cats} cats`, inline: true },
      { name: 'Roles',        value: String(roles),                                        inline: true },
      { name: 'Emojis',       value: String(emojis),                                      inline: true },
      { name: 'Boosts',       value: `${boosts} (Tier ${tier})`,                         inline: true },
      { name: 'Verification', value: VERIFICATION[guild.verificationLevel] ?? 'Unknown',  inline: true },
      { name: '7d Activity',  value: `📨 ${totalMsg} msgs | 📥 ${totalJoin} joins`,      inline: false }
    )

  if (guild.description) embed.setDescription(guild.description)
  if (guild.bannerURL())  embed.setImage(guild.bannerURL({ size: 1024 }))

  const features = guild.features.slice(0, 6).map(f => `\`${f}\``).join(', ')
  if (features) embed.addFields({ name: 'Features', value: features, inline: false })

  await interaction.editReply({ embeds: [embed] })
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

  const embed = info(`👤 ${target.tag}`, null)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'ID',          value: target.id,                                                           inline: true },
      { name: 'Bot',         value: target.bot ? 'Yes' : 'No',                                          inline: true },
      { name: 'Tier',        value: tier,                                                                inline: true },
      { name: 'Created',     value: fullTime(Math.floor(target.createdTimestamp / 1000)),                inline: true },
      { name: 'Joined',      value: member ? fullTime(Math.floor(member.joinedTimestamp / 1000)) : 'N/A', inline: true },
      { name: 'Nickname',    value: member?.nickname ?? 'None',                                         inline: true },
      { name: 'XP / Level',  value: row ? `${row.xp} XP | Level ${level}` : 'No data',                 inline: true },
      { name: 'Rank',        value: rank ? `#${rank.rank}` : 'N/A',                                     inline: true },
      { name: 'Rep',         value: row ? String(row.rep) : '0',                                        inline: true },
      { name: 'Cases',       value: String(caseCount),                                                   inline: true },
      { name: 'Warn Points', value: String(warnPts),                                                     inline: true },
      { name: 'Messages',    value: row ? String(row.messages) : '0',                                   inline: true },
      { name: 'Roles',       value: roles,                                                               inline: false }
    )

  if (member?.premiumSince) {
    embed.addFields({
      name:  'Boosting since',
      value: relativeTime(Math.floor(member.premiumSinceTimestamp / 1000)),
      inline: true
    })
  }

  await interaction.editReply({ embeds: [embed] })
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

  const embed = info(`🤖 ${client.user.tag}`, null)
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'ID',           value: client.user.id,                inline: true },
      { name: 'Guilds',       value: String(guildCount),            inline: true },
      { name: 'Users',        value: String(userCount),             inline: true },
      { name: 'Commands',     value: String(cmdCount),              inline: true },
      { name: 'Ping',         value: `${client.ws.ping}ms`,         inline: true },
      { name: 'Online Since', value: fullTime(startedAt),           inline: true },
      { name: 'Uptime',       value: formatUptime(uptimeMs),        inline: true },
      { name: '7d Commands',  value: String(totalCmds),             inline: true },
      { name: 'Node.js',      value: process.version,               inline: true }
    )
    .setTimestamp()

  await interaction.editReply({ embeds: [embed] })
}

// ─── /info role ───────────────────────────────────────────────────────────────

async function infoRole (interaction) {
  const role = interaction.options.getRole('role')

  const perms = role.permissions.toArray()
    .slice(0, 8)
    .map(p => `\`${p}\``)
    .join(', ') || 'None'

  const embed = new EmbedBuilder()
    .setColor(role.color || COLORS.info)
    .setTitle(`🎭 ${role.name}`)
    .addFields(
      { name: 'ID',          value: role.id,                                       inline: true },
      { name: 'Color',       value: role.hexColor,                                 inline: true },
      { name: 'Position',    value: String(role.position),                         inline: true },
      { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No',             inline: true },
      { name: 'Hoisted',     value: role.hoist ? 'Yes' : 'No',                   inline: true },
      { name: 'Managed',     value: role.managed ? 'Yes (bot role)' : 'No',      inline: true },
      { name: 'Members',     value: String(role.members.size),                    inline: true },
      { name: 'Created',     value: fullTime(Math.floor(role.createdTimestamp / 1000)), inline: true },
      { name: 'Permissions', value: perms,                                         inline: false }
    )
    .setTimestamp()

  await interaction.editReply({ embeds: [embed] })
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
