import { Track } from '../api/REST'
import { Player } from './Player'

export class Queue extends Array<QueuedTrack> {
    /**
     * The current position in the queue.
     */
    public position = 0

    /**
     * The current track.
     */
    public get current(): QueuedTrack | undefined {
        return this.at(this.position)
    }

    /**
     * The previous track.
     */
    public get previous(): QueuedTrack | undefined {
        return this.at(this.position - 1)
    }

    /**
     * Get the duration of the function in milliseconds.
     *
     * @returns The duration of the function.
     */
    public get duration(): number {
        return this.reduce((x, y) => (x += y.info.length || 0), this.current?.info?.length ?? 0)
    }

    /**
     * Adds a track or an array of tracks to the queue at a specified offset.
     *
     * @param track - The track or array of tracks to add to the queue.
     * @param [offset] - The optional offset at which to add the track(s) to the queue.
     * @returns The Queue instance after adding the track(s).
     */
    public add(track: QueuedTrack | QueuedTrack[], offset?: number): this {
        if (typeof offset !== 'undefined' && typeof offset === 'number') {
            if (isNaN(offset)) {
                throw new RangeError('[Queue#add] Offset must be a number.')
            }

            if (offset < 0 || offset > this.length) {
                throw new RangeError(`[Queue#add] Offset must be or between 0 and ${this.length}.`)
            }
        }

        if (typeof offset === 'undefined' && typeof offset !== 'number') {
            if (Array.isArray(track)) {
                this.push(...track)
            } else {
                this.push(track)
            }
        } else {
            if (Array.isArray(track)) {
                this.splice(offset, 0, ...track)
            } else {
                this.splice(offset, 0, track)
            }
        }

        return this
    }

    /**
     * Removes a track from the queue. Defaults to the first track, returning the removed track, EXCLUDING THE `current` TRACK.
     *
     * @param position
     * @returns The removed track.
     */
    public remove(position?: number): QueuedTrack[]

    /**
     * Removes an amount of tracks using a exclusive start and end exclusive index, returning the removed tracks, EXCLUDING THE `current` TRACK.
     *
     * @param start
     * @param end
     * @returns The removed tracks.
     */
    public remove(start: number, end: number): QueuedTrack[]
    public remove(startOrPosition = 0, end?: number): QueuedTrack[] {
        if (typeof end !== 'undefined') {
            if (isNaN(Number(startOrPosition))) {
                throw new RangeError('[Queue#remove] Missing "start" parameter.')
            } else if (isNaN(Number(end))) {
                throw new RangeError('[Queue#remove] Missing "end" parameter.')
            } else if (startOrPosition >= end) {
                throw new RangeError('[Queue#remove] Start can not be bigger than end.')
            } else if (startOrPosition >= this.length) {
                throw new RangeError(`[Queue#remove] Start can not be bigger than ${this.length}.`)
            }

            return this.splice(startOrPosition, end - startOrPosition)
        }

        return this.splice(startOrPosition, 1)
    }

    /**
     * Clears the queue.
     *
     * @returns The removed tracks.
     */
    public clear(): QueuedTrack[] {
        return this.splice(0)
    }

    /**
     * Shuffles the tracks in the queue.
     */
    public shuffle(): void {
        for (let i = this.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[this[i], this[j]] = [this[j], this[i]]
        }
    }

    /**
     * Unshuffle the queue based on queuedAt and identifier/title.
     */
    public unshuffle(): void {
        this.sort((a, b) => {
            if (a.queuedAt === b.queuedAt)
                return (a.info.identifier || a.info.title).localeCompare(b.info.identifier || b.info.title)
            return a.queuedAt - b.queuedAt
        })
    }

    /**
     * End the player's current track and emit an event.
     *
     * @param player - The player object.
     * @param track - The track object.
     */
    public end(player: Player, track: QueuedTrack): void {
        this.clear()
        this.position = 0
        player.playing = false

        player.node.manager.emit('playerQueueEnd', player, track)
    }
}

export interface QueuedTrack extends Track {
    queuedAt: number
    requester: string
}
