import { Pool } from 'undici'
import { OPEN } from 'ws'
import { REST } from '../api/REST'
import { EventOP, Events, OP, Stats, WebSocket } from '../api/WebSocket'
import { Lavaluna } from '../managers/Lavaluna'
import { PlayerManager } from '../managers/PlayerManager'

function validateOptions(options: NodeOptions) {
    if (!options) {
        throw new TypeError('You must specify the options for the Node.')
    }

    if (typeof options.hostname !== 'string' || !options.hostname.length) {
        throw new TypeError('Node hostname must be specified and be a non-empty string.')
    }

    if (typeof options.port !== 'number') {
        throw new TypeError('Node port must be a number.')
    }

    if (typeof options.name !== 'undefined' && typeof options.name !== 'string') {
        throw new TypeError('Node name must be a string.')
    }

    if (typeof options.secure !== 'undefined' && typeof options.secure !== 'boolean') {
        throw new TypeError('Node option "secure" must be a boolean.')
    }

    if (typeof options.reconnectRetryAmount !== 'undefined' && typeof options.reconnectRetryAmount !== 'number') {
        throw new TypeError('Node option "reconnectRetryAmount" must be a number.')
    }

    if (typeof options.reconnectRetryDelay !== 'undefined' && typeof options.reconnectRetryDelay !== 'number') {
        throw new TypeError('Node option "reconnectRetryDelay" must be a number.')
    }

    if (typeof options.rest !== 'undefined') {
        if (typeof options.rest.requestTimeout !== 'undefined' && typeof options.rest.requestTimeout !== 'number') {
            throw new TypeError('Node option "rest.requestTimeout" must be a number.')
        }
    }

    if (typeof options.version !== 'undefined' && typeof options.version !== 'string') {
        throw new TypeError('Node version must be a string.')
    }
}

export class Node {
    /**
     * Session ID of the connection.
     */
    public sessionId: string | null = null

    /**
     * WebSocket connection.
     */
    public ws: WebSocket | null = null

    /**
     * REST manager.
     */
    public rest: REST | null = null

    /**
     * Node stats.
     */
    public stats: Stats = {
        players: 0,
        playingPlayers: 0,
        uptime: 0,
        memory: {
            free: 0,
            used: 0,
            allocated: 0,
            reservable: 0
        },
        cpu: {
            cores: 0,
            systemLoad: 0,
            lavalinkLoad: 0
        },
        frameStats: {
            sent: 0,
            nulled: 0,
            deficit: 0
        }
    }

    /**
     * Player manager of the Node.
     */
    public players: PlayerManager

    /**
     * The host of the Node.
     */
    public get host(): string {
        return `${this.options.hostname}:${this.options.port}`
    }

    /**
     * Whether the Node is connected.
     */
    public get connected(): boolean {
        return this.ws?.readyState === OPEN
    }

    private reconnectTimeout: NodeJS.Timeout | null = null
    private reconnectAttempts = 0

    constructor(
        public manager: Lavaluna,
        public readonly options: NodeOptions
    ) {
        validateOptions(options)

        this.options.name = this.options.name || this.options.hostname

        if (this.manager.nodes.cache.has(this.options.name)) {
            return this.manager.nodes.cache.get(this.options.name)
        }

        if (this.options.secure) {
            this.options.port = 443
        }

        this.options.reconnectRetryAmount = this.options.reconnectRetryAmount ?? 5
        this.options.reconnectRetryDelay = this.options.reconnectRetryDelay ?? 1000 * 30
        this.options.version = 'v4'

        this.players = new PlayerManager(this)

        this.manager.nodes.add(this.options.name, this)
        this.manager.emit('nodeCreate', this)
    }

    /**
     * Connects to the WebSocket and sets up event listeners for open, close, error, and message events.
     */
    public connect() {
        if (this.connected) return

        this.ws = new WebSocket({
            host: this.host,
            secure: this.options.secure,
            version: this.options.version,
            headers: {
                authorization: this.options.password,
                clientId: this.manager.options.clientId,
                clientName: this.manager.options.clientName
            }
        })

        this.ws.on('open', () => {
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout)
            }

            this.manager.emit('nodeConnect', this)
        })

        this.ws.on('close', (code, data) => {
            const reason = data.toString()

            if (code !== 1000 || reason !== 'destroy') {
                this.reconnect()
            }

            this.manager.emit('nodeDisconnect', this, { code, reason })
        })

        this.ws.on('error', error => {
            this.manager.emit('nodeError', this, error)
        })

        this.ws.on('message', data => {
            const payload: OP = JSON.parse(data.toString())

            switch (payload.op) {
                case 'ready':
                    this.sessionId = payload.sessionId
                    this.rest = new REST({
                        host: this.host,
                        secure: this.options.secure,
                        version: this.options.version,
                        sessionId: this.sessionId,
                        headers: {
                            authorization: this.options.password
                        },
                        poolOptions: this.options.rest?.poolOptions,
                        requestTimeout: this.options.rest?.requestTimeout
                    })

                    break
                case 'playerUpdate':
                    const player = this.players.cache.get(payload.guildId)
                    player && (player.position = payload.state.position)

                    break
                case 'stats':
                    delete payload.op
                    this.stats = { ...payload }

                    break
                case 'event':
                    this.handleEvent(payload)

                    break
                default:
                    this.manager.emit(
                        'nodeError',
                        this,
                        new Error(`[Node#message] Unexpected OP with data: ${JSON.stringify(payload)}`)
                    )
            }
        })
    }

    /**
     * A method to destroy the WebSocket connection.
     *
     * @returns A promise that resolves to a boolean indicating the success of the destruction.
     */
    public async destroy(): Promise<boolean> {
        if (!this.connected) return

        for (const [, player] of this.players.cache) {
            await player.destroy()
        }

        this.ws.close(1000, Buffer.from('destroy', 'utf-8'))
        this.ws.removeAllListeners()
        this.ws = null

        this.reconnectAttempts = 0
        clearTimeout(this.reconnectTimeout)

        this.manager.emit('nodeDestroy', this)

        return this.manager.nodes.cache.delete(this.options.name)
    }

    /**
     * Reconnects the WebSocket connection after a specified delay, and emits events based on the reconnection status.
     */
    private reconnect(): void {
        this.reconnectTimeout = setTimeout(() => {
            if (this.reconnectAttempts >= this.options.reconnectRetryAmount) {
                const error = new Error(`[Node#reconnect] Unable to connect after ${this.reconnectAttempts} attempts.`)

                this.manager.emit('nodeError', this, error)
                return this.destroy()
            }

            this.ws.removeAllListeners()
            this.ws = null

            this.manager.emit('nodeReconnect', this)
            this.connect()
            this.reconnectAttempts++
        }, this.options.reconnectRetryDelay)
    }

    /**
     * Handles various events related to player tracks.
     *
     * @param event - The event to be handled.
     */
    private handleEvent(event: EventOP & Events): void {
        const player = this.players.cache.get(event.guildId)

        if (!player) return

        const track = player.queue.at(player.queue.position)

        if (event.type === 'TrackStartEvent') {
            player.playing = true
            player.paused = false

            this.manager.emit('playerTrackStart', player, track)
        } else if (event.type === 'TrackEndEvent') {
            // If a track was forcibly played
            if (event.reason === 'replaced') {
                this.manager.emit('playerTrackEnd', player, track)

                return
            }

            if (player.repeatMode === 'TRACK') {
                if (event.reason === 'stopped') {
                    player.queue.position++
                }
            } else if (player.repeatMode === 'QUEUE') {
                player.queue.position++

                if (!player.queue.current) {
                    player.queue.position = 0
                }
            } else {
                player.queue.position++
            }

            if (!player.queue.current) return player.queue.end(player, track)

            this.manager.emit('playerTrackEnd', player, track)
            player.play()
        } else if (event.type === 'TrackExceptionEvent') {
            player.stop()
            this.manager.emit('playerTrackError', player, track, event.exception)
        } else if (event.type === 'TrackStuckEvent') {
            player.stop()
            this.manager.emit('playerTrackStuck', player, track, event.thresholdMs)
        } else if (event.type === 'WebSocketClosedEvent') {
            this.manager.emit('webSocketClosed', player, {
                code: event.code,
                byRemote: event.byRemote,
                reason: event.reason
            })
        } else {
            this.manager.emit(
                'nodeError',
                this,
                new Error(`[Node#handleEvent] Unexpected OP with data: ${JSON.stringify(event)}`)
            )
        }
    }
}

export interface NodeOptions {
    /**
     * The hostname for the node.
     */
    hostname: string

    /**
     * The port for the node.
     */
    port: number

    /**
     * The password for the node.
     */
    password: string

    /**
     * The name of the node.
     */
    name?: string

    /**
     * Whether the host uses SSL.
     */
    secure?: boolean

    /**
     * The retryAmount for the node.
     */
    reconnectRetryAmount?: number

    /**
     * The retryDelay for the node.
     */
    reconnectRetryDelay?: number

    /**
     * Options for the REST
     */
    rest?: NodeRESTOptions

    /**
     * Version of the Lavalink.
     */
    version?: 'v4'
}

export interface NodeRESTOptions {
    /**
     * Options for the Pool
     */
    poolOptions?: Pool.Options

    /**
     * Timeout for the REST request
     */
    requestTimeout?: number
}
