const { Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ThreadAutoArchiveDuration } = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

// Configurations
const TOKEN = 'MTI5OTQ1MzUyNTI3MjY5NDg3NQ.G6B_ZP.NFHnhL74hbmp3hK90QbOoAqKK57eudaIB_TWxU'; // Ton token
const CATEGORY_ID = '1296664881033908236'; // ID de la catégorie pour les tickets
const LOG_CHANNEL_ID = '1296664882246193263'; // ID du salon pour les logs

client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.channel.type === ChannelType.DM && !message.author.bot) {
        const guild = client.guilds.cache.first();
        const existingChannel = guild.channels.cache.find(channel => channel.topic === `Modmail pour ${message.author.id}`);

        if (existingChannel) {
            // Relaye le message dans le salon existant pour cet utilisateur
            existingChannel.send(`**${message.author.tag}** : ${message.content}`);
        } else {
            // Crée un nouveau salon pour cet utilisateur dans la catégorie définie
            const modmailChannel = await guild.channels.create({
                name: `modmail-${message.author.username}`,
                type: ChannelType.GuildText,
                parent: CATEGORY_ID,
                topic: `Modmail pour ${message.author.id}`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                ],
            });

            // Bouton pour fermer le ticket
            const closeButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close')
                    .setLabel('Fermer')
                    .setStyle(ButtonStyle.Danger)
            );

            // Envoie le message initial avec le bouton
            await modmailChannel.send({
                content: `**Nouveau modmail de ${message.author.tag}**\n${message.content}`,
                components: [closeButton],
            });
        }
    } else if (message.channel.parentId === CATEGORY_ID && !message.author.bot) {
        // Relaye les messages du salon de modération vers l'utilisateur concerné
        const userId = message.channel.topic.split(' ')[2];
        const user = await client.users.fetch(userId);
        
        if (user) {
            // Envoie le message au créateur du modmail avec le nom du rôle du modérateur
            const member = await message.guild.members.fetch(message.author.id);
            const roleName = member.roles.cache
                .filter(role => role.name !== '@everyone')
                .map(role => role.name)
                .join(', ') || 'Modérateur';
            
            user.send(`**${roleName}** : ${message.content}`);
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'close') {
        const channel = interaction.channel;
        const userId = channel.topic.split(' ')[2];
        const user = await client.users.fetch(userId);

        // Envoie un message de fermeture à l'utilisateur
        if (user) {
            await user.send("Votre ticket de support a été fermé par l'équipe de modération.");
        }

        // Envoie les logs dans un thread dans le salon de logs
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const thread = await logChannel.threads.create({
                name: `Modmail - ${user.username}`,
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            });

            const messages = await channel.messages.fetch({ limit: 100 });
            const logMessages = messages.reverse().map(msg => {
                const member = channel.guild.members.cache.get(msg.author.id);
                const roleName = member ? member.roles.cache.filter(role => role.name !== '@everyone').map(role => role.name).join(', ') : 'Utilisateur';
                return `${roleName} (${msg.author.tag}): ${msg.content}`;
            }).join('\n');

            await thread.send(`Le modmail de **${user.tag}** a été fermé.\nLogs :\n${logMessages}`);
        }

        // Supprime le salon modmail
        await channel.delete();
    }
});

client.login(TOKEN);