/**
 * Validates the given track object to ensure it meets the required structure and data types.
 *
 * @param track - The track object to be validated.
 * @returns Indicates whether the given track is valid or not.
 */
export function isValidTrack(track: any): boolean {
    if (typeof track.encoded !== 'string') return false

    if (typeof track.info !== 'object' && track.info !== null) return false

    if (typeof track.info.identifier !== 'string') return false

    if (typeof track.info.isSeekable !== 'boolean') return false

    if (typeof track.info.author !== 'string') return false

    if (typeof track.info.length !== 'number') return false

    if (typeof track.info.isStream !== 'boolean') return false

    if (typeof track.info.position !== 'number') return false

    if (typeof track.info.title !== 'string') return false

    if (typeof track.info.sourceName !== 'string') return false

    return true
}
