const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const https = require("https");
const padRight = require("../features/padRight");
const chalk = require("chalk");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cash")
    .setDescription("Add 0.5$ to your balance, every 24 hours"),

  async execute(client, interaction) {
    try {
      const userId = interaction.user.id;

      const waitEmbed = new EmbedBuilder()
        .setColor("#b300ff")
        .setTitle("Please wait...")
        .setDescription("Updating your balance...");

      let waitMessage;

      if (!interaction.replied) {
        waitMessage = await interaction.reply({
          embeds: [waitEmbed],
        });
      } else {
        waitMessage = await interaction.followUp({
          embeds: [waitEmbed],
        });
      }

      const refundResponse = await axios.post(
        "https://127.0.0.1:8000/api/checkRefund",
        null,
        {
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        }
      );

      console.log(
        chalk.green(
          padRight(`[/] ${interaction.user.username}: [Refund Check]`, 9)
        )
      );
      const response = await axios.post(
        "https://127.0.0.1:8000/api/add/discordCash",
        null,
        {
          headers: {
            userId: userId,
            username: interaction.user.username,
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        }
      );

      if (response.data.status === 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#FFA500")
          .setTitle("Balance: " + response.data.cash + "$")
          .setDescription(
            "You can only add 0.5$ every 24 hours, please wait " +
              response.data.timeRemaining
          );
        console.log(
          chalk.magenta(
            padRight(
              `[+] ${interaction.user.username}: Please wait ${response.data.timeRemaining}`,
              9
            )
          )
        );
        await waitMessage.edit({ embeds: [errorEmbed] });
      } else if (response.data.status === 1) {
        const successEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle(
            "Balance: " +
              response.data.oldCash +
              "$ --> " +
              response.data.cash +
              "$"
          )
          .setDescription("Your balance has been successfully updated.\n");

        await waitMessage.edit({ embeds: [successEmbed] });
        console.log(
          padRight(
            chalk.magenta(
              `[+] ${interaction.user.username}: Balance successfully updated: ${response.data.cash}$`),
              9
            )
        );
      }
    } catch (error) {
      console.log(
        chalk.yellow(
          padRight(
            `[!] ${interaction.user.username}: Error while updating balance: ${error.message}`,
            9
          )
        )
      );
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Error")
        .setDescription("An error occurred while updating your balance.");

      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
