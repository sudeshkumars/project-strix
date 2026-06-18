'use strict'

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')
const db                         = require('../../../shared/db')
const { successCard, errorCard } = require('../../../shared/components')
const { calcLevel }              = require('../../../shared/utils')

module.exports = {
  permLevel: 'admin',
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Manage XP for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('give')
      .setDescription('Give XP to a member')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('XP to give').setMinValue(1).setRequired(true)))
    .addSubcommand(s => s
      .setName('take')
      .setDescription('Take XP from a member')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('XP to take').setMinValue(1).setRequired(true)))
    .addSubcommand(s => s
      .setName('set')
      .setDescription('Set a member\'s XP')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('XP amount').setMinValue(0).setRequired(true)))
    .addSubcommand(s => s
      .setName('reset')
      .setDescription('Reset a member\'s XP to 0')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const sub     = interaction.options.getSubcommand()
    const target  = interaction.options.getUser('user')
    const guildId = interaction.guild.id

    db.upsertUser(target.id, guildId)
    const row = db.getUser(target.id, guildId)

    if (sub === 'give') {
      const amount  = interaction.options.getInteger('amount')
      const updated = db.addXp(target.id, guildId, amount)
      const { level } = calcLevel(updated.xp)
      db.setLevel(target.id, guildId, level)
      return interaction.editReply(successCard('XP Given', [`Gave **${amount} XP** to ${target}. They now have **${updated.xp} XP** (Level ${level}).`]))
    }

    if (sub === 'take') {
      const amount  = interaction.options.getInteger('amount')
      const newXp   = Math.max(0, row.xp - amount)
      db.setXp(target.id, guildId, newXp)
      const { level } = calcLevel(newXp)
      db.setLevel(target.id, guildId, level)
      return interaction.editReply(successCard('XP Taken', [`Took **${amount} XP** from ${target}. They now have **${newXp} XP** (Level ${level}).`]))
    }

    if (sub === 'set') {
      const amount = interaction.options.getInteger('amount')
      db.setXp(target.id, guildId, amount)
      const { level } = calcLevel(amount)
      db.setLevel(target.id, guildId, level)
      return interaction.editReply(successCard('XP Set', [`Set ${target}'s XP to **${amount}** (Level ${level}).`]))
    }

    if (sub === 'reset') {
      db.resetUserXp(target.id, guildId)
      return interaction.editReply(successCard('XP Reset', [`Reset ${target}'s XP and level to 0.`]))
    }
  }
}
