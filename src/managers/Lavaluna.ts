import EventEmitter from 'events'
import { APIPlayer, Track } from '../api/REST'
import { Exception, WebSocketClosedEvent } from '../api/WebSocket'
import { Node, NodeOptions } from '../structures/Node'
import { Player } from '../structures/Player'
import { NodeManager, SearchPlatform } from './NodeManager'

export class Lavaluna extends EventEmitter<LavalunaEvents> {
    /**
     * The Lavalink nodes.
     */
    public nodes: NodeManager = new NodeManager(this)

    private initialized: boolean = false

    constructor(public readonly options: LavalunaOptions) {
        if (!options) throw new TypeError('[Lavaluna] "options" is required.')
        if (typeof options.nodes === 'undefined' && !Array.isArray(options.nodes))
            throw new TypeError('[Lavaluna] "options.nodes" must be an array.')
        if (typeof options.clientName !== 'undefined' && typeof options.clientName !== 'string')
            throw new TypeError('[Lavaluna] "options.clientId" must be a string.')
        if (typeof options.clientName !== 'undefined' && typeof options.clientName !== 'string')
            throw new TypeError('[Lavaluna] "options.clientName" must be a string.')
        if (typeof options.defaultSearchPlatform !== 'undefined' && typeof options.defaultSearchPlatform !== 'string')
            throw new TypeError('[Lavaluna] "options.defaultSearchPlatform" must be a string.')
        if (typeof options.send !== 'function') throw new TypeError('[Lavaluna] "options.send" must be a function.')

        super()

        this.options.clientName = this.options.clientName ?? 'lavaluna.js'
        for (const nodeOptions of this.options.nodes) {
            this.nodes.create(nodeOptions)
        }
    }

    /**
     * Method to initialize the manager.
     *
     * @returns The initialized manager.
     */
    public initialize(clientId?: string): this {
        if (this.initialized) return

        if (typeof clientId !== 'undefined') this.options.clientId = clientId
        if (typeof this.options.clientId !== 'string' || !this.options.clientId)
            throw new TypeError('[Lavaluna#initialize] "clientId" must be a non-empty string.')

        for (const node of this.nodes.cache.values()) {
            try {
                node.connect()
            } catch (err) {
                this.emit('nodeError', node, err)
            }
        }

        this.initialized = true
        return this
    }

    /**
     * Shortcut for {@link NodeManager.search}.
     */
    public search = this.nodes.search

    /**
     * Sends voice data to the Lavalink server.
     *
     * @param data - The data to update voice state.
     * @returns The updated player.
     */
    public async updateVoiceState(data: DiscordVoicePacket): Promise<APIPlayer> {
        if ('t' in data && !['VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE'].includes(data.t)) return null

        const update: DiscordVoiceServer | DiscordVoiceState = data.d
        if (!update || (!('token' in update) && !('session_id' in update))) return null

        const player = this.nodes.getPlayer(update.guild_id)
        if (!player) return null

        if ('token' in update) {
            // VOICE_SERVER_UPDATE
            player.voiceState.token = update.token
            player.voiceState.endpoint = update.endpoint
        } else {
            // VOICE_STATE_UPDATE
            if (update.user_id !== this.options.clientId) {
                return null
            }

            if (update.channel_id) {
                if (player.voiceChannelId !== update.channel_id) {
                    // Player moved to voice channel.
                    this.emit('playerMove', player, player.voiceChannelId, update.channel_id)
                }

                player.voiceState.sessionId = update.session_id
                player.voiceChannelId = update.channel_id
            } else {
                // Player got disconnected.
                this.emit('playerDisconnect', player, player.voiceChannelId)

                player.voiceChannelId = null
                player.voiceState = Object.assign({})
                player.pause(true)
            }
        }

        if (['token', 'endpoint', 'sessionId'].every(key => key in player.voiceState)) {
            return await player.node.rest.updatePlayer(player.guildId, {
                voice: {
                    token: player.voiceState.token,
                    endpoint: player.voiceState.endpoint,
                    sessionId: player.voiceState.sessionId
                }
            })
        }
    }
}

export interface LavalunaEvents {
    nodeCreate: [node: Node]
    nodeDestroy: [node: Node]
    nodeConnect: [node: Node]
    nodeReconnect: [node: Node]
    nodeDisconnect: [node: Node, event: { code?: number; reason?: string }]
    nodeError: [node: Node, error: Error]
    nodeRaw: [node: Node, payload: unknown]
    playerCreate: [player: Player]
    playerDestroy: [player: Player]
    playerMove: [player: Player, oldChannelId: string, newChannelId: string]
    playerDisconnect: [player: Player, oldChannelId: string]
    playerQueueEnd: [player: Player, track: Track]
    playerTrackStart: [player: Player, track: Track]
    playerTrackEnd: [player: Player, track: Track]
    playerTrackStuck: [player: Player, track: Track, thresholdMs: number]
    playerTrackError: [player: Player, track: Track, exception: Exception]
    webSocketClosed: [player: Player, event: Partial<WebSocketClosedEvent>]
}

export interface LavalunaOptions {
    /**
     * The array of nodes to connect to.
     */
    nodes: NodeOptions[]

    /**
     * The client ID to use.
     */
    clientId?: string

    /**
     * Value to use for the `Client-Name` header.
     */
    clientName?: string

    /** The default search platform to use, can be "ytsearch", "ytmsearch", "scsearch", or your custom. */
    defaultSearchPlatform?: SearchPlatform

    /**
     * Function to send data to the shard.
     */
    send(id: string, payload: LavalunaOptionsSendPayload): void
}

export interface LavalunaOptionsSendPayload {
    /** The OP code */
    op: number
    d: {
        guild_id: string
        channel_id: string | null
        self_mute: boolean
        self_deaf: boolean
    }
}

export interface DiscordVoicePacket {
    /**
     * The type of packet.
     */
    t?: 'VOICE_SERVER_UPDATE' | 'VOICE_STATE_UPDATE'

    /**
     * The data of the packet.
     */
    d: DiscordVoiceState | DiscordVoiceServer
}

export interface DiscordVoiceServer {
    /**
     * The token to use.
     */
    token: string

    /**
     * The guild ID.
     */
    guild_id: string

    /**
     * The endpoint to use.
     */
    endpoint: string
}

export interface DiscordVoiceState {
    /**
     * The guild ID.
     */
    guild_id: string

    /**
     * The user ID.
     */
    user_id: string

    /**
     * The session ID.
     */
    session_id: string

    /**
     * The channel ID.
     */
    channel_id: string
}
