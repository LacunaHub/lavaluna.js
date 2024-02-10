import { Node } from '../structures/Node'
import { Player, PlayerOptions } from '../structures/Player'
import { DataManager } from './DataManager'

export class PlayerManager extends DataManager<string, Player> {
    constructor(public node: Node) {
        super()
    }

    /**
     * Create a new player with the given options.
     *
     * @param options - The options for creating the player.
     * @returns The newly created player.
     */
    public create(options: PlayerOptions): Player {
        if (this.node.players.cache.has(options.guildId)) {
            return this.node.players.cache.get(options.guildId)
        }

        return new Player(this.node, options)
    }

    /**
     * A method to destroy the player for a given guild ID.
     *
     * @param guildId - The ID of the guild.
     * @returns Whether the player was successfully destroyed.
     */
    public destroy(guildId: string) {
        const player = this.node.players.cache.get(guildId)

        return player && player.destroy()
    }
}
