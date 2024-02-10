import { Dispatcher, Pool } from 'undici'
import { APIPlayerState, Exception, Stats } from './WebSocket'

function validateOptions(options: RESTOptions): void {
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

    if (typeof options.sessionId !== 'string') {
        throw new TypeError('WebSocket sessionId must be specified and be a non-empty string.')
    }

    if (!options.headers) {
        throw new TypeError('You must specify the "headers" option for the WebSocket.')
    }

    if (typeof options.headers.authorization !== 'string' || !options.headers.authorization.length) {
        throw new TypeError('WebSocket authorization header must be specified and be a non-empty string.')
    }

    if (typeof options.requestTimeout !== 'undefined' && typeof options.requestTimeout !== 'number') {
        throw new TypeError('WebSocket port must be a number.')
    }
}

export class REST extends Pool {
    public uri: string
    public secure: boolean
    public version: string
    public sessionId: string
    public headers: Dispatcher.RequestOptions['headers']
    public requestTimeout: number

    constructor(options: RESTOptions) {
        validateOptions(options)

        const uri = `http${options.secure ? 's' : ''}://${options.host}`

        super(uri, options.poolOptions)

        this.uri = uri
        this.secure = !!options.secure
        this.version = options.version
        this.sessionId = options.sessionId
        this.headers = {
            Authorization: options.headers.authorization
        }
        this.requestTimeout = options.requestTimeout
    }

    /**
     * A function to make a request to a specified endpoint with optional request modifications.
     *
     * @param endpoint - the endpoint to make the request to.
     * @param [modify] - optional function to modify the request options.
     * @returns A promise that resolves with the response data of type T.
     */
    public async makeRequest<T>(endpoint: string, modify?: ModifyRequest): Promise<T> {
        const options: Dispatcher.RequestOptions = {
            path: `/${this.version}/${endpoint.replace(/^\//gm, '')}`,
            method: 'GET',
            headers: this.headers,
            headersTimeout: this.requestTimeout
        }

        modify?.(options)

        const request = await this.request(options)

        try {
            return (await request.body.json()) as T
        } catch (err) {
            return null
        }
    }

    /**
     * Loads tracks based on the provided identifier.
     *
     * @param identifier - The identifier used to load tracks.
     * @returns A promise that resolves to the result of loading the tracks.
     */
    public async loadTracks(identifier: string): Promise<TrackLoadingResult> {
        try {
            return await this.makeRequest(`/loadtracks?identifier=${encodeURIComponent(identifier)}`)
        } catch (err) {
            throw new Error(`[Node#loadTracks] ${err.message}`, { cause: err })
        }
    }

    /**
     * Decode a track from the given encoded string.
     *
     * @param encodedTrack - the encoded string representing the track.
     * @returns a promise that resolves to the decoded track.
     */
    public async decodeTrack(encodedTrack: string): Promise<Track> {
        try {
            return await this.makeRequest(`/decodetrack?encodedTrack=${encodeURIComponent(encodedTrack)}`)
        } catch (err) {
            throw new Error(`[Node#decodeTrack] ${err.message}`, { cause: err })
        }
    }

    /**
     * Decodes the given encoded tracks.
     *
     * @param encodedTracks - an array of encoded tracks to be decoded.
     * @returns A promise that resolves to an array of decoded tracks.
     */
    public async decodeTracks(encodedTracks: string[]): Promise<Track[]> {
        try {
            return await this.makeRequest('/decodetracks', request => {
                request.method = 'POST'
                request.body = JSON.stringify(encodedTracks)
                request.headers['Content-Type'] = 'application/json'
            })
        } catch (err) {
            throw new Error(`[Node#decodeTracks] ${err.message}`, { cause: err })
        }
    }

    /**
     * Retrieves a list of players for the current session.
     *
     * @returns A promise that resolves with an array of APIPlayer objects.
     */
    public async getPlayers(): Promise<APIPlayer[]> {
        try {
            return await this.makeRequest(`/sessions/${this.sessionId}/players`)
        } catch (err) {
            throw new Error(`[Node#getPlayers] ${err.message}`, { cause: err })
        }
    }

    /**
     * Retrieves a player for the given guild ID.
     *
     * @param guildId - the ID of the guild for which to retrieve the player.
     * @returns A promise that resolves with the retrieved player.
     */
    public async getPlayer(guildId: string): Promise<APIPlayer> {
        try {
            return await this.makeRequest(`/sessions/${this.sessionId}/players/${guildId}`)
        } catch (err) {
            throw new Error(`[Node#getPlayer] ${err.message}`, { cause: err })
        }
    }

    /**
     * Updates a player in the specified guild.
     *
     * @param guildId - the ID of the guild.
     * @param data - the data to update the player with.
     * @param [noReplace=false] - flag to specify if the player should not be replaced.
     * @returns A Promise that resolves to the updated player.
     */
    public async updatePlayer(guildId: string, data: UpdatePlayer, noReplace = false): Promise<APIPlayer> {
        try {
            return await this.makeRequest(
                `/sessions/${this.sessionId}/players/${guildId}?noReplace=${!!noReplace}`,
                request => {
                    request.method = 'PATCH'
                    request.body = JSON.stringify(data)
                    request.headers['Content-Type'] = 'application/json'
                }
            )
        } catch (err) {
            throw new Error(`[Node#updatePlayer] ${err.message}`, { cause: err })
        }
    }

    /**
     * Destroys a player in the specified guild.
     *
     * @param guildId - the ID of the guild to which the player belongs.
     * @returns The result of the destroy operation.
     */
    public async destroyPlayer(guildId: string) {
        try {
            return await this.makeRequest(`/sessions/${this.sessionId}/players/${guildId}`, request => {
                request.method = 'DELETE'
            })
        } catch (err) {
            console.log(err)
            throw new Error(`[Node#destroyPlayer] ${err.message}`, { cause: err })
        }
    }

    /**
     * Update a session with the provided data.
     *
     * @param data - the data to update the session with.
     * @returns The updated session.
     */
    public async updateSession(data: UpdateSession): Promise<UpdateSession> {
        try {
            return await this.makeRequest(`/sessions/${this.sessionId}`, request => {
                request.method = 'PATCH'
                request.body = JSON.stringify(data)
                request.headers['Content-Type'] = 'application/json'
            })
        } catch (err) {
            throw new Error(`[Node#updateSession] ${err.message}`, { cause: err })
        }
    }

    /**
     * Gets the information about the node.
     *
     * @returns The node information
     */
    public async getInfo(): Promise<NodeInfo> {
        try {
            return await this.makeRequest('/info')
        } catch (err) {
            throw new Error(`[Node#getInfo] ${err.message}`, { cause: err })
        }
    }

    /**
     * Retrieves the Node version.
     *
     * @returns The Node version.
     */
    public async getVersion(): Promise<NodeVersion> {
        try {
            return await this.makeRequest('/version', request => (request.path = request.path.replace(/^\/v\d+/, '')))
        } catch (err) {
            throw new Error(`[Node#getVersion] ${err.message}`, { cause: err })
        }
    }

    /**
     * Retrieves the statistics by making a request to the `/stats` endpoint.
     *
     * @returns The statistics data fetched from the endpoint.
     */
    public async getStats(): Promise<Stats> {
        try {
            return await this.makeRequest('/stats')
        } catch (err) {
            throw new Error(`[Node#getStats] ${err.message}`, { cause: err })
        }
    }
}

export interface RESTOptions {
    host: string
    secure?: boolean
    version: string
    sessionId: string
    headers: RESTHeaders
    poolOptions?: Pool.Options
    requestTimeout?: number
}

export interface RESTHeaders {
    authorization: string
}

export type ModifyRequest = (options: Dispatcher.RequestOptions) => void

export interface Track {
    /**
     * The base64 encoded track data.
     */
    encoded: string

    /**
     * Info about the track.
     */
    info: TrackInfo

    /**
     * Addition track info provided by plugins.
     */
    pluginInfo: object

    /**
     * Additional track data provided via the Update Player endpoint.
     */
    userData: object
}

export interface TrackInfo {
    /**
     * The track identifier.
     */
    identifier: string

    /**
     * Whether the track is seekable.
     */
    isSeekable: boolean

    /**
     * The track author.
     */
    author: string

    /**
     * The track length in milliseconds.
     */
    length: number

    /**
     * Whether the track is a stream.
     */
    isStream: boolean

    /**
     * The track position in milliseconds.
     */
    position: number

    /**
     * The track title.
     */
    title: string

    /**
     * The track uri.
     */
    uri: string | null

    /**
     * The track artwork url.
     */
    artworkUrl: string | null

    /**
     * The track ISRC.
     */
    isrc: string | null

    /**
     * The track source name.
     */
    sourceName: string
}

export interface PlaylistInfo {
    /**
     * The name of the playlist.
     */
    name: string

    /**
     * The selected track of the playlist (-1 if no track is selected).
     */
    selectedTrack: number
}

export type TrackLoadingResult =
    | TrackResultData
    | PlaylistResultData
    | SearchResultData
    | EmptyResultResult
    | ErrorResultData

export type LoadResultType = 'track' | 'playlist' | 'search' | 'empty' | 'error'

/**
 * A track has been loaded.
 */
export interface TrackResultData {
    loadType: 'track'
    data: Track
}

/**
 * A playlist has been loaded.
 */
export interface PlaylistResultData {
    loadType: 'playlist'
    data: {
        /**
         * The info of the playlist.
         */
        info: PlaylistInfo

        /**
         * Addition playlist info provided by plugins.
         */
        pluginInfo: object

        /**
         * The tracks of the playlist.
         */
        tracks: Track[]
    }
}

/**
 * A search result has been loaded.
 */
export interface SearchResultData {
    loadType: 'search'
    data: Track[]
}

/**
 * There has been no matches for your identifier.
 */
export interface EmptyResultResult {
    loadType: 'empty'
    data: object
}

/**
 * Loading has failed with an error.
 */
export interface ErrorResultData {
    loadType: 'error'
    data: Exception
}

export interface APIPlayer {
    /**
     * The guild id of the player.
     */
    guildId: string

    /**
     * The currently playing track.
     */
    track?: Track

    /**
     * The volume of the player, range 0-1000, in percentage.
     */
    volume: number

    /**
     * Whether the player is paused.
     */
    paused: boolean

    /**
     * The state of the player.
     */
    state: APIPlayerState

    /**
     * The voice state of the player.
     */
    voice: VoiceState

    /** The filters used by the player. */
    filters: Filters
}

export interface VoiceState {
    /**
     * The Discord voice token to authenticate with.
     */
    token: string

    /**
     * The Discord voice endpoint to connect to.
     */
    endpoint: string

    /**
     * The Discord voice session id to authenticate with.
     */
    sessionId: string
}

export interface Filters {
    /**
     * Adjusts the player volume from 0.0 to 5.0, where 1.0 is 100%.
     * Values >1.0 may cause clipping.
     */
    volume?: number

    /**
     * Adjusts 15 different bands.
     */
    equalizer?: EqualizerFilter[]

    /**
     * Eliminates part of a band, usually targeting vocals.
     */
    karaoke?: KaraokeFilter

    /**
     * Changes the speed, pitch, and rate.
     */
    timescale?: TimescaleFilter

    /**
     * Creates a shuddering effect, where the volume quickly oscillates.
     */
    tremolo?: TremoloFilter

    /**
     * Creates a shuddering effect, where the pitch quickly oscillates.
     */
    vibrato?: VibratoFilter

    /**
     * Rotates the audio around the stereo channels/user headphones (aka Audio Panning).
     */
    rotation?: RotationFilter

    /**
     * Distorts the audio.
     */
    distortion?: DistortionFilter

    /**
     * Mixes both channels (left and right).
     */
    channelMix?: ChannelMixFilter

    /**
     * Filters higher frequencies.
     */
    lowPass?: LowPassFilter

    /**
     * Filter plugin configurations.
     */
    pluginFilters?: {
        [key: string]: any
    }
}

export interface EqualizerFilter {
    /**
     * The band (0 to 14).
     */
    band: number

    /**
     * The gain (-0.25 to 1.0).
     */
    gain: number
}

export interface KaraokeFilter {
    /**
     * The level (0 to 1.0 where 0.0 is no effect and 1.0 is full effect).
     */
    level?: number

    /**
     * The mono level (0 to 1.0 where 0.0 is no effect and 1.0 is full effect).
     */
    monoLevel?: number

    /**
     * The filter band (in Hz).
     */
    filterBand?: number

    /**
     * The filter width.
     */
    filterWidth?: number
}

export interface TimescaleFilter {
    /**
     * The playback speed 0.0 ≤ x.
     */
    speed?: number

    /**
     * The pitch 0.0 ≤ x.
     */
    pitch?: number

    /**
     * The rate 0.0 ≤ x.
     */
    rate?: number
}

export interface TremoloFilter {
    /**
     * The frequency 0.0 < x.
     */
    frequency?: number

    /**
     * The tremolo depth 0.0 < x ≤ 1.0.
     */
    depth?: number
}

export interface VibratoFilter {
    /**
     * The frequency 0.0 < x ≤ 14.0.
     */
    frequency?: number

    /**
     * The vibrato depth 0.0 < x ≤ 1.0.
     */
    depth?: number
}

export interface RotationFilter {
    /**
     * The frequency of the audio rotating around the listener in Hz.
     * 0.2 is similar to the example video above.
     */
    rotationHz?: number
}

export interface DistortionFilter {
    /**
     * The sin offset.
     */
    sinOffset?: number

    /**
     * The sin scale.
     */
    sinScale?: number

    /**
     * The cos offset.
     */
    cosOffset?: number

    /**
     * The cos scale.
     */
    cosScale?: number

    /**
     * The tan offset.
     */
    tanOffset?: number

    /**
     * The tan scale.
     */
    tanScale?: number

    /**
     * The offset.
     */
    offset?: number

    /**
     * The scale.
     */
    scale?: number
}

export interface ChannelMixFilter {
    /**
     * The left to left channel mix factor (0.0 ≤ x ≤ 1.0).
     */
    leftToLeft?: number

    /**
     * The left to right channel mix factor (0.0 ≤ x ≤ 1.0).
     */
    leftToRight?: number

    /**
     * The right to left channel mix factor (0.0 ≤ x ≤ 1.0).
     */
    rightToLeft?: number

    /**
     * The right to right channel mix factor (0.0 ≤ x ≤ 1.0).
     */
    rightToRight?: number
}

export interface LowPassFilter {
    /**
     * The smoothing factor (1.0 < x).
     */
    smoothing?: number
}

export interface UpdatePlayer {
    /**
     * Specification for a new track to load, as well as user data to set.
     */
    track?: UpdatePlayerTrack

    /**
     * The base64 encoded track to play. `null` stops the current track.
     * @deprecated
     */
    encodedTrack?: string

    /**
     * The identifier of the track to play.
     * @deprecated
     */
    identifier?: string

    /**
     * The track position in milliseconds.
     */
    position?: number

    /**
     * The track end time in milliseconds (must be > 0). `null` resets this if it was set previously.
     */
    endTime?: number

    /**
     * The player volume, in percentage, from 0 to 1000.
     */
    volume?: number

    /**
     * Whether the player is paused.
     */
    paused?: boolean

    /**
     * The new filters to apply. This will override all previously applied filters.
     */
    filters?: Filters

    /**
     * Information required for connecting to Discord.
     */
    voice?: VoiceState
}

export interface UpdatePlayerTrack {
    /**
     * The base64 encoded track to play. `null` stops the current track.
     */
    encoded?: string

    /**
     * The identifier of the track to play.
     */
    identifier?: string

    /**
     * Additional track data to be sent back in the {@link Track}.
     */
    userData?: object
}

export interface UpdateSession {
    /**
     * Whether resuming is enabled for this session or not.
     */
    resuming?: boolean

    /**
     * The timeout in seconds (default is 60s).
     */
    timeout?: number
}

export interface NodeInfo {
    /**
     * The version of this Lavalink server.
     */
    version: NodeVersion

    /**
     * The millisecond unix timestamp when this Lavalink jar was built.
     */
    buildTime: number

    /**
     * The git information of this Lavalink server.
     */
    git: NodeGit

    /**
     * The JVM version this Lavalink server runs on.
     */
    jvm: string

    /**
     * The Lavaplayer version being used by this server.
     */
    lavaplayer

    /**
     * The enabled source managers for this server.
     */
    sourceManagers: string[]

    /**
     * The enabled filters for this server.
     */
    filters: string[]

    /**
     * The enabled plugins for this server.
     */
    plugins: NodePlugin[]
}

export interface NodeVersion {
    /**
     * The full version string of this Lavalink server.
     */
    semver: string

    /**
     * The major version of this Lavalink server.
     */
    major: number

    /**
     * The minor version of this Lavalink server.
     */
    minor: number

    /**
     * The patch version of this Lavalink server.
     */
    patch: number

    /**
     * The pre-release version according to semver as a `.` separated list of identifiers.
     */
    preRelease: string | null

    /**
     * The build metadata according to semver as a `.` separated list of identifiers.
     */
    build: string | null
}

export interface NodeGit {
    /**
     * The branch this Lavalink server was built on.
     */
    branch: string

    /**
     * The commit this Lavalink server was built on.
     */
    commit: string

    /**
     * The millisecond unix timestamp for when the commit was created.
     */
    commitTime: number
}

export interface NodePlugin {
    /**
     * The name of the plugin.
     */
    name: string

    /**
     * The version of the plugin.
     */
    version: string
}
