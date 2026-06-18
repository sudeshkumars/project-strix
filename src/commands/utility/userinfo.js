'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db                      = require('../../../shared/db')
const { infoCard }            = require('../../../shared/components')
const { calcLevel, fullTime, relativeTime } = require('../../../shared/utils')
const { resolveTier, tierName }            = require('../../../shared/permissions')

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('View info about a user')
    .addUserOption(o => o.setName('user').setDescription('User to look up').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply()

    const target  = interaction.options.getUser('user') ?? interaction.user
    const guildId = interaction.guild.id
    const config  = interaction.guildConfig

    let member
    try { member = await interaction.guild.members.fetch(target.id) } catch {}

    // DB data
    const row = db.getUser(target.id, guildId)
    const { level } = row ? calcLevel(row.xp) : { level: 0 }
    const rank = row ? db.getUserRank(target.id, guildId) : null

    // Cases
    const caseCount = db.getCaseCount(guildId, target.id).count
    const warnPts   = db.getActiveWarnPoints(guildId, target.id, config?.warn_decay_days ?? 30)

    // Perm tier
    const tier = member ? tierName(resolveTier(member, config)) : 'N/A'

    // Roles (up to 10)
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
}
