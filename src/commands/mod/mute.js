'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                    = require('../../../shared/db')
const { modCard, errorCard } = require('../../../shared/components')
const { modDm }             = require('../../../shared/embed')
const { parseDuration, formatDuration, safeSend } = require('../../../shared/utils')

const MAX_TIMEOUT_SECS = 28 * 24 * 3600  // Discord limit: 28 days

module.exports = {
  permLevel: 'mod',
  guildOnly: true,
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (mute) a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to mute').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 1h, 7d').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const target = interaction.options.getUser('user')
    const durStr = interaction.options.getString('duration')
    const reason = interaction.options.getString('reason') ?? 'No reason provided'
    const guild  = interaction.guild
    const config = interaction.guildConfig

    const secs = parseDuration(durStr)
    if (!secs) return interaction.editReply(errorCard('Invalid Duration', ['Use e.g. `10m`, `1h`, `7d`.']))
    if (secs > MAX_TIMEOUT_SECS) return interaction.editReply(errorCard('Too Long', ['Maximum timeout is 28 days.']))

    let member
    try { member = await guild.members.fetch(target.id) } catch {
      return interaction.editReply(errorCard('Not Found', ['Member not found.']))
    }

    if (!member.moderatable) return interaction.editReply(errorCard('Cannot Mute', ['I cannot timeout that member.']))

    const durLabel  = formatDuration(secs)
    const expiresAt = Math.floor(Date.now() / 1000) + secs

    if (config?.dm_on_action) {
      await safeSend(target, {
        embeds: [modDm({ action: 'Mute', guildName: guild.name, reason, duration: durLabel })]
      })
    }

    try {
      await member.timeout(secs * 1000, `[Stryx] ${reason} | Mod: ${interaction.user.tag}`)
    } catch (e) {
      return interaction.editReply(errorCard('Mute Failed', [e.message]))
    }

    const caseId = db.createCase(guild.id, target.id, interaction.user.id, 'mute', reason, expiresAt)
    db.createTempPunishment(guild.id, target.id, 'mute', expiresAt, caseId)

    const lines = [
      `**User** \u2014 ${target.username} (\`${target.id}\`)`,
      `**Mod** \u2014 ${interaction.user.username} (\`${interaction.user.id}\`)`,
      `**Reason** \u2014 ${reason}`,
      `**Duration** \u2014 ${durLabel}`
    ]

    const payload = modCard(`\u{1f528} Mute \u2014 Case #${caseId}`, lines)

    if (config?.case_channel) {
      const ch = guild.channels.cache.get(config.case_channel)
      if (ch) await safeSend(ch, payload)
    }

    await interaction.editReply(payload)
  }
}
