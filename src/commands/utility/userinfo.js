'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db                      = require('../../../shared/db')
const { info }                = require('../../../shared/embed')
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

    const embed = info(`👤 ${target.tag}`, null)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'ID',          value: target.id,                         inline: true  },
        { name: 'Bot',         value: target.bot ? 'Yes' : 'No',         inline: true  },
        { name: 'Tier',        value: tier,                              inline: true  },
        { name: 'Created',     value: fullTime(Math.floor(target.createdTimestamp / 1000)), inline: true },
        { name: 'Joined',      value: member ? fullTime(Math.floor(member.joinedTimestamp / 1000)) : 'N/A', inline: true },
        { name: 'Nickname',    value: member?.nickname ?? 'None',        inline: true  },
        { name: 'XP / Level',  value: row ? `${row.xp} XP | Level ${level}` : 'No data', inline: true },
        { name: 'Rank',        value: rank ? `#${rank.rank}` : 'N/A',   inline: true  },
        { name: 'Rep',         value: row ? String(row.rep) : '0',       inline: true  },
        { name: 'Cases',       value: String(caseCount),                 inline: true  },
        { name: 'Warn Points', value: String(warnPts),                   inline: true  },
        { name: 'Messages',    value: row ? String(row.messages) : '0',  inline: true  },
        { name: 'Roles',       value: roles,                             inline: false }
      )

    if (member?.premiumSince) {
      embed.addFields({ name: 'Boosting since', value: relativeTime(Math.floor(member.premiumSinceTimestamp / 1000)), inline: true })
    }

    await interaction.editReply({ embeds: [embed] })
  }
}
