'use strict'

const { getConfig } = require('../../../shared/cache')

module.exports = {
  id: 'verify_btn',

  async execute (client, interaction, config) {
    await interaction.deferReply({ ephemeral: true })

    const guildConfig = config || getConfig(client, interaction.guild.id)
    const verifyRole  = guildConfig?.verify_role
    if (!verifyRole) {
      return interaction.editReply({ content: '\u274c Verification is not configured.' })
    }

    const member = interaction.member

    if (member.roles.cache.has(verifyRole)) {
      return interaction.editReply({ content: "You're already verified." })
    }

    try {
      await member.roles.add(verifyRole, '[Stryx] Verification')
      return interaction.editReply({ content: '\u2705 Verified!' })
    } catch (e) {
      return interaction.editReply({ content: `\u274c Failed to verify: ${e.message}` })
    }
  }
}
