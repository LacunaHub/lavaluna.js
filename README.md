# About

**lavaluna.js** is Lavalink client for Node.js, inspired by [erela.js](https://github.com/MenuDocs/erela.js).

# Requirements

-   Lavalink v4 (see [releases](https://github.com/lavalink-devs/Lavalink/releases))
-   Java 17 LTS or newer - [Azul](https://www.azul.com/downloads/zulu-community/?architecture=x86-64-bit&package=jdk), [Adopt](https://adoptopenjdk.net/) or [sdkman](https://sdkman.io/install)

# Documentation

-   Link

# Installation

```bash
npm install lavaluna.js
```

_Developed and tested on Node.js v18_

# Usage

```js
const { Client, GatewayIntentBits } = require('discord.js')
const { LavalunaManager } = require('lavaluna.js')

// Initiate discord.js client
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
})

// Assign manager to the client
client.lava = new LavalunaManager({
    // Lavalink nodes
    nodes: [
        {
            hostname: 'lavalink-v4.teramont.net',
            port: 443,
            password: 'eHKuFcz67k4lBS64',
            secure: true
        }
    ],
    // Method to send voice data to Discord
    send: (id, payload) => {
        const guild = client.guilds.cache.get(id)
        // for eris you need JSON.stringify() the payload
        guild && guild.shard.send(payload)
    }
})

// Emitted whenever a node connects
client.lava.on('nodeConnect', node => {
    console.log(`Node "${node.options.identifier}" connected.`)
})

// Emitted whenever a node encountered an error
client.lava.on('nodeError', (node, error) => {
    console.log(`Node "${node.options.identifier}" encountered an error: ${error.message}.`)
})

// Listen for when the client becomes ready
client.once('ready', () => {
    // Initiates the manager and connects to all the nodes
    client.lava.init(client.user.id)
    console.log(`Logged in as ${client.user.tag}`)
})

// THIS IS REQUIRED. Send raw events to lavaluna.js
client.on('raw', d => client.lava.updateVoiceState(d))

// Listen for interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.inGuild() || interaction.inRawGuild()) return

    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'play') {
            const query = interaction.options.getString('query')
            const voice = interaction.member.voice?.channel

            if (!voice) {
                await interaction.reply('You need to be in a voice channel to use this command!')

                return
            }

            await interaction.deferReply()

            let search

            try {
                search = await client.lava.search({ query })
            } catch (err) {
                await interaction.editReply(`Failed to search for tracks: ${err.message}`)

                return
            }

            if (search.loadType === 'error') {
                await interaction.editReply(`Failed to load: ${search.data.message}`)

                return
            }

            if (search.loadType === 'empty') {
                await interaction.editReply('No results found')

                return
            }

            const player = client.lava.nodes.createPlayer({
                guildId: interaction.guildId,
                voiceChannelId: voice.id,
                textChannelId: interaction.channelId
            })

            if (search.loadType === 'playlist') {
                player.queue.add(search.tracks)

                await interaction.editReply(
                    `Added playlist: **${search.playlistInfo.name}** to the queue (${search.tracks.length} tracks)`
                )
            }

            if (search.loadType === 'track' || search.loadType === 'search') {
                player.queue.add(search.tracks[0])

                await interaction.editReply(`Added track: **${search.tracks[0].info.title}** to the queue`)
            }

            if (player.state !== 'CONNECTED') player.connect()
            if (!player.playing) await player.play()
        }
    }
})

// Finally, login
client.login('your bot token here')
```

# License

This project is licensed under the [MIT License](https://github.com/LacunaHub/lavaluna.js/blob/master/LICENSE)
