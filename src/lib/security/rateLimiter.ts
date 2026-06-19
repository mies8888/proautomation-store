type CacheItem = {
  count: number;
  resetAt: number;
};

// In-memory LRU-style map
const rateCache = new Map<string, CacheItem>();

// Clean up expired items periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of rateCache.entries()) {
    if (now > item.resetAt) {
      rateCache.delete(key);
    }
  }
}, 60000);

export async function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000 // 1 minute default
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  
  const now = Date.now();
  let item = rateCache.get(identifier);

  if (!item || now > item.resetAt) {
    item = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateCache.set(identifier, item);
    return { success: true, limit, remaining: limit - 1, reset: item.resetAt };
  }

  item.count += 1;
  const remaining = Math.max(0, limit - item.count);

  if (item.count > limit) {
    return { success: false, limit, remaining: 0, reset: item.resetAt };
  }

  return { success: true, limit, remaining, reset: item.resetAt };
}
