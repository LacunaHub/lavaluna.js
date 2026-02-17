import { WishMap } from '@danliyev/wishmap'

/**
 * Manages a cache of key-value pairs.
 */
export class DataManager<K, V> {
    /** The underlying cache store. */
    public readonly cache = new WishMap<K, V>()

    /**
     * Adds a key-value pair to the cache if the key does not exist, and returns the value.
     *
     * @param key - The key to be added to the cache.
     * @param value - The value to be associated with the key in the cache.
     * @returns The value associated with the key in the cache.
     */
    public add(key: K, value: V): V {
        if (!key) throw new TypeError('[DataManager#add] "key" is required.')
        if (!value) throw new TypeError('[DataManager#add] "value" is required.')

        const entry = this.cache.get(key)
        if (entry) return entry

        return this.cache.set(key, value).get(key)
    }

    /** Finds a value in the cache matching the given predicate. */
    public find = this.cache.find
    /** Deletes an entry from the cache by key. */
    public delete = this.cache.delete
}
