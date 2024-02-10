/**
 * Manages a cache of key-value pairs.
 */
export abstract class DataManager<Key, Value> {
    public readonly cache = new Map<Key, Value>()

    /**
     * Adds a key-value pair to the cache if the key does not exist, and returns the value.
     *
     * @param key - The key to be added to the cache.
     * @param value - The value to be associated with the key in the cache.
     * @returns The value associated with the key in the cache.
     */
    public add(key: Key, value: Value): Value {
        if (!key) throw new TypeError('[DataManager#add] Key is required.')
        if (!value) throw new TypeError('[DataManager#add] Value is required.')

        const entry = this.cache.get(key)

        if (entry) return entry

        return this.cache.set(key, value).get(key)
    }

    /**
     * Find the value in the map that satisfies the provided testing function.
     *
     * @param predicate - The testing function
     * @returns The value found, or `undefined` if no value satisfies the testing function
     */
    public find(predicate: (value: Value, key: Key, map: Map<Key, Value>) => unknown): Value {
        if (typeof predicate !== 'function') throw new TypeError('[DataManager#find] Predicate is not a function.')

        for (const [k, v] of this.cache) {
            if (predicate(v, k, this.cache)) return v
        }

        return undefined
    }

    /**
     * Deletes a specific key from the cache.
     *
     * @param key - The key to be deleted from the cache
     * @returns `true` if the key was successfully deleted, false otherwise
     */
    public delete(key: Key): boolean {
        if (!key) throw new TypeError('[DataManager#delete] Key is required.')

        return this.cache.delete(key)
    }
}
