// ============================================
// CACHE HELPER - Universal Data Cache System
// Works from ANY directory
// ============================================

// ── Check if Supabase client is available ──
if (typeof supabaseClient === 'undefined' && typeof sb === 'undefined') {
    console.warn('⚠️ Supabase client not found. Using window.supabaseClient fallback.');
}

// Get the correct Supabase client
const _sb = window.supabaseClient || window.sb;

// ── CACHE SYSTEM ──
const CACHE = {
    data: {},
    ttl: 300000, // 5 minutes default
    enabled: true,
    
    get(key) {
        if (!this.enabled) return null;
        if (this.data[key] && (Date.now() - this.data[key].timestamp < this.ttl)) {
            console.log(`📦 Cache HIT: ${key}`);
            return this.data[key].value;
        }
        console.log(`📦 Cache MISS: ${key}`);
        return null;
    },
    
    set(key, value, customTTL = null) {
        if (!this.enabled) return;
        this.data[key] = {
            value: value,
            timestamp: Date.now()
        };
        console.log(`💾 Cache STORED: ${key}`);
    },
    
    clear(key) {
        if (key) {
            delete this.data[key];
            console.log(`🗑️ Cache CLEARED: ${key}`);
        } else {
            this.data = {};
            console.log(`🗑️ Cache CLEARED: ALL`);
        }
    },
    
    size() {
        return Object.keys(this.data).length;
    },
    
    // Get cache stats
    stats() {
        const keys = Object.keys(this.data);
        return {
            total: keys.length,
            keys: keys,
            enabled: this.enabled,
            ttl: this.ttl / 1000 + ' seconds'
        };
    }
};

// ── CACHED QUERY HELPER ──
async function cachedQuery(table, options = {}) {
    const cacheKey = JSON.stringify({ table, ...options });
    const cached = CACHE.get(cacheKey);
    
    if (cached) {
        return cached;
    }
    
    // Determine which client to use
    const client = window.supabaseClient || window.sb;
    if (!client) {
        console.error('❌ Supabase client not found!');
        return null;
    }
    
    // Build the query
    let query = client.from(table);
    
    // Select only needed columns
    if (options.select) {
        query = query.select(options.select);
    } else {
        query = query.select('*');
    }
    
    // Add filters (eq, match)
    if (options.match) {
        Object.entries(options.match).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                query = query.eq(key, value);
            }
        });
    }
    
    // Add where conditions
    if (options.where) {
        const w = options.where;
        query = query.filter(w.column, w.operator || 'eq', w.value);
    }
    
    // Add limit
    if (options.limit) {
        query = query.limit(options.limit);
    }
    
    // Add order
    if (options.orderBy) {
        query = query.order(options.orderBy, { 
            ascending: options.ascending || false 
        });
    }
    
    // Add date range
    if (options.gte && options.lte) {
        query = query.gte(options.gte.column, options.gte.value)
                     .lte(options.lte.column, options.lte.value);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Query error:', error);
        return null;
    }
    
    if (data) {
        CACHE.set(cacheKey, data);
        return data;
    }
    
    return [];
}

// ── CACHED COUNT ──
async function cachedCount(table, match = {}) {
    const cacheKey = `count_${table}_${JSON.stringify(match)}`;
    const cached = CACHE.get(cacheKey);
    
    if (cached !== null) {
        return cached;
    }
    
    const client = window.supabaseClient || window.sb;
    if (!client) return 0;
    
    let query = client
        .from(table)
        .select('*', { count: 'exact', head: true });
    
    Object.entries(match).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            query = query.eq(key, value);
        }
    });
    
    const { count, error } = await query;
    
    if (error) {
        console.error('Count error:', error);
        return 0;
    }
    
    CACHE.set(cacheKey, count);
    return count;
}

// ── GET SINGLE RECORD ──
async function cachedSingle(table, match = {}) {
    const cacheKey = `single_${table}_${JSON.stringify(match)}`;
    const cached = CACHE.get(cacheKey);
    
    if (cached) {
        return cached;
    }
    
    const client = window.supabaseClient || window.sb;
    if (!client) return null;
    
    let query = client.from(table).select('*');
    
    Object.entries(match).forEach(([key, value]) => {
        query = query.eq(key, value);
    });
    
    const { data, error } = await query.single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('Single query error:', error);
        return null;
    }
    
    CACHE.set(cacheKey, data);
    return data;
}

// ── CLEAR SPECIFIC TABLE CACHE ──
function clearTableCache(table) {
    const keysToRemove = Object.keys(CACHE.data).filter(key => 
        key.includes(`"${table}"`) || key.includes(table)
    );
    
    keysToRemove.forEach(key => {
        delete CACHE.data[key];
    });
    
    console.log(`🗑️ Cleared cache for table: ${table} (${keysToRemove.length} items)`);
    return keysToRemove.length;
}

// ── CLEAR ALL CACHE ──
function clearAllCache() {
    CACHE.clear();
    console.log('🗑️ All cache cleared!');
}

// ── GET CACHE STATS ──
function getCacheStats() {
    return CACHE.stats();
}

// ── DISABLE/ENABLE CACHE ──
function setCacheEnabled(enabled) {
    CACHE.enabled = enabled;
    console.log(`Cache ${enabled ? 'ENABLED' : 'DISABLED'}`);
    if (!enabled) CACHE.clear();
}

// ── LAZY LOAD IMAGES ──
function lazyLoadImages() {
    document.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.dataset.src;
        img.loading = 'lazy';
        delete img.dataset.src;
    });
}

// ── OPTIMIZE CLOUDINARY URL ──
function optimizeImageUrl(url, width = 300, height = 300) {
    if (!url) return '';
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
        return url.replace('/upload/', `/upload/w_${width},h_${height},c_fill,q_auto:low,f_auto/`);
    }
    return url;
}

// ── ADD BROWSER CACHE META TAGS ──
function addCacheHeaders() {
    if (!document.querySelector('meta[name="cache-control"]')) {
        const meta = document.createElement('meta');
        meta.name = 'cache-control';
        meta.content = 'public, max-age=3600, must-revalidate';
        document.head.appendChild(meta);
    }
}

// ── DISABLE AUTO-REFRESH ──
function disableAutoRefresh() {
    // Clear all intervals that might be refreshing data
    const intervals = window._intervals || [];
    intervals.forEach(id => clearInterval(id));
    window._intervals = [];
    console.log('⏹️ All auto-refresh intervals disabled');
}

// ── AUTO INIT ON PAGE LOAD ──
document.addEventListener('DOMContentLoaded', function() {
    // Add cache headers
    addCacheHeaders();
    
    // Lazy load images
    lazyLoadImages();
    
    console.log('✅ Cache Helper loaded successfully!');
    console.log(`📦 Cache TTL: ${CACHE.ttl / 1000} seconds`);
});

// Expose functions globally
window.CACHE = CACHE;
window.cachedQuery = cachedQuery;
window.cachedCount = cachedCount;
window.cachedSingle = cachedSingle;
window.clearTableCache = clearTableCache;
window.clearAllCache = clearAllCache;
window.getCacheStats = getCacheStats;
window.setCacheEnabled = setCacheEnabled;
window.lazyLoadImages = lazyLoadImages;
window.optimizeImageUrl = optimizeImageUrl;
window.addCacheHeaders = addCacheHeaders;
window.disableAutoRefresh = disableAutoRefresh;

console.log('✅ Cache Helper functions exposed globally!');