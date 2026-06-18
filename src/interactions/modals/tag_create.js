'use strict'

const db                 = require('../../../shared/db')
const { success, error } = require('../../../shared/embed')
const { resolveTier, TIERS } = require('../../../shared/permissions')

module.exports = {
  id: 'tag_create',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    if (resolveTier(interaction.member, config) < TIERS.MOD) {
      return interaction.editReply({ embeds: [error('No permission', 'Creating tags requires mod permission.')] })
    }

    const name     = interaction.fields.getTextInputValue('tag_name').toLowerCase().trim()
    const response = interaction.fields.getTextInputValue('tag_response').trim()
    const guildId  = interaction.guild.id

    if (!name || !response) {
      return interaction.editReply({ embeds: [error('Invalid', 'Name and response are required.')] })
    }

    if (db.getTag(guildId, name)) {
      return interaction.editReply({ embeds: [error('Already exists', `Tag \`${name}\` already exists. Use \`/tag edit\` to update it.`)] })
    }

    db.createTag(guildId, name, response, 'user', false, [])
    return interaction.editReply({ embeds: [success('Tag Created', `Tag \`${name}\` created successfully.`)] })
  }
}
