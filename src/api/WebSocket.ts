import { default as WS } from 'ws'
import { Track } from './REST'

function validateOptions(options: WebSocketOptions): void {
    if (!options) {
        throw new TypeError('You must specify the options for the WebSocket.')
    }

    if (typeof options.host !== 'string' || !options.host.length) {
        throw new TypeError('WebSocket host must be specified and be a non-empty string.')
    }

    if (typeof options.secure !== 'undefined' && typeof options.secure !== 'boolean') {
        throw new TypeError('WebSocket option "secure" must be a boolean.')
    }

    if (typeof options.version !== 'string') {
        throw new TypeError('WebSocket version must be specified and be a non-empty string.')
    }

    if (!options.headers) {
        throw new TypeError('You must specify the "headers" option for the WebSocket.')
    }

    if (typeof options.headers.authorization !== 'string' || !options.headers.authorization.length) {
        throw new TypeError('WebSocket authorization header must be specified and be a non-empty string.')
    }

    if (typeof options.headers.clientId !== 'string' || !options.headers.clientId.length) {
        throw new TypeError('WebSocket clientId header must be specified and be a non-empty string.')
    }

    if (typeof options.headers.clientName !== 'string' || !options.headers.clientName.length) {
        throw new TypeError('WebSocket clientName header must be specified and be a non-empty string.')
    }

    if (
        typeof options.headers.sessionId !== 'undefined' &&
        (options.headers.sessionId !== 'string' || !options.headers.sessionId.length)
    ) {
        throw new TypeError('WebSocket sessionId header must be a non-empty string.')
    }
}

export class WebSocket extends WS {
    public uri: string
    public secure: boolean
    public version: string
    public headers: WS.ClientOptions['headers']

    constructor(options: WebSocketOptions) {
        validateOptions(options)

        const uri = `ws${options.secure ? 's' : ''}://${options.host}/${options.version}/websocket`,
            headers = {
                Authorization: options.headers.authorization,
                'User-Id': options.headers.clientId,
                'Client-Name': options.headers.clientName,
                'Session-Id': options.headers.sessionId ?? null
            }

        super(uri, { headers })

        this.uri = uri
        this.secure = !!options.secure
        this.version = options.version
        this.headers = headers
    }
}

/**
 * Options for the WebSocket.
 */
export interface WebSocketOptions {
    /**
     * The host of the Lavalink node.
     */
    host: string

    /**
     * Whether to use TLS when connecting to the Lavalink node.
     */
    secure?: boolean

    /**
     * The version of the Lavalink node.
     */
    version: string

    /**
     * The headers to use when connecting to the Lavalink node.
     */
    headers: WebSocketHeaders
}

/**
 * Headers to use when connecting to the Lavalink node.
 */
export interface WebSocketHeaders {
    /**
     * The authorization token to use when connecting to the Lavalink node.
     */
    authorization: string

    /**
     * The user id of the client.
     */
    clientId: string

    /**
     * The name of the client.
     */
    clientName: string

    /**
     * The session id of the client.
     */
    sessionId?: string
}

/**
 * `ready` - Dispatched when you successfully connect to the Lavalink node.
 *
 * `playerUpdate` - Dispatched every x seconds with the latest player state.
 *
 * `stats` - Dispatched when the node sends stats once per minute.
 *
 * `event` - Dispatched when player or voice events occur.
 */
export type OP = ReadyOP | PlayerUpdateOP | StatsOP | (EventOP & Events)

/**
 * Dispatched by Lavalink upon successful connection and authorization.
 * Contains fields determining if resuming was successful, as well as the session id.
 */
export interface ReadyOP {
    op: 'ready'

    /**
     * Whether this session was resumed.
     */
    resumed: boolean

    /**
     * The Lavalink session id of this connection.
     * Not to be confused with a Discord voice session id.
     */
    sessionId: string
}

/**
 * Dispatched every x seconds (configurable in application.yml) with the current state of the player.
 */
export interface PlayerUpdateOP {
    op: 'playerUpdate'

    /**
     * The guild id of the player.
     */
    guildId: string

    /**
     * The player state.
     */
    state: APIPlayerState
}

export interface APIPlayerState {
    /**
     * Unix timestamp in milliseconds.
     */
    time: number

    /**
     * The position of the track in milliseconds.
     */
    position: number

    /**
     * Whether Lavalink is connected to the voice gateway.
     */
    connected: boolean

    /**
     * The ping of the node to the Discord voice server in milliseconds (`-1` if not connected).
     */
    ping: number
}

/**
 * A collection of statistics sent every minute.
 */
export interface StatsOP extends Stats {
    op: 'stats'
}

export interface Stats {
    /**
     * The amount of players connected to the node.
     */
    players: number

    /**
     * The amount of players playing a track.
     */
    playingPlayers: number

    /**
     * The uptime of the node in milliseconds.
     */
    uptime: number

    /**
     * The memory stats of the node.
     */
    memory: MemoryStats

    /**
     * The cpu stats of the node.
     */
    cpu: CPUStats

    /**
     * The frame stats of the node.
     * `null` if the node has no players or when retrieved via `/v4/stats`
     */
    frameStats?: FrameStats
}

export interface MemoryStats {
    /**
     * The amount of free memory in bytes.
     */
    free: number

    /**
     * The amount of used memory in bytes.
     */
    used: number

    /**
     * The amount of allocated memory in bytes.
     */
    allocated: number

    /**
     * The amount of reservable memory in bytes.
     */
    reservable: number
}

export interface CPUStats {
    /**
     * The amount of cores the node has.
     */
    cores: number

    /**
     * The system load of the node.
     */
    systemLoad: number

    /**
     * The load of Lavalink on the node.
     */
    lavalinkLoad: number
}

export interface FrameStats {
    /**
     * The amount of frames sent to Discord.
     */
    sent: number

    /**
     * The amount of frames that were nulled.
     */
    nulled: number

    /**
     * The difference between sent frames and the expected amount of frames.
     *
     * The expected amount of frames is 3000 (1 every 20 ms) per player.
     * If the deficit is negative, too many frames were sent, and if it's positive, not enough frames got sent.
     */
    deficit: number
}

/**
 * Server dispatched an event. See the {@link Events} for more information.
 */
export interface EventOP {
    op: 'event'

    /**
     * The type of event.
     */
    type: EventType

    /**
     * The guild id.
     */
    guildId: string
}

export type EventType =
    | 'TrackStartEvent'
    | 'TrackEndEvent'
    | 'TrackExceptionEvent'
    | 'TrackStuckEvent'
    | 'WebSocketClosedEvent'

export type Events = TrackStartEvent | TrackEndEvent | TrackExceptionEvent | TrackStuckEvent | WebSocketClosedEvent

/**
 * Dispatched when a track starts playing.
 */
export interface TrackStartEvent extends EventOP {
    type: 'TrackStartEvent'

    /**
     * The track that started playing.
     */
    track: Track
}

/**
 * Dispatched when a track ends.
 */
export interface TrackEndEvent extends EventOP {
    type: 'TrackEndEvent'

    /**
     * The track that ended playing.
     */
    track: Track

    /**
     * The reason the track ended.
     *
     * `finished` - The track finished playing.
     *
     * `loadFailed` - The track failed to load.
     *
     * `stopped` - The track was stopped.
     *
     * `replaced` - The track was replaced.
     *
     * `cleanup` - The track was cleaned up.
     */
    reason: TrackEndReason
}

export type TrackEndReason = 'finished' | 'loadFailed' | 'stopped' | 'replaced' | 'cleanup'

/**
 * Dispatched when a track throws an exception.
 */
export interface TrackExceptionEvent extends EventOP {
    type: 'TrackExceptionEvent'

    /**
     * The track that threw the exception.
     */
    track: Track

    /**
     * The occurred exception.
     */
    exception: Exception
}

export interface Exception {
    /**
     * The message of the exception.
     */
    message: string

    /**
     * The severity of the exception.
     *
     * `common` - The cause is known and expected, indicates that there is nothing wrong with the library itself.
     *
     * `suspicious` - The cause might not be exactly known, but is possibly caused by outside factors.
     * For example when an outside service responds in a format that we do not expect.
     *
     * `fault` - The probable cause is an issue with the library or there is no way to tell what the cause might be.
     * This is the default level and other levels are used in cases where the thrower has more in-depth knowledge about the error.
     */
    severity: Severity

    /**
     * The cause of the exception.
     */
    cause: string
}

export type Severity = 'common' | 'suspicious' | 'fault'

/**
 * Dispatched when a track gets stuck while playing.
 */
export interface TrackStuckEvent extends EventOP {
    type: 'TrackStuckEvent'

    /**
     * The track that got stuck.
     */
    track: Track

    /**
     * The threshold in milliseconds that was exceeded.
     */
    thresholdMs: number
}

/**
 * Dispatched when an audio WebSocket (to Discord) is closed.
 * This can happen for various reasons (normal and abnormal), e.g. when using an expired voice server update.
 * 4xxx codes are usually bad. See the [Discord Docs](https://discord.com/developers/docs/topics/opcodes-and-status-codes#voice-voice-close-event-codes).
 */
export interface WebSocketClosedEvent extends EventOP {
    type: 'WebSocketClosedEvent'

    /**
     * The Discord close event code.
     */
    code: number

    /**
     * The close reason.
     */
    reason: string

    /**
     * Whether the connection was closed by Discord.
     */
    byRemote: boolean
}
