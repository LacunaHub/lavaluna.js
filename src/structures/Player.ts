import { APIPlayer, Filters, VoiceState } from '../api/REST'
import { isValidTrack } from '../utils/Utils'
import { Node } from './Node'
import { Queue, QueuedTrack } from './Queue'

export class Player {
    /**
     * The guild id of the player.
     */
    public guildId: string

    /**
     * The voice channel id of the player.
     */
    public voiceChannelId: string

    /**
     * The text channel id of the player.
     */
    public textChannelId: string

    /**
     * The state of the player.
     */
    public state: PlayerState = 'DISCONNECTED'

    /**
     * The voice state of the player.
     */
    public voiceState: VoiceState = Object.assign({})

    /**
     * The queue of the player.
     */
    public readonly queue = new Queue()

    /**
     * The repeat mode of the player.
     */
    public repeatMode: PlayerRepeatMode = 'OFF'

    /**
     * A mode of music playback in which songs are played in a randomized order.
     */
    public shufflePlay = false

    /**
     * The time the player is in the track.
     */
    public position = 0

    /**
     * Whether the player is playing.
     */
    public playing = false

    /**
     * Whether the player is paused.
     */
    public paused = false

    /**
     * The volume for the player.
     */
    public volume: number

    /**
     * Whether the player repeats the current track.
     */
    public get trackRepeat(): boolean {
        return this.repeatMode === 'TRACK'
    }

    /**
     * Whether the queue repeats the queue.
     */
    public get queueRepeat(): boolean {
        return this.repeatMode === 'QUEUE'
    }

    private readonly data: Record<string, any> = {}

    constructor(public node: Node, public readonly options: PlayerOptions) {
        this.guildId = options.guildId
        this.voiceChannelId = options.voiceChannelId
        this.textChannelId = options.textChannelId

        this.node.players.add(this.guildId, this)
        this.node.manager.emit('playerCreate', this)
        this.setVolume(options.volume ?? 100)
    }

    /**
     * Connects to the voice channel.
     *
     * @returns The current instance.
     */
    public connect(): this {
        if (!this.voiceChannelId) throw new RangeError('[Player#connect] No voice channel has been set.')

        this.state = 'CONNECTING'

        this.node.manager.options.send(this.guildId, {
            op: 4,
            d: {
                guild_id: this.guildId,
                channel_id: this.voiceChannelId,
                self_mute: !!this.options.selfMute,
                self_deaf: !!this.options.selfDeafen
            }
        })

        this.state = 'CONNECTED'

        return this
    }

    /**
     * Disconnects the client from the voice channel.
     *
     * @returns A Promise that resolves with the updated client instance.
     */
    public async disconnect(): Promise<this> {
        if (this.voiceChannelId === null) return this

        this.state = 'DISCONNECTING'

        this.node.manager.options.send(this.guildId, {
            op: 4,
            d: {
                guild_id: this.guildId,
                channel_id: null,
                self_mute: false,
                self_deaf: false
            }
        })

        this.voiceChannelId = null
        this.textChannelId = null
        this.state = 'DISCONNECTED'

        return this
    }

    /**
     * Destroys the player, disconnecting from the node if specified, and emits a `playerDestroy` event.
     *
     * @param disconnect - Whether to disconnect from the node.
     * @returns Whether the player was successfully destroyed.
     */
    public async destroy(disconnect = true): Promise<boolean> {
        if (disconnect) {
            await this.disconnect()
        }

        await this.node.rest.destroyPlayer(this.guildId)
        this.node.manager.emit('playerDestroy', this)

        return this.node.players.delete(this.guildId)
    }

    /**
     * Plays the next track.
     *
     * @returns A promise that resolves to the APIPlayer object.
     */
    public async play(): Promise<APIPlayer>

    /**
     * Plays a track with the given options.
     *
     * @param options - Optional parameters for playing the track.
     * @returns A promise that resolves to the APIPlayer object.
     */
    public async play(options?: PlayOptions): Promise<APIPlayer>

    public async play(options?: PlayOptions): Promise<APIPlayer> {
        let track = this.queue.current

        if (typeof options?.track !== 'undefined' && isValidTrack(options.track)) {
            track = options.track
        }

        if (!track) throw new RangeError('[Player#play] No current track.')

        return await this.node.rest.updatePlayer(
            this.guildId,
            {
                track: {
                    encoded: track.encoded,
                    userData: options?.userData
                },
                position: options?.position,
                endTime: options?.endTime
            },
            options?.noReplace
        )
    }

    /**
     * Sets the player voice channel.
     *
     * @param channelId - The ID of the voice channel.
     * @returns The updated instance of the player.
     */
    public setVoiceChannelId(channelId: string): this {
        if (typeof channelId !== 'string')
            throw new TypeError('[Player#setVoiceChannelId] Channel must be a non-empty string.')

        this.voiceChannelId = channelId
        this.connect()

        return this
    }

    /**
     * Sets the player text channel.
     *
     * @param channelId - The ID of the text channel.
     * @returns The updated instance of the player.
     */
    public setTextChannelId(channelId: string): this {
        if (typeof channelId !== 'string')
            throw new TypeError('[Player#setTextChannelId] Channel must be a non-empty string.')

        this.textChannelId = channelId

        return this
    }

    /**
     * Sets the player volume.
     *
     * @param volume - The new volume.
     * @returns The updated instance of the player.
     */
    public async setVolume(volume: number): Promise<this> {
        volume = Number(volume)

        if (isNaN(volume)) throw new TypeError('[Player#setVolume] Volume must be a number.')

        this.volume = Math.max(Math.min(volume, 1000), 0)

        await this.node.rest.updatePlayer(this.guildId, { volume: this.volume })

        return this
    }

    /**
     * Sets the track repeat.
     *
     * @param repeat - The new track repeat.
     * @returns The updated instance of the player.
     * @deprecated Use {@link Player.setRepeatMode} instead.
     */
    public setTrackRepeat(repeat: boolean): this {
        if (typeof repeat !== 'boolean')
            throw new TypeError('[Player#setTrackRepeat] Repeat can only be "true" or "false".')

        this.repeatMode = repeat ? 'TRACK' : 'OFF'

        return this
    }

    /**
     * Sets the queue repeat.
     *
     * @param repeat - The new queue repeat.
     * @returns The updated instance of the player.
     * @deprecated Use {@link Player.setRepeatMode} instead.
     */
    public setQueueRepeat(repeat: boolean): this {
        if (typeof repeat !== 'boolean')
            throw new TypeError('[Player#setQueueRepeat] Repeat can only be "true" or "false".')

        this.repeatMode = repeat ? 'QUEUE' : 'OFF'

        return this
    }

    public setRepeatMode(mode: PlayerRepeatMode): this {
        if (!['OFF', 'TRACK', 'QUEUE'].includes(mode))
            throw new TypeError('[Player#setRepeatMode] Mode can only be "TRACK" or "QUEUE".')

        this.repeatMode = mode

        return this
    }

    /**
     * Sets the shuffle play mode for the player.
     *
     * @param enabled - The flag to enable or disable shuffle play mode.
     * @returns The updated instance of the player.
     */
    public setShufflePlay(enabled: boolean): this {
        if (typeof enabled !== 'boolean')
            throw new TypeError('[Player#setShufflePlay] Enabled can only be "true" or "false".')

        this.shufflePlay = enabled

        if (this.shufflePlay) {
            this.queue.shuffle()
        } else {
            this.queue.unshuffle()
        }

        return this
    }

    /**
     * Stops the current track, optionally give an amount to skip to, e.g 5 would play the 5th song.
     *
     * @param amount - The amount to skip.
     * @returns The updated instance of the player.
     */
    public async stop(amount?: number): Promise<this> {
        if (typeof amount === 'number' && amount > 1) {
            amount += this.position

            if (amount > this.queue.length)
                throw new RangeError('[Player#stop] Cannot skip more than the queue length.')
        }

        await this.node.rest.updatePlayer(this.guildId, { encodedTrack: null })

        return this
    }

    /**
     * Pauses the current track.
     *
     * @param pause - The new pause state.
     * @returns The updated instance of the player.
     */
    public async pause(pause: boolean): Promise<this> {
        if (typeof pause !== 'boolean') throw new RangeError('[Player#pause] Pause can only be "true" or "false".')
        if (this.paused === pause || !(this.queue.length + 1)) return this

        this.playing = !pause
        this.paused = pause

        await this.node.rest.updatePlayer(this.guildId, { paused: pause })

        return this
    }

    /**
     * Seeks to the position in the current track.
     *
     * @param position
     * @returns The updated instance of the player.
     */
    public async seek(position: number): Promise<this> {
        if (!this.queue.current) return

        position = Number(position)

        if (isNaN(position)) {
            throw new RangeError('[Player#seek] Position must be a number.')
        }

        if (position < 0 || position > this.queue.current.info.length) {
            position = Math.max(Math.min(position, this.queue.current.info.length), 0)
        }

        this.position = position

        await this.node.rest.updatePlayer(this.guildId, { position: this.position })

        return this
    }

    /**
     * Set filters for the player.
     *
     * @param filters - The filters to be set for the player.
     * @returns A promise that resolves with the updated instance of the class.
     */
    public async setFilters(filters: Filters): Promise<this> {
        await this.node.rest.updatePlayer(this.guildId, { filters })

        return this
    }

    /**
     * Set custom data.
     *
     * @param key - The key to set.
     * @param value - The value to set for the key.
     */
    public set(key: string, value: unknown): void {
        this.data[key] = value
    }

    /**
     * Get custom data.
     *
     * @param key - The key to look up in the data object.
     * @returns The value from the data object.
     */
    public get<T>(key: string): T {
        return this.data[key] as T
    }
}

export interface PlayerOptions {
    /**
     * The guild ID the Player belongs to.
     */
    guildId: string

    /**
     * The voice channel ID the Player belongs to.
     */
    voiceChannelId: string

    /**
     * The text channel ID the Player belongs to.
     */
    textChannelId: string

    /**
     * The initial volume the Player will use.
     */
    volume?: number

    /**
     * If the player should mute itself.
     */
    selfMute?: boolean

    /**
     * If the player should deaf itself.
     */
    selfDeafen?: boolean
}

export type PlayerState = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'DISCONNECTING'

export type PlayerRepeatMode = 'OFF' | 'TRACK' | 'QUEUE'

export interface PlayOptions {
    /**
     * The track to play.
     */
    track?: QueuedTrack

    /**
     * The user data to send with the play payload.
     */
    userData?: object

    /**
     * The position to start the track.
     */
    position?: number

    /**
     * The position to end the track.
     */
    endTime?: number

    /**
     * Whether to not replace the track if a play payload is sent.
     */
    noReplace?: boolean
}
