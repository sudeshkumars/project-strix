'use strict'

const { SlashCommandBuilder } = require('discord.js')
const { createContext, runInContext } = require('vm')
const db           = require('../../../shared/db')
const { success, error } = require('../../../shared/embed')
const { chunkString }    = require('../../../shared/utils')

module.exports = {
  permLevel: 'owner',
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('eval')
    .setDescription('Execute code (owner only)')
    .addStringOption(o => o.setName('code').setDescription('Code to execute').setRequired(true))
    .addBooleanOption(o => o.setName('async').setDescription('Wrap in async function').setRequired(false)),

  async execute (client, interaction) {
    await interaction.deferReply({ ephemeral: true })

    const code    = interaction.options.getString('code')
    const isAsync = interaction.options.getBoolean('async') ?? false

    const sandbox = createContext({ client, interaction, db, require, process: { env: {} } })

    let result
    const start = Date.now()
    try {
      const script = isAsync ? `(async () => { ${code} })()` : code
      result = await runInContext(script, sandbox, { timeout: 5000 })
    } catch (e) {
      db.writeEvalLog(interaction.user.id, code, `ERROR: ${e.message}`)
      return interaction.editReply({
        embeds: [error('Eval Error', `\`\`\`js\n${e.message.slice(0, 1000)}\`\`\``)]
      })
    }

    const elapsed = Date.now() - start
    const output  = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)

    db.writeEvalLog(interaction.user.id, code, output.slice(0, 2000))

    const chunks = chunkString(output, 1900)
    const embed  = success('Eval', `\`\`\`js\n${chunks[0] ?? 'undefined'}\`\`\``)
      .setFooter({ text: `${elapsed}ms` })

    await interaction.editReply({ embeds: [embed] })

    for (const chunk of chunks.slice(1)) {
      await interaction.followUp({ content: `\`\`\`js\n${chunk}\`\`\``, ephemeral: true })
    }
  }
}
