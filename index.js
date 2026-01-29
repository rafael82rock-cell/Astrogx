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

// ===================== EXPRESS (RENDER + WEBHOOK) =====================
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot online 🚀");
});

app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;

    if (data.type === "payment") {
      const payment = await mercadopago.payment.findById(data.data.id);
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
      embed: new EmbedBuilder().setTimestamp(),
      fields: []
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
  if (interaction.isButton()) {
    const sorteio = sorteios.get(interaction.message.id);

    if (interaction.customId === "participar_sorteio" && sorteio) {
      if (sorteio.participantes.includes(interaction.user.id))
        return interaction.reply({ content: "⚠️ Você já está participando!", ephemeral: true });

      sorteio.participantes.push(interaction.user.id);
      return interaction.reply({ content: "✅ Participação confirmada!", ephemeral: true });
    }

    if (interaction.customId === "sortear_sorteio" && sorteio) {
      const vencedores = [];
      const participantes = [...sorteio.participantes];

      while (vencedores.length < sorteio.vencedores && participantes.length > 0) {
        const index = Math.floor(Math.random() * participantes.length);
        vencedores.push(participantes.splice(index, 1)[0]);
      }

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
