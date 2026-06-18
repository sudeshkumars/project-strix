'use strict'

const { SlashCommandBuilder } = require('discord.js')
const db                      = require('../../../shared/db')
const { success, error, info } = require('../../../shared/embed')
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

      if (target.id === interaction.user.id) {
        return interaction.editReply({ embeds: [error('Nope', 'You cannot rep yourself.')] })
      }
      if (target.bot) {
        return interaction.editReply({ embeds: [error('Nope', 'You cannot rep bots.')] })
      }

      // Cooldown check
      db.upsertUser(interaction.user.id, guildId)
      const giver = db.getUser(interaction.user.id, guildId)
      const now   = Math.floor(Date.now() / 1000)

      if (giver.last_rep && (now - giver.last_rep) < REP_COOLDOWN) {
        const nextRep = giver.last_rep + REP_COOLDOWN
        return interaction.editReply({
          embeds: [error('Cooldown', `You can give rep again ${relativeTime(nextRep)}.`)]
        })
      }

      db.upsertUser(target.id, guildId)
      db.giveRep(guildId, interaction.user.id, target.id)

      const receiver = db.getUser(target.id, guildId)
      return interaction.editReply({
        embeds: [success('Rep Given', `You gave +1 rep to ${target}. They now have **${receiver.rep}** rep.`)]
      })
    }

    if (sub === 'check') {
      const target = interaction.options.getUser('user') ?? interaction.user
      db.upsertUser(target.id, guildId)
      const row = db.getUser(target.id, guildId)

      return interaction.editReply({
        embeds: [info(`👍 Rep — ${target.tag}`, `**${target}** has **${row.rep}** reputation points.`)
          .setThumbnail(target.displayAvatarURL({ size: 64 }))]
      })
    }

    if (sub === 'top') {
      const rows = db.getRepLeaderboard(guildId, 10)
      if (!rows.length) return interaction.editReply({ content: 'No rep data yet.' })

      const embed = info('👍 Rep Leaderboard', null)
      const medals = ['🥇', '🥈', '🥉']
      rows.forEach((r, i) => {
        embed.addFields({
          name:  `${medals[i] ?? `**${i + 1}.**`} <@${r.user_id}>`,
          value: `**${r.rep}** rep`,
          inline: false
        })
      })

      return interaction.editReply({ embeds: [embed] })
    }
  }
}
