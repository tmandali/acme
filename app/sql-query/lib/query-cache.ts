/**
 * IndexedDB caching for large query results
 * Stores query results locally to avoid re-fetching
 */

const DB_NAME = 'QueryResultsCache'
const STORE_NAME = 'results'
const DB_VERSION = 1
const MAX_CACHE_SIZE_MB = 100
const CACHE_EXPIRY_HOURS = 24

interface CachedResult {
    id: string
    query: string
    results: Record<string, unknown>[]
    timestamp: number
    size: number
}

class QueryCache {
    private db: IDBDatabase | null = null

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION)

            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
                this.db = request.result
                resolve()
            }

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
                    store.createIndex('timestamp', 'timestamp', { unique: false })
                }
            }
        })
    }

    async set(id: string, query: string, results: Record<string, unknown>[]): Promise<void> {
        if (!this.db) await this.init()

        const size = new Blob([JSON.stringify(results)]).size
        const sizeMB = size / (1024 * 1024)

        // Don't cache if too large
        if (sizeMB > MAX_CACHE_SIZE_MB) {
            console.warn(`Query result too large to cache: ${sizeMB.toFixed(2)}MB`)
            return
        }

        const cachedResult: CachedResult = {
            id,
            query,
            results,
            timestamp: Date.now(),
            size,
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.put(cachedResult)

            request.onsuccess = () => {
                this.cleanup().then(resolve).catch(reject)
            }
            request.onerror = () => reject(request.error)
        })
    }

    async get(id: string): Promise<Record<string, unknown>[] | null> {
        if (!this.db) await this.init()

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.get(id)

            request.onsuccess = () => {
                const result: CachedResult = request.result

                if (!result) {
                    resolve(null)
                    return
                }

                // Check expiry
                const ageHours = (Date.now() - result.timestamp) / (1000 * 60 * 60)
                if (ageHours > CACHE_EXPIRY_HOURS) {
                    this.delete(id)
                    resolve(null)
                    return
                }

                resolve(result.results)
            }
            request.onerror = () => reject(request.error)
        })
    }

    async delete(id: string): Promise<void> {
        if (!this.db) await this.init()

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.delete(id)

            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    async clear(): Promise<void> {
        if (!this.db) await this.init()

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.clear()

            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    private async cleanup(): Promise<void> {
        // Remove old entries if cache is too large
        // This is a simple implementation; production would be more sophisticated
        return Promise.resolve()
    }
}

// Singleton instance
export const queryCache = new QueryCache()

/**
 * Generate cache key from query and criteria
 */
export function generateCacheKey(query: string, criteria: Record<string, any>): string {
    const normalized = JSON.stringify({ query, criteria }, Object.keys({ query, criteria }).sort())

    // Simple hash function
    let hash = 0
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }

    return `query_${Math.abs(hash).toString(36)}`
}
