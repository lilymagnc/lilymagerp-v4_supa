
const CACHE_NAME = 'lilymag-album-cache-v1';

export async function cacheAlbumPhotos(
    urls: string[],
    onProgress?: (current: number, total: number) => void
) {
    if (typeof window === 'undefined' || !('caches' in window)) return;

    try {
        const cache = await caches.open(CACHE_NAME);
        let count = 0;

        // Process in chunks to avoid overwhelming the network/browser
        const chunkSize = 5;
        for (let i = 0; i < urls.length; i += chunkSize) {
            const chunk = urls.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (url) => {
                try {
                    // Check if already cached
                    const match = await cache.match(url);
                    if (!match) {
                        const response = await fetch(url, { mode: 'no-cors' });
                        if (response.ok || response.type === 'opaque') {
                            await cache.put(url, response);
                        }
                    }
                } catch (e) {
                    console.error(`Failed to cache ${url}`, e);
                } finally {
                    count++;
                    if (onProgress) onProgress(count, urls.length);
                }
            }));
        }
    } catch (error) {
        console.error('Error opening cache:', error);
    }
}

export async function getCachedPhotoBlobUrl(url: string): Promise<string | null> {
    if (typeof window === 'undefined' || !('caches' in window)) return null;

    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(url);
        if (response) {
            const blob = await response.blob();
            // If blob is opaque (size 0), we can't display it. Return null to use original URL.
            if (blob.size === 0) return null;
            return URL.createObjectURL(blob);
        }
    } catch (e) {
        console.error('Error getting cached photo:', e);
    }
    return null;
}

export async function clearAlbumCache() {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    await caches.delete(CACHE_NAME);
}
