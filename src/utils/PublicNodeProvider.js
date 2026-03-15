const API_URL = 'https://lavalink-list.ajieblogs.eu.org/All';
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (matches API refresh)
const FETCH_TIMEOUT_MS = 10000;

class PublicNodeProvider {
    constructor() {
        this.nodes = [];
        this.currentIndex = 0;
        this.refreshInterval = null;
    }

    async fetchNodes() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            const response = await fetch(API_URL, { signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();
            if (!Array.isArray(data)) throw new Error('Unexpected API response format');
            const allV4Nodes = data.filter(node =>
                node.version === 'v4' && node.host && node.port && node.password
            );
            const secureNodes = allV4Nodes.filter(node => node.secure === true);
            const v4Nodes = secureNodes.length > 0 ? secureNodes : allV4Nodes;
            if (secureNodes.length === 0 && allV4Nodes.length > 0) {
                console.warn('No secure public Lavalink nodes found, falling back to insecure nodes');
            }

            if (v4Nodes.length === 0) {
                console.warn('Public Lavalink API returned no v4 nodes');
                return this.nodes.length > 0; // Keep existing cache if available
            }

            this.nodes = v4Nodes;
            this.currentIndex = 0;
            console.log(`Fetched ${v4Nodes.length} public Lavalink v4 nodes`);
            return true;
        } catch (error) {
            if (this.nodes.length > 0) {
                console.warn('Failed to refresh public node list, using cached nodes:', error.message);
                return true;
            }
            console.error('Failed to fetch public Lavalink nodes:', error.message);
            return false;
        }
    }

    getNextNode() {
        if (this.nodes.length === 0) return null;

        const node = this.nodes[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.nodes.length;

        return {
            host: node.host,
            port: node.port,
            authorization: node.password,
            secure: node.secure,
            id: 'main-node',
            retryAmount: 2,
            retryDelay: 3000,
        };
    }

    hasNodes() {
        return this.nodes.length > 0;
    }

    startAutoRefresh() {
        if (this.refreshInterval) return;

        this.refreshInterval = setInterval(() => {
            this.fetchNodes();
        }, REFRESH_INTERVAL_MS);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

module.exports = PublicNodeProvider;
