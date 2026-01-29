// ===================== IMPORTS =====================
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
  InteractionType
} = require("discord.js");

const mercadopago = require("mercadopago");
const express = require("express");

// ===================== DISCORD CLIENT =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===================== MERCADO PAGO =====================
mercadopago.configurations = {
  access_token: process.env.MP_TOKEN
};

// ===================== EXPRESS (RENDER / WEBHOOK) =====================
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot online 🚀");
});

app.post("/webhook", async (req, res) => {
  try {
    if (req.body.type === "payment") {
      const payment = await mercadopago.payment.findById(req.body.data.id);
      const userId = payment.response.metadata?.discord_user_id;

      if (payment.response.status === "approved" && userId) {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const member = guild?.members.cache.get(userId);

        if (member) {
          await member.roles.add(process.env.ROLE_VIP_ID);
          console.log(`✅ VIP entregue para ${member.user.tag}`);
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});

// ===================== VARIÁVEIS =====================
const ID_TRIPULACAO = "1135043768211492874";
const sorteios = new Map();
const panelData = new Map();

// ===================== READY =====================
client.once("ready", () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
});

// ===================== COMANDOS =====================
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  // ---------- +painel ----------
  if (message.content.toLowerCase() === "+painel") {
    panelData.set(message.author.id, {
      embed: new EmbedBuilder()
        .setColor(0x5865F2)
        .setImage("https://i.imgur.com/XW5E8N4.png")
        .setTimestamp(),
      fields: [],
      mencao: ""
    });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("set_title").setLabel("Título & Descrição").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("set_color").setLabel("Cor").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("set_image").setLabel("Imagem").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("add_field").setLabel("Adicionar Campo").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("set_mention").setLabel("Mencionar @").setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("set_payment").setLabel("Preço").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("remove_field").setLabel("Remover Campo").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("preview_send").setLabel("Preview & Enviar").setStyle(ButtonStyle.Danger)
    );

    return message.channel.send({
      content: "🛠️ **Painel de Atualização do Servidor**",
      components: [row1, row2]
    });
  }

  // ---------- +sorteio ----------
  const args = message.content.split(" ");
  if (args[0] === "+sorteio") {
    const quantidade = args[1];
    const tipo = args[2];
    const vencedoresQtd = parseInt(args[3]);
    const condicao = args[4];

    if (!quantidade || !tipo || isNaN(vencedoresQtd) || !condicao) {
      return message.reply("❌ Use: `+sorteio <quantidade> <tipo> <vencedores> <condição>`");
    }

    const embed = new EmbedBuilder()
      .setTitle("🎉 Sorteio iniciado!")
      .setDescription(
        `🎁 **Prêmio:** ${quantidade} ${tipo}\n` +
        `🏆 **Vencedores:** ${vencedoresQtd}\n` +
        `📌 **Condição:** ${condicao}`
      )
      .setColor(0x5865F2)
      .setImage("https://i.imgur.com/XW5E8N4.png")
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("participar_sorteio").setLabel("🎉 Participar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("sortear_sorteio").setLabel("🎯 Sortear").setStyle(ButtonStyle.Danger)
    );

    const msg = await message.channel.send({
      content: `<@&${ID_TRIPULACAO}>`,
      embeds: [embed],
      components: [row]
    });

    sorteios.set(msg.id, {
      vencedores: vencedoresQtd,
      participantes: []
    });
  }
});

// ===================== INTERAÇÕES =====================
client.on(Events.InteractionCreate, async interaction => {
  const data = panelData.get(interaction.user.id);

  // ---------- BOTÕES DO PAINEL ----------
  if (interaction.isButton() && data) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    switch (interaction.customId) {
      case "set_title": {
        const modal = new ModalBuilder()
          .setCustomId("modal_title")
          .setTitle("Título & Descrição");

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("titulo")
              .setLabel("Título")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("descricao")
              .setLabel("Descrição")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );

        return interaction.showModal(modal);
      }

      case "preview_send": {
        return interaction.followUp({
          content: data.mencao || "",
          embeds: [data.embed]
        });
      }
    }
  }

  // ---------- MODALS ----------
  if (interaction.type === InteractionType.ModalSubmit && data) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    if (interaction.customId === "modal_title") {
      data.embed
        .setTitle(interaction.fields.getTextInputValue("titulo"))
        .setDescription(interaction.fields.getTextInputValue("descricao"));

      return interaction.followUp({ content: "✅ Atualizado!" });
    }
  }

  // ---------- SORTEIO ----------
  if (interaction.isButton()) {
    const sorteio = sorteios.get(interaction.message.id);
    if (!sorteio) return;

    if (interaction.customId === "participar_sorteio") {
      if (sorteio.participantes.includes(interaction.user.id)) {
        return interaction.reply({ content: "⚠️ Você já participa!", ephemeral: true });
      }

      sorteio.participantes.push(interaction.user.id);
      return interaction.reply({ content: "✅ Você entrou no sorteio!", ephemeral: true });
    }

    if (interaction.customId === "sortear_sorteio") {
      const vencedores = sorteio.participantes
        .sort(() => 0.5 - Math.random())
        .slice(0, sorteio.vencedores);

      sorteios.delete(interaction.message.id);
      await interaction.message.edit({ components: [] });

      return interaction.reply({
        content: `🎉 **VENCEDORES:**\n${vencedores.map(id => `<@${id}>`).join("\n")}`
      });
    }
  }
});

// ===================== LOGIN =====================
client.login(process.env.TOKEN);
