'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db                      = require('../../../shared/db')
const { successCard, errorCard, infoCard, capList } = require('../../../shared/components')
const { relativeTime }        = require('../../../shared/utils')

const REP_COOLDOWN = 24 * 60 * 60  // 24 hours in seconds

module.exports = {
  permLevel: 'user',
  guildOnly: true,
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Reputation system')
    .addSubcommand(s => s
      .setName('give')
      .setDescription('Give reputation to a member')
      .addUserOption(o => o.setName('user').setDescription('Member to rep').setRequired(true)))
    .addSubcommand(s => s
      .setName('check')
      .setDescription('Check a member\'s reputation')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(false)))
    .addSubcommand(s => s
      .setName('top')
      .setDescription('View the rep leaderboard')),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'give') {
      const target = interaction.options.getUser('user')

      if (target.id === interaction.user.id) return interaction.editReply(errorCard('Nope', ['You cannot rep yourself.']))
      if (target.bot) return interaction.editReply(errorCard('Nope', ['You cannot rep bots.']))

      db.upsertUser(interaction.user.id, guildId)
      const giver = db.getUser(interaction.user.id, guildId)
      const now   = Math.floor(Date.now() / 1000)

      if (giver.last_rep && (now - giver.last_rep) < REP_COOLDOWN) {
        const nextRep = giver.last_rep + REP_COOLDOWN
        return interaction.editReply(errorCard('Cooldown', [`You can give rep again ${relativeTime(nextRep)}.`]))
      }

      db.upsertUser(target.id, guildId)
      db.giveRep(guildId, interaction.user.id, target.id)

      const receiver = db.getUser(target.id, guildId)
      return interaction.editReply(successCard('Rep Given', [`You gave +1 rep to ${target}. They now have **${receiver.rep}** rep.`]))
    }

    if (sub === 'check') {
      const target = interaction.options.getUser('user') ?? interaction.user
      db.upsertUser(target.id, guildId)
      const row = db.getUser(target.id, guildId)

      return interaction.editReply(infoCard(`\u{1f44d} Rep \u2014 ${target.tag}`, [
        `**${target}** has **${row.rep}** reputation points.`
      ], { thumbnail: target.displayAvatarURL({ size: 64 }) }))
    }

    if (sub === 'top') {
      const rows = db.getRepLeaderboard(guildId, 10)
      if (!rows.length) return interaction.editReply(infoCard('\u{1f44d} Rep Leaderboard', ['No rep data yet.']))

      const medals = ['\u{1f947}', '\u{1f948}', '\u{1f949}']
      const lines = rows.map((r, i) =>
        `${medals[i] ?? `**${i + 1}.**`} <@${r.user_id}> \u2014 **${r.rep}** rep`
      )

      return interaction.editReply(infoCard('\u{1f44d} Rep Leaderboard', lines))
    }
  }
}
