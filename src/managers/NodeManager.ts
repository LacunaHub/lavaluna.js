import { LoadResultType, PlaylistInfo, TrackLoadingResult } from '../api/REST'
import { Exception } from '../api/WebSocket'
import { Node, NodeOptions } from '../structures/Node'
import { Player, PlayerOptions } from '../structures/Player'
import { QueuedTrack } from '../structures/Queue'
import { DataManager } from './DataManager'
import { Lavaluna } from './Lavaluna'

export class NodeManager extends DataManager<string, Node> {
    /**
     * Get the nodes with the least load.
     *
     * @returns An array of nodes with the least load.
     */
    public get leastLoad(): Node[] {
        const nodes = [...this.cache.values()]

        return nodes
            .filter(node => node.connected)
            .sort((a, b) => {
                const aLoad = a.stats.cpu ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100 : 0,
                    bLoad = b.stats.cpu ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100 : 0

                return aLoad - bLoad
            })
    }

    constructor(public manager: Lavaluna) {
        super()
    }

    /**
     * Creates a new Node based on the provided options.
     *
     * @param options - The options for creating the Node.
     * @returns The newly created Node.
     */
    public create(options: NodeOptions): Node {
        options.name = options.name || options.hostname

        if (this.manager.nodes.cache.has(options.name)) {
            return this.manager.nodes.cache.get(options.name)
        }

        return new Node(this.manager, options)
    }

    /**
     * Destroys a node with the given name.
     *
     * @param name - The name of the node to destroy.
     * @returns A promise that resolves to `true` if the node is successfully destroyed, otherwise `false`.
     */
    public destroy(name: string): Promise<boolean> {
        const node = this.manager.nodes.cache.get(name)

        return node && node.destroy()
    }

    /**
     * Search for a query and return the search result.
     *
     * @param query - The search query object.
     * @returns A promise that resolves to the search result.
     */
    public async search(query: SearchQuery, options?: SearchOptions): Promise<SearchResult> {
        const node = this.leastLoad.at(0)

        if (!node) throw new Error('[NodeManager#search] No available nodes.')

        let search = query.query
        const source = query.source ?? this.manager.options.defaultSearchPlatform

        if (!/^https?:\/\//.test(search)) {
            search = `${source}:${search}`
        }

        let loadingResult: TrackLoadingResult

        try {
            loadingResult = await node.rest.loadTracks(search)
        } catch (err) {
            throw new Error('[NodeManager#search] Failed to load tracks.', { cause: err })
        }

        const result: SearchResult = {
            loadType: loadingResult.loadType,
            tracks: []
        }

        if (loadingResult.loadType === 'track') {
            result.tracks = [{ ...loadingResult.data, queuedAt: Date.now(), requester: options?.requester }]
        }

        if (loadingResult.loadType === 'playlist') {
            result.tracks = loadingResult.data.tracks.map((track, i) => ({
                ...track,
                queuedAt: Date.now() + i,
                requester: options?.requester
            }))
            result.playlist = loadingResult.data.info
        }

        if (loadingResult.loadType === 'search') {
            result.tracks = loadingResult.data.map((track, i) => ({
                ...track,
                queuedAt: Date.now() + i,
                requester: options?.requester
            }))
        }

        if (loadingResult.loadType === 'error') {
            result.exception = loadingResult.data
        }

        if (typeof options?.maxResults === 'number' && !isNaN(options.maxResults)) {
            result.tracks = result.tracks.slice(0, options.maxResults)
        }

        return result
    }

    /**
     * Retrieves the player from cache for the given guild ID.
     *
     * @param guildId - The ID of the guild.
     * @returns The player for the given guild ID, or `null` if not found.
     */
    public getPlayer(guildId: string): Player {
        const node = this.find(node => node.players.cache.has(guildId))

        return node && node.players.cache.get(guildId)
    }

    public createPlayer(options: PlayerOptions): Player {
        const node = this.leastLoad.at(0)

        if (!node) throw new Error('[NodeManager#createPlayer] No available nodes.')

        return node.players.create(options)
    }
}

export interface SearchQuery {
    /**
     * The source to search from.
     */
    source?: SearchPlatform

    /**
     * The query to search for.
     */
    query: string
}

export type SearchPlatform = 'ytsearch' | 'ytmsearch' | 'scsearch' | string

export interface SearchOptions {
    /**
     * The requester of the search.
     */
    requester?: string

    /**
     * The maximum number of tracks to return.
     */
    maxResults?: number
}

export interface SearchResult {
    /**
     * The load type of the result.
     */
    loadType: LoadResultType

    /**
     * The array of tracks from the result.
     */
    tracks: QueuedTrack[]

    /**
     * The playlist info if the load type is "playlist".
     */
    playlist?: PlaylistInfo

    /**
     * The exception when searching if one.
     */
    exception?: Exception
}
