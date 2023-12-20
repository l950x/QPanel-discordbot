const {
  SlashCommandBuilder,
  ButtonBuilder,
  ActionRowBuilder,
} = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const https = require("https");

let unitPrices = null;

const updatePrices = async () => {
  try {
    const response = await axios.post(
      "https://127.0.0.1:8000/api/mediaPrices",
      null,
      {
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      }
    );
    unitPrices = response.data;
  } catch (error) {
    console.error("Error updating prices:", error);
  }
};

updatePrices();

const formatPrice = (quantity, unitPrice) => {
  const price = quantity * unitPrice;
  return `${quantity} (${price.toFixed(2)}$)`;
};

const buttons = {
  instagram: new ButtonBuilder()
    .setCustomId("Instagram")
    .setLabel("Instagram")
    .setStyle(1),
  youtube: new ButtonBuilder()
    .setCustomId("Youtube")
    .setLabel("Youtube")
    .setStyle(1),
  tiktok: new ButtonBuilder()
    .setCustomId("Tiktok")
    .setLabel("Tiktok")
    .setStyle(1),
  twitter: new ButtonBuilder()
    .setCustomId("Twitter")
    .setLabel("Twitter")
    .setStyle(1),
  likes: new ButtonBuilder().setCustomId("Likes").setLabel("Likes").setStyle(1),
  followers: new ButtonBuilder()
    .setCustomId("Followers")
    .setLabel("Followers")
    .setStyle(1),
  views: new ButtonBuilder().setCustomId("Views").setLabel("Views").setStyle(1),
  100: new ButtonBuilder().setCustomId("100").setLabel("100").setStyle(1),
  200: new ButtonBuilder().setCustomId("200").setLabel("200").setStyle(1),
  300: new ButtonBuilder().setCustomId("300").setLabel("300").setStyle(1),
  500: new ButtonBuilder().setCustomId("500").setLabel("500").setStyle(1),
  1000: new ButtonBuilder().setCustomId("1000").setLabel("1000").setStyle(1),
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("media")
    .setDescription("Order a media service."),

  async execute(client, interaction) {
    try {
      let selectedMedia = null;
      let selectedService = null;
      let selectedQuantity = null;

      const initialActionRow = new ActionRowBuilder().addComponents(
        buttons.instagram,
        buttons.youtube,
        buttons.tiktok,
        buttons.twitter
      );

      const message = await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#b300ff")
            .setTitle("Media Selection")
            .setDescription(`Please select a media.`)
            .setTimestamp(),
        ],
        components: [initialActionRow],
        fetchReply: true,
        ephemeral: true,
      });

      const filter = (i) => {
        if (i.user.id === interaction.user.id) {
          if (
            ["Instagram", "Youtube", "Tiktok", "Twitter"].includes(i.customId)
          ) {
            return true;
          } else if (
            [
              "Likes",
              "Followers",
              "Views",
              "100",
              "200",
              "300",
              "500",
              "1000",
            ].includes(i.customId)
          ) {
            return selectedMedia !== null;
          }
        }
        return false;
      };

      const collector = message.createMessageComponentCollector({
        filter,
        time: 150000,
      });

      collector.on("collect", async (i) => {
        try {
          if (
            ["Instagram", "Youtube", "Tiktok", "Twitter"].includes(i.customId)
          ) {
            selectedMedia = i.customId;

            const serviceButtons = [buttons.likes, buttons.followers];
            if (["Youtube", "Tiktok", "Twitter"].includes(i.customId)) {
              serviceButtons.push(buttons.views);
            }

            const serviceActionRow = new ActionRowBuilder().addComponents(
              ...serviceButtons
            );

            await i.update({
              embeds: [
                new EmbedBuilder()
                  .setColor("#b300ff")
                  .setTitle("Service Selection")
                  .setDescription(
                    `You have selected ${selectedMedia}. Now, select a service.`
                  )
                  .setTimestamp(),
              ],
              components: [serviceActionRow],
              ephemeral: true,
            });
          } else if (["Likes", "Followers", "Views"].includes(i.customId)) {
            selectedService = i.customId;

            const unitPrice = unitPrices[selectedMedia][selectedService];

            axios
              .post("https://127.0.0.1:8000/api/discordCash", null, {
                headers: {
                  Authorization: interaction.user.id,
                  userId: interaction.user.id,
                  username: interaction.user.username,
                },
                httpsAgent: new https.Agent({
                  rejectUnauthorized: false,
                }),
              })
              .then((response) => {
                const discordCash = response.data.discordCash;
                const quantityOptions = [100, 200, 300, 500, 1000];
                const quantityButtons = quantityOptions.map((quantity) => {
                  const label = formatPrice(quantity, unitPrice);
                  const customId = quantity.toString();
                  return new ButtonBuilder()
                    .setCustomId(customId)
                    .setLabel(label)
                    .setStyle(1);
                });

                const quantityActionRow = new ActionRowBuilder().addComponents(
                  ...quantityButtons
                );
                const embed = new EmbedBuilder()
                  .setColor("#b300ff")
                  .setTitle("Quantity Selection")
                  .setDescription(
                    `You have selected ${selectedService}. Now, select a quantity.\nBalance: ${discordCash}`
                  )
                  .setTimestamp();

                i.update({
                  embeds: [embed],
                  components: [quantityActionRow],
                  ephemeral: true,
                });
              })
              .catch((error) => {
                console.error("Error in Axios request:", error);
              });
          } else if (
            ["100", "200", "300", "500", "1000"].includes(i.customId)
          ) {
            selectedQuantity = i.customId;

            await i.update({
              embeds: [
                new EmbedBuilder()
                  .setColor("#b300ff")
                  .setTitle("Link Selection")
                  .setDescription(
                    `You have selected ${selectedQuantity}. Please provide the link in the chat.`
                  )
                  .setTimestamp(),
              ],
              components: [],
              ephemeral: true,
            });

            const filter = (m) => m.author.id === i.user.id;
            const collector = i.channel.createMessageCollector({
              filter,
              max: 1,
              time: 15000,
            });

            collector.on("collect", async (m) => {
              const urlRegex = /^(ftp|http|https):\/\/[^ "]+$/;
              const isValidUrl = urlRegex.test(m.content);

              if (!isValidUrl) {
                await m.reply({
                  content: "URL not valid, please try again.",
                  ephemeral: true,
                });
                return;
              }

              const data = {
                media: selectedMedia,
                services: selectedService,
                link: m.content,
                number: selectedQuantity,
                discord: true,
              };

              await m.delete();

              const waitEmbed = new EmbedBuilder()
                .setColor("#b300ff")
                .setTitle("Please wait...")
                .setDescription("Processing your request.");

              await interaction.editReply({ embeds: [waitEmbed] });

              axios
                .post("https://127.0.0.1:8000/api/media", data, {
                  headers: {
                    Authorization: interaction.user.id,
                    userId: interaction.user.id,
                    username: interaction.user.username,
                  },
                  httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                  }),
                })
                .then((response) => {
                  console.log("response: " + response.data.message);
                  if (response.data.status === 1) {
                    const embed = new EmbedBuilder()
                      .setColor("#b300ff")
                      .setTitle("Order Confirmation")
                      .setDescription(
                        `Order ID: ${response.data.orderId}\nMedia: ${selectedMedia}\nService: ${selectedService}\nQuantity: ${selectedQuantity}\nPrice: ${response.data.total_price}$\nBalance: ${response.data.userBalanceBefore}$ -> ${response.data.userBalanceAfter}$\nLink: ${m.content}$`
                      )
                      .setTimestamp();
                    i.followUp({
                      content: `<@${interaction.user.id}>`,
                      embeds: [embed],
                      components: [],
                    });
                  } else if (response.data.status === 2) {
                    console.log("response: " + response.data.a);
                    console.log("response: " + response.data.b);
                    const embed = new EmbedBuilder()
                      .setColor("#ff0000")
                      .setTitle("Error")
                      .setDescription("You do not have enough money.");
                    interaction.followUp({ embeds: [embed] });
                  }
                })
                .catch((error) => {
                  console.error("Error in Axios request:", error);
                  let errorMessage =
                    "An error occurred while processing your request.";

                  if (error.response) {
                    console.error("Response data:", error.response.data);
                    console.error("Response status:", error.response.status);
                    console.error("Response headers:", error.response.headers);

                    if (error.response.data && error.response.data.message) {
                      errorMessage = error.response.data.message;
                    }
                  } else if (error.request) {
                    console.error(
                      "No response received. Request details:",
                      error.request
                    );
                  } else {
                    console.error(
                      "Error setting up the request:",
                      error.message
                    );
                  }

                  const errorEmbed = new EmbedBuilder()
                    .setColor("#ff0000")
                    .setTitle("Error")
                    .setDescription(errorMessage)
                    .setTimestamp();
                  interaction.followUp({
                    embeds: [errorEmbed],
                    ephemeral: true,
                  });
                });
            });

            collector.on("end", (collected) => {
              if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                  .setColor("#ff0000")
                  .setTitle("Timeout")
                  .setDescription("You did not provide any link.")
                  .setTimestamp();
                interaction.followUp({
                  embeds: [timeoutEmbed],
                  ephemeral: true,
                });
              }
            });
          }
        } catch (error) {
          console.error("Error in interaction collector:", error);

          const errorEmbed = new EmbedBuilder()
            .setColor("#ff0000")
            .setTitle("Error")
            .setDescription("An error occurred while processing your request.")
            .setTimestamp();
          interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        }
      });
    } catch (error) {
      console.error("Error in execute function:", error);

      const errorEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("Error")
        .setDescription("An error occurred while processing your request.")
        .setTimestamp();
      interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
