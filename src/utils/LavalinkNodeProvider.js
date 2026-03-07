const fs = require('fs');
const path = require('path');

// Helper function for ISO 8601 timestamps
const timestamp = () => new Date().toISOString();

const LAVALINK_LIST_API = process.env.LAVALINK_LIST_API_URL || 'https://lavalink-list.ajieblogs.eu.org/All';
const LAVALINK_FALLBACK_API = 'https://raw.githubusercontent.com/DarrenOfficial/lavalink-list/master/docs/NoSSL/lavalink-without-ssl';
// Use /app/data in production (Docker) or ./data relative to project root in development
const DATA_DIR = process.env.NODE_ENV === 'production' ? '/app/data' : path.join(__dirname, '..', '..', 'data');
const NODE_CACHE_FILE = path.join(DATA_DIR, 'lavalink-node.json');
const NODES_CACHE_FILE = path.join(DATA_DIR, 'lavalink-nodes.json');

class LavalinkNodeProvider {
    constructor() {
        this.nodes = [];
        this.currentNodeIndex = 0;
        this.currentNode = null;
        this.failedNodes = new Set(); // Track nodes that failed recently
        this.lastFetchTime = 0;
        this.fetchCooldown = 10 * 60 * 1000; // 10 minutes cooldown between API fetches
    }

    /**
     * Ensure the data directory exists
     */
    ensureDataDir() {
        const dataDir = path.dirname(NODE_CACHE_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    /**
     * Load the saved node from file
     * @returns {Object|null} The saved node or null
     */
    loadSavedNode() {
        try {
            if (fs.existsSync(NODE_CACHE_FILE)) {
                const data = fs.readFileSync(NODE_CACHE_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            // Ignore cache load errors
        }
        return null;
    }

    /**
     * Save the current working node to file
     * @param {Object} node The node to save
     */
    saveNode(node) {
        try {
            this.ensureDataDir();
            fs.writeFileSync(NODE_CACHE_FILE, JSON.stringify(node, null, 2));
        } catch (error) {
            // Ignore cache save errors
        }
    }

    /**
     * Load cached nodes list from file
     * @returns {Array} The cached nodes or empty array
     */
    loadCachedNodes() {
        try {
            if (fs.existsSync(NODES_CACHE_FILE)) {
                const data = fs.readFileSync(NODES_CACHE_FILE, 'utf8');
                const cache = JSON.parse(data);
                // Check if cache is still valid (less than 1 hour old)
                if (cache.timestamp && Date.now() - cache.timestamp < 60 * 60 * 1000) {
                    return cache.nodes;
                }
            }
        } catch (error) {
            // Ignore cache load errors
        }
        return [];
    }

    /**
     * Save nodes list to cache file
     * @param {Array} nodes The nodes to cache
     */
    saveCachedNodes(nodes) {
        try {
            this.ensureDataDir();
            const cache = {
                timestamp: Date.now(),
                nodes: nodes
            };
            fs.writeFileSync(NODES_CACHE_FILE, JSON.stringify(cache, null, 2));
        } catch (error) {
            // Ignore cache save errors
        }
    }

    /**
     * Fetch nodes from the lavalink-list API with fallback
     * @returns {Promise<Array>} Array of available nodes
     */
    async fetchNodes() {
        // Check cooldown
        if (Date.now() - this.lastFetchTime < this.fetchCooldown) {
            return this.nodes.length > 0 ? this.nodes : this.loadCachedNodes();
        }

        let allNodes = null;

        // Try primary API
        try {
            const response = await fetch(LAVALINK_LIST_API, {
                headers: {
                    'User-Agent': 'BeatDock-Discord-Bot/2.3.0'
                },
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error(`Primary API returned status ${response.status}`);
            }

            allNodes = await response.json();
            console.log(`[${timestamp()}] Fetched ${allNodes.length} nodes from primary API`);
        } catch (error) {
            console.warn(`[${timestamp()}] Primary Lavalink API failed: ${error.message}`);
        }

        // Try fallback API if primary failed
        if (!allNodes || allNodes.length === 0) {
            try {
                const response = await fetch(LAVALINK_FALLBACK_API, {
                    headers: {
                        'User-Agent': 'BeatDock-Discord-Bot/2.3.0'
                    },
                    signal: AbortSignal.timeout(10000)
                });

                if (response.ok) {
                    const text = await response.text();
                    // Fallback may return JSON or line-separated entries
                    try {
                        allNodes = JSON.parse(text);
                        console.log(`[${timestamp()}] Fetched ${allNodes.length} nodes from fallback API`);
                    } catch {
                        console.warn(`[${timestamp()}] Fallback API returned non-JSON response`);
                    }
                }
            } catch (error) {
                console.warn(`[${timestamp()}] Fallback Lavalink API failed: ${error.message}`);
            }
        }

        if (!allNodes || allNodes.length === 0) {
            // Fall back to cached nodes
            const cachedNodes = this.loadCachedNodes();
            if (cachedNodes.length > 0) {
                console.log(`[${timestamp()}] Using ${cachedNodes.length} cached nodes`);
                this.nodes = cachedNodes;
                return cachedNodes;
            }
            return [];
        }

        // Filter for v4 nodes only (lavalink-client requires v4)
        // Also prioritize SSL nodes for security
        const v4Nodes = allNodes.filter(node => 
            node.version === 'v4' && 
            node.host && 
            node.port && 
            node.password
        ).map(node => ({
            ...node,
            // Infer secure from port if not explicitly set
            secure: node.secure === true || node.port === 443
        }));

        // Sort: SSL nodes first, then by identifier
        v4Nodes.sort((a, b) => {
            if (a.secure && !b.secure) return -1;
            if (!a.secure && b.secure) return 1;
            return 0;
        });

        this.nodes = v4Nodes;
        this.lastFetchTime = Date.now();
        this.saveCachedNodes(v4Nodes);
        
        console.log(`[${timestamp()}] ${v4Nodes.length} v4 Lavalink nodes available`);
        return v4Nodes;
    }

    /**
     * Quick HTTP health check to verify a node is reachable before attempting WebSocket connection
     * @param {Object} node Raw node from API
     * @returns {Promise<boolean>} true if the node responds to HTTP
     */
    async checkNodeHealth(node) {
        try {
            const protocol = node.secure ? 'https' : 'http';
            const url = `${protocol}://${node.host}:${node.port}/version`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': node.password
                },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            return response.ok || response.status === 401 || response.status === 403;
            // 401/403 means the node is alive but credentials may differ - still worth trying WebSocket
        } catch {
            return false;
        }
    }

    /**
     * Get a node configuration for lavalink-client
     * @param {Object} node Raw node from API
     * @returns {Object} Node configuration for lavalink-client
     */
    formatNodeConfig(node) {
        const port = parseInt(node.port, 10);
        const secure = node.secure === true;
        
        const config = {
            host: node.host,
            port: port,
            authorization: node.password,
            secure: secure,
            id: 'main-node',
            retryAmount: 0,  // Disable library auto-reconnect; BeatDock handles reconnection
            retryDelay: 1000,
            heartBeatInterval: 0, // Disable library heartbeat; BeatDock has its own health checks
            enablePingOnStatsCheck: true, // Keep stats-based ping detection
            closeOnError: true,
        };
        
        return config;
    }

    /**
     * Initialize and get the first available node
     * @returns {Promise<Object|null>} Node configuration or null
     */
    async initialize() {
        // First, try to use the saved working node
        const savedNode = this.loadSavedNode();
        if (savedNode) {
            this.currentNode = savedNode;
            return this.formatNodeConfig(savedNode);
        }

        // Fetch fresh nodes from API
        await this.fetchNodes();

        // Get the first available node
        return this.getNextNode();
    }

    /**
     * Mark the current node as failed and get the next one
     * @returns {Promise<Object|null>} Next node configuration or null
     */
    async getNextNode() {
        // Mark current node as failed if it exists
        if (this.currentNode) {
            const nodeKey = `${this.currentNode.host}:${this.currentNode.port}`;
            this.failedNodes.add(nodeKey);
            console.log(`[${timestamp()}] Lavalink node failed: ${nodeKey}`);
        }

        // Refresh nodes if we have none or all have failed
        if (this.nodes.length === 0 || this.failedNodes.size >= this.nodes.length) {
            console.log(`[${timestamp()}] Refreshing Lavalink node list...`);
            this.failedNodes.clear(); // Reset failed nodes
            this.lastFetchTime = 0; // Force refresh
            await this.fetchNodes();
            
            // If still no nodes after refresh, return null immediately
            if (this.nodes.length === 0) {
                console.error(`[${timestamp()}] No Lavalink nodes available after refresh`);
                return null;
            }
        }

        // Find the next available node that hasn't failed
        // Use HTTP health check to skip obviously dead nodes
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const nodeKey = `${node.host}:${node.port}`;
            
            if (!this.failedNodes.has(nodeKey)) {
                // Quick health check - skip nodes that don't respond to HTTP at all
                const isHealthy = await this.checkNodeHealth(node);
                if (!isHealthy) {
                    console.log(`[${timestamp()}] Skipping unhealthy node: ${nodeKey} (HTTP health check failed)`);
                    this.failedNodes.add(nodeKey);
                    continue;
                }
                
                this.currentNode = node;
                this.currentNodeIndex = i;
                console.log(`[${timestamp()}] Trying Lavalink node: ${nodeKey} (secure: ${node.secure}, password: ${node.password?.substring(0, 10)}...)`);
                return this.formatNodeConfig(node);
            }
        }

        // If all nodes in the list are marked as failed (shouldn't happen after the check above, but safety)
        // This means we just refreshed but the same nodes came back and were already marked failed
        // Clear and try the first one
        console.log(`[${timestamp()}] All nodes in list marked as failed, resetting...`);
        this.failedNodes.clear();
        
        if (this.nodes.length > 0) {
            const node = this.nodes[0];
            this.currentNode = node;
            this.currentNodeIndex = 0;
            console.log(`[${timestamp()}] Retrying first node: ${node.host}:${node.port}`);
            return this.formatNodeConfig(node);
        }

        console.error(`[${timestamp()}] No Lavalink nodes available`);
        return null;
    }

    /**
     * Mark the current node as working and save it
     */
    markCurrentNodeWorking() {
        if (this.currentNode) {
            const nodeKey = `${this.currentNode.host}:${this.currentNode.port}`;
            this.failedNodes.delete(nodeKey);
            this.saveNode(this.currentNode);
            console.log(`[${timestamp()}] Lavalink node connected: ${nodeKey}`);
        }
    }

    /**
     * Get current node info for status display
     * @returns {Object|null} Current node info
     */
    getCurrentNodeInfo() {
        if (!this.currentNode) return null;
        return {
            host: this.currentNode.host,
            port: this.currentNode.port,
            secure: this.currentNode.secure || false,
            identifier: this.currentNode.identifier || this.currentNode['unique-id']
        };
    }

    /**
     * Get statistics about available nodes
     * @returns {Object} Node statistics
     */
    getStats() {
        return {
            totalNodes: this.nodes.length,
            failedNodes: this.failedNodes.size,
            currentNode: this.getCurrentNodeInfo(),
            lastFetchTime: this.lastFetchTime
        };
    }
}

// Export singleton instance
module.exports = new LavalinkNodeProvider();
