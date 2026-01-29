// index.js
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
} = require('discord.js');
const mercadopago = require('mercadopago');
const express = require('express');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===================== CONFIG MERCADO PAGO =====================
mercadopago.configurations = {
  access_token: process.env.MP_TOKEN // pega o token do Secret
};

// ===================== CONFIG EXPRESS (Webhook Mercado Pago) =====================
const app = express();
app.use(express.json());
const PORT = 3000;

app.post('/webhook', async (req, res) => {
  const data = req.body;
  if (data.type === 'payment') {
    const payment = await mercadopago.payment.findById(data.data.id);
    const userId = payment.response.metadata?.discord_user_id;
    if (payment.response.status === 'approved' && userId) {
      const guild = client.guilds.cache.get(process.env.GUILD_ID);
      const member = guild?.members.cache.get(userId);
      if (member) {
        member.roles.add(process.env.ROLE_VIP_ID).catch(console.error);
        console.log(`✅ Pagamento aprovado e role adicionada para ${member.user.tag}`);
      }
    }
  }
  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Webhook Mercado Pago rodando na porta ${PORT}`));

// ===================== VARIÁVEIS =====================
const ID_TRIPULACAO = '1135043768211492874';
const sorteios = new Map();
const panelData = new Map();

// ===================== READY =====================
client.once('ready', () => console.log('🤖 Bot online'));

// ===================== COMANDOS =====================
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // ------------------- +painel -------------------
  if (message.content.toLowerCase() === '+painel') {
    panelData.set(message.author.id, { embed: new EmbedBuilder().setTimestamp(), fields: [] });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('set_title').setLabel('Título & Descrição').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('set_color').setLabel('Cor do Embed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('set_image').setLabel('Imagem').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('add_field').setLabel('Adicionar Campo').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('set_mention').setLabel('Mencionar @').setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('set_payment').setLabel('Preço & Pagamento').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('remove_field').setLabel('Remover Campo').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('preview_send').setLabel('Preview & Enviar').setStyle(ButtonStyle.Danger)
    );

    return message.channel.send({
      content: '🛠️ **Painel de Atualização do Servidor (Dyno Style)**',
      components: [row1, row2]
    });
  }

  // ------------------- +sorteio -------------------
  const args = message.content.split(' ');
  if (args[0] === '+sorteio') {
    const quantidade = args[1];
    const tipo = args[2];
    const vencedoresQtd = parseInt(args[3]);
    const condicao = args[4];

    if (!quantidade || !tipo || isNaN(vencedoresQtd) || !condicao) {
      return message.reply('❌ Use: `+sorteio <quantidade> <tipo> <vencedores> <condição>`');
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 Sorteio iniciado!')
      .setDescription(
        `Chegou a sua hora de concorrer à **${quantidade} ${tipo}**.\n\n` +
        `🏆 **Vencedores:** ${vencedoresQtd}\n\n` +
        `📌 **Condição:** ${condicao.toLowerCase() === 'não' ? 'Clique no botão 🎉 para participar.' : 'Verifique as condições no servidor.'}`
      )
      .setColor(0x5865F2)
      .setImage('https://i.imgur.com/XW5E8N4.png')
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participar_sorteio').setLabel('🎉 Participar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('sortear_sorteio').setLabel('🎯 Sortear').setStyle(ButtonStyle.Danger)
    );

    const msg = await message.channel.send({
      content: `<@&${ID_TRIPULACAO}>`,
      embeds: [embed],
      components: [row]
    });

    sorteios.set(msg.id, { vencedores: vencedoresQtd, participantes: [] });
  }
});

// ===================== INTERAÇÕES =====================
client.on(Events.InteractionCreate, async interaction => {
  const data = panelData.get(interaction.user.id);

  // ------------------- Painel -------------------
  if (interaction.isButton() && data) {
    switch(interaction.customId) {
      case 'set_title': {
        const modal = new ModalBuilder().setCustomId('modal_title').setTitle('Título & Descrição');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('titulo').setLabel('Título do Embed').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('descricao').setLabel('Descrição do Embed').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        return interaction.showModal(modal);
      }
      case 'set_color': {
        const modal = new ModalBuilder().setCustomId('modal_color').setTitle('Cor do Embed');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cor').setLabel('Digite a cor (#ff0000)').setStyle(TextInputStyle.Short).setRequired(true)));
        return interaction.showModal(modal);
      }
      case 'set_image': {
        const modal = new ModalBuilder().setCustomId('modal_image').setTitle('Imagem do Embed');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imagem').setLabel('URL da imagem').setStyle(TextInputStyle.Short).setRequired(false)));
        return interaction.showModal(modal);
      }
      case 'add_field': {
        const modal = new ModalBuilder().setCustomId('modal_field').setTitle('Adicionar Campo Extra');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('field_name').setLabel('Nome do campo').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('field_value').setLabel('Valor do campo').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        return interaction.showModal(modal);
      }
      case 'remove_field': {
        if (data.fields.length === 0) return interaction.reply({ content: '⚠️ Nenhum campo para remover!', ephemeral: true });
        data.fields.pop();
        data.embed.setFields(data.fields);
        return interaction.reply({ content: '✅ Campo removido!', ephemeral: true });
      }
      case 'set_mention': {
        const modal = new ModalBuilder().setCustomId('modal_mention').setTitle('Mencionar @');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mencao').setLabel('Ex: @everyone ou @Cargo').setStyle(TextInputStyle.Short).setRequired(false)));
        return interaction.showModal(modal);
      }
      case 'set_payment': {
        const modal = new ModalBuilder().setCustomId('modal_payment').setTitle('Preço & Pagamento');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('valor').setLabel('Digite o valor (R$)').setStyle(TextInputStyle.Short).setRequired(true)));
        return interaction.showModal(modal);
      }
      case 'preview_send': {
        return interaction.reply({ content: data.mencao || '', embeds: [data.embed], ephemeral: false });
      }
    }
  }

  // ------------------- Modals -------------------
  if (interaction.type === InteractionType.ModalSubmit && data) {
    switch(interaction.customId) {
      case 'modal_title': {
        const titulo = interaction.fields.getTextInputValue('titulo');
        const descricao = interaction.fields.getTextInputValue('descricao');
        data.embed.setTitle(titulo).setDescription(descricao);
        return interaction.reply({ content: '✅ Título e descrição atualizados!', ephemeral: true });
      }
      case 'modal_color': {
        const cor = interaction.fields.getTextInputValue('cor');
        data.embed.setColor(cor);
        return interaction.reply({ content: '✅ Cor atualizada!', ephemeral: true });
      }
      case 'modal_image': {
        const imagem = interaction.fields.getTextInputValue('imagem');
        if (imagem) data.embed.setImage(imagem);
        return interaction.reply({ content: '✅ Imagem atualizada!', ephemeral: true });
      }
      case 'modal_field': {
        const nome = interaction.fields.getTextInputValue('field_name');
        const valor = interaction.fields.getTextInputValue('field_value');
        data.fields.push({ name: nome, value: valor, inline: false });
        data.embed.setFields(data.fields);
        return interaction.reply({ content: '✅ Campo adicionado!', ephemeral: true });
      }
      case 'modal_mention': {
        data.mencao = interaction.fields.getTextInputValue('mencao');
        return interaction.reply({ content: '✅ Menção configurada!', ephemeral: true });
      }
      case 'modal_payment': {
        const valor = interaction.fields.getTextInputValue('valor');
        data.embed.addFields({ name: '💰 Preço', value: `R$ ${valor}`, inline: true });
        return interaction.reply({ content: '✅ Preço adicionado!', ephemeral: true });
      }
    }
  }

  // ------------------- Sorteio -------------------
  if (interaction.isButton()) {
    const sorteio = sorteios.get(interaction.message.id);
    if (!sorteio) return;

    if (interaction.customId === 'participar_sorteio') {
      if (sorteio.participantes.includes(interaction.user.id))
        return interaction.reply({ content: '⚠️ Você já está participando!', ephemeral: true });
      sorteio.participantes.push(interaction.user.id);
      return interaction.reply({ content: '✅ Você entrou no sorteio! Boa sorte 🍀', ephemeral: true });
    }

    if (interaction.customId === 'sortear_sorteio') {
      const isDono = interaction.guild.ownerId === interaction.user.id;
      const isStaff = interaction.member.roles.cache.has(ID_TRIPULACAO);
      if (!isStaff && !isDono)
        return interaction.reply({ content: '❌ Apenas staff ou dono pode sortear.', ephemeral: true });

      if (sorteio.participantes.length === 0)
        return interaction.reply({ content: '⚠️ Não há participantes!', ephemeral: true });

      const vencedores = [];
      const participantes = [...sorteio.participantes];

      while (vencedores.length < sorteio.vencedores && participantes.length > 0) {
        const index = Math.floor(Math.random() * participantes.length);
        vencedores.push(participantes.splice(index, 1)[0]);
      }

      sorteios.delete(interaction.message.id);
      await interaction.message.edit({ components: [] });

      return interaction.reply({
        content: `🎉 **SORTEIO FINALIZADO!** 🎉\n🏆 **Vencedores:**\n${vencedores.map(id => `<@${id}>`).join('\n')}`
      });
    }
  }
});

// ===================== LOGIN =====================
client.login(process.env.token);
