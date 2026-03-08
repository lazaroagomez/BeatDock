const nodeProvider = require('./LavalinkNodeProvider');

// Helper function for ISO 8601 timestamps
const timestamp = () => new Date().toISOString();

class LavalinkConnectionManager {
    constructor(client) {
        this.client = client;
        this.nodeProvider = nodeProvider;
        this.state = {
            reconnectAttempts: 0,
            maxReconnectAttempts: parseInt(process.env.LAVALINK_MAX_RECONNECT_ATTEMPTS || "3", 10), // Retries per node
            baseDelay: parseInt(process.env.LAVALINK_BASE_DELAY_MS || "1000", 10),
            maxDelay: parseInt(process.env.LAVALINK_MAX_DELAY_MS || "5000", 10), // Shorter max delay between retries
            reconnectTimer: null,
            healthCheckInterval: null,
            periodicResetInterval: null,
            lastPing: Date.now(),
            isReconnecting: false,
            reconnectingStartTime: null, // Track when reconnection started for timeout detection
            isWaitingForReset: false, // Track if we're waiting for the 5-minute reset
            isInitialized: false,
            hasHadSuccessfulConnection: false,
            shouldSwitchNode: false, // Track if we should switch to next node
            nodesTriedThisCycle: 0, // Track how many nodes we've tried in this cycle
            totalNodesInCycle: 0 // Track total nodes at start of cycle to avoid stale comparisons
        };
    }

    // Check if Lavalink is available
    isAvailable() {
        const mainNode = this.client.lavalink.nodeManager.nodes.get('main-node');
        return mainNode && mainNode.connected;
    }

    // Check if Lavalink manager is ready
    isManagerReady() {
        return this.client.lavalink && this.client.lavalink.nodeManager;
    }

    // Exponential backoff delay calculation
    getReconnectDelay(attempt) {
        const delay = Math.min(this.state.baseDelay * Math.pow(2, attempt), this.state.maxDelay);
        return delay + Math.random() * 1000; // Add jitter
    }

    // Health check function
    startHealthCheck() {
        if (this.state.healthCheckInterval) {
            clearInterval(this.state.healthCheckInterval);
        }
        
        const healthCheckInterval = parseInt(process.env.LAVALINK_HEALTH_CHECK_INTERVAL_MS || "30000", 10);
        let lastHealthStatus = true; // Track if we were healthy last time
        
        this.state.healthCheckInterval = setInterval(() => {
            const mainNode = this.client.lavalink.nodeManager.nodes.get('main-node');
            const isCurrentlyHealthy = mainNode && mainNode.connected;
            
            if (!isCurrentlyHealthy) {
                lastHealthStatus = false;
                this.attemptReconnection();
            } else {
                // Update last ping time if node is connected
                this.state.lastPing = Date.now();
                lastHealthStatus = true;
                
                // Reset reconnection attempts if we're connected and healthy
                if (this.state.reconnectAttempts > 0) {
                    this.state.reconnectAttempts = 0;
                }
            }
        }, healthCheckInterval);
    }

    // Periodic reset function - safety net for long-running disconnections
    startPeriodicReset() {
        if (this.state.periodicResetInterval) {
            clearInterval(this.state.periodicResetInterval);
        }
        
        this.state.periodicResetInterval = setInterval(() => {
            const mainNode = this.client.lavalink.nodeManager.nodes.get('main-node');
            const timeSinceLastPing = Date.now() - this.state.lastPing;
            
            // If we haven't had a successful ping in the last 30 minutes, try reconnecting
            const PING_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
            if (!mainNode || !mainNode.connected || timeSinceLastPing > PING_TIMEOUT_MS) {
                this.state.reconnectAttempts = 0; // Reset attempts
                this.attemptReconnection();
            }
        }, 60 * 60 * 1000); // Check every hour
    }

    // Reconnection logic - switches nodes after max attempts per node
    async attemptReconnection() {
        if (this.state.isReconnecting) {
            // Safety timeout: if isReconnecting has been true for more than 2 minutes, reset it
            // This prevents permanent deadlock if an exception somehow skipped the reset
            if (this.state.reconnectingStartTime && Date.now() - this.state.reconnectingStartTime > 120000) {
                console.warn(`[${timestamp()}] Reconnection lock timeout detected, resetting...`);
                this.state.isReconnecting = false;
            } else {
                return; // Silently skip if already reconnecting
            }
        }
        
        if (this.state.isWaitingForReset) {
            return; // Silently skip if waiting for the reset timer
        }

        // Check if Lavalink manager is ready
        if (!this.isManagerReady()) {
            return;
        }
        
        this.state.isReconnecting = true;
        this.state.reconnectingStartTime = Date.now();
        
        try {
            const mainNode = this.client.lavalink.nodeManager.nodes.get('main-node');
            
            if (mainNode && mainNode.connected) {
                this.state.isReconnecting = false;
                return;
            }
            
            // Get node config - switch to new node if flagged or no current node
            let nodeConfig;
            if (this.state.shouldSwitchNode) {
                nodeConfig = await this.nodeProvider.getNextNode();
                this.state.shouldSwitchNode = false; // Reset flag after switching
                // Update total nodes count when switching (in case API returned different count)
                if (this.nodeProvider.nodes.length > 0) {
                    this.state.totalNodesInCycle = this.nodeProvider.nodes.length;
                }
            } else {
                // Use current node config for regular reconnection
                const currentNodeInfo = this.nodeProvider.getCurrentNodeInfo();
                if (currentNodeInfo) {
                    nodeConfig = this.nodeProvider.formatNodeConfig(this.nodeProvider.currentNode);
                } else {
                    // No current node, get one and start tracking the cycle
                    nodeConfig = await this.nodeProvider.initialize();
                    this.state.totalNodesInCycle = this.nodeProvider.nodes.length || 1;
                    this.state.nodesTriedThisCycle = 0;
                }
            }
            
            // If no nodes available at all, enter a special waiting state
            // This is different from "all nodes tried and failed" - this means the API/cache is unavailable
            if (!nodeConfig) {
                console.error(`[${timestamp()}] No Lavalink nodes available from provider - will retry in 5 minutes`);
                
                // Stop health check and periodic reset during the waiting period
                if (this.state.healthCheckInterval) {
                    clearInterval(this.state.healthCheckInterval);
                    this.state.healthCheckInterval = null;
                }
                if (this.state.periodicResetInterval) {
                    clearInterval(this.state.periodicResetInterval);
                    this.state.periodicResetInterval = null;
                }
                
                this.state.isWaitingForReset = true;
                this.state.isReconnecting = false;
                this.state.reconnectingStartTime = null;
                
                // Clear any existing timer
                if (this.state.reconnectTimer) {
                    clearTimeout(this.state.reconnectTimer);
                }
                
                const resetMinutes = parseInt(process.env.LAVALINK_RESET_ATTEMPTS_AFTER_MINUTES || "5", 10);
                this.state.reconnectTimer = setTimeout(() => {
                    console.log(`[${timestamp()}] Retrying Lavalink node fetch after cooldown...`);
                    this.state.isWaitingForReset = false;
                    this.state.isReconnecting = false;
                    this.state.reconnectingStartTime = null;
                    this.state.reconnectAttempts = 0;
                    this.state.nodesTriedThisCycle = 0;
                    // Force a fresh API fetch
                    this.nodeProvider.lastFetchTime = 0;
                    
                    // Restart health check after the cooldown
                    this.startHealthCheck();
                    this.startPeriodicReset();
                    
                    this.attemptReconnection();
                }, resetMinutes * 60 * 1000);
                
                return; // Don't throw - just wait
            }
            
            // Clean up any existing node with same ID first
            try {
                const existingNode = this.client.lavalink.nodeManager.nodes.get('main-node');
                if (existingNode) {
                    // Clear any lingering heartbeat/ping intervals (private in TS, accessible in JS)
                    if (existingNode.heartBeatInterval) {
                        clearInterval(existingNode.heartBeatInterval);
                        existingNode.heartBeatInterval = null;
                    }
                    if (existingNode.pingTimeout) {
                        clearTimeout(existingNode.pingTimeout);
                        existingNode.pingTimeout = null;
                    }
                    // Use destroy() for thorough cleanup (clears socket, listeners, etc.)
                    if (typeof existingNode.destroy === 'function') {
                        existingNode.destroy('BeatDock-Reconnect', true);
                    } else {
                        this.client.lavalink.nodeManager.nodes.delete('main-node');
                        if (typeof existingNode.disconnect === 'function') {
                            existingNode.disconnect();
                        }
                    }
                }
            } catch (e) {
                // Ignore cleanup errors
            }
            
            // Wait for connection using nodeManager events (like ready.js)
            // lavalink-client emits events on nodeManager, not on individual nodes
            await new Promise((resolve, reject) => {
                let resolved = false;
                let timeoutId = null;
                
                const onConnect = (node) => {
                    if (resolved) return;
                    if (node.id === 'main-node' || node.options?.id === 'main-node') {
                        cleanup();
                        resolve();
                    }
                };
                
                const onError = (node, error) => {
                    if (resolved) return;
                    if (node.id === 'main-node' || node.options?.id === 'main-node') {
                        cleanup();
                        reject(error || new Error('Connection error'));
                    }
                };
                
                const cleanup = () => {
                    resolved = true;
                    if (timeoutId) clearTimeout(timeoutId);
                    this.client.lavalink.nodeManager.off('connect', onConnect);
                    this.client.lavalink.nodeManager.off('error', onError);
                };
                
                // Set timeout
                timeoutId = setTimeout(() => {
                    if (resolved) return;
                    cleanup();
                    // Clean up the failed node
                    try {
                        const node = this.client.lavalink.nodeManager.nodes.get('main-node');
                        if (node) {
                            // Clear lingering heartbeat intervals
                            if (node.heartBeatInterval) {
                                clearInterval(node.heartBeatInterval);
                                node.heartBeatInterval = null;
                            }
                            if (node.pingTimeout) {
                                clearTimeout(node.pingTimeout);
                                node.pingTimeout = null;
                            }
                            if (typeof node.destroy === 'function') {
                                node.destroy('BeatDock-Timeout', true);
                            } else {
                                this.client.lavalink.nodeManager.nodes.delete('main-node');
                                if (typeof node.disconnect === 'function') {
                                    node.disconnect();
                                }
                            }
                        }
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                    reject(new Error('Connection timeout'));
                }, 15000); // 15 second timeout
                
                // Add listeners on nodeManager BEFORE creating node
                this.client.lavalink.nodeManager.on('connect', onConnect);
                this.client.lavalink.nodeManager.on('error', onError);
                
                // Create and connect the node
                try {
                    const newNode = this.client.lavalink.nodeManager.createNode(nodeConfig);
                    
                    if (!newNode) {
                        cleanup();
                        reject(new Error('Node creation failed - no node object returned'));
                        return;
                    }
                    
                    // Add a temporary error handler on the node to prevent unhandled errors
                    if (newNode && typeof newNode.on === 'function') {
                        newNode.on('error', (err) => {
                            console.error(`[${timestamp()}] Node internal error: ${err?.message || err}`);
                        });
                    }
                    
                    // Explicitly call connect() if the node doesn't auto-connect
                    if (newNode && !newNode.connected && typeof newNode.connect === 'function') {
                        newNode.connect();
                    }
                } catch (error) {
                    cleanup();
                    reject(new Error(`Failed to create node: ${error.message}`));
                }
            });
            
            this.state.reconnectAttempts = 0;
            this.state.isReconnecting = false;
            this.state.reconnectingStartTime = null;
            
        } catch (error) {
            // Clear any existing timer before setting a new one
            if (this.state.reconnectTimer) {
                clearTimeout(this.state.reconnectTimer);
                this.state.reconnectTimer = null;
            }
            
            // Log the error for debugging
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            console.error(`[${timestamp()}] Reconnection attempt failed: ${errorMsg}`);
            
            // Increment attempts (this counts attempts on the CURRENT node)
            this.state.reconnectAttempts++;
            
            // After max attempts on this node, switch to next node
            if (this.state.reconnectAttempts >= this.state.maxReconnectAttempts) {
                this.state.reconnectAttempts = 0;
                this.state.nodesTriedThisCycle++;
                
                // Use the total nodes count - get fresh count if we don't have one
                const currentNodeCount = this.nodeProvider.nodes.length;
                if (this.state.totalNodesInCycle === 0 || currentNodeCount > 0) {
                    this.state.totalNodesInCycle = Math.max(currentNodeCount, 1);
                }
                const totalNodes = this.state.totalNodesInCycle;
                
                console.log(`[${timestamp()}] Node failed after ${this.state.maxReconnectAttempts} attempts (${this.state.nodesTriedThisCycle}/${totalNodes} nodes tried this cycle)`);
                
                // If we've tried all nodes, do the long cooldown
                if (this.state.nodesTriedThisCycle >= totalNodes) {
                    const resetMinutes = parseInt(process.env.LAVALINK_RESET_ATTEMPTS_AFTER_MINUTES || "5", 10);
                    console.warn(`[${timestamp()}] All ${totalNodes} nodes failed. Will retry after ${resetMinutes} minutes...`);
                    
                    // Stop health check and periodic reset during the waiting period
                    if (this.state.healthCheckInterval) {
                        clearInterval(this.state.healthCheckInterval);
                        this.state.healthCheckInterval = null;
                    }
                    if (this.state.periodicResetInterval) {
                        clearInterval(this.state.periodicResetInterval);
                        this.state.periodicResetInterval = null;
                    }
                    
                    // Set waiting state and clear reconnecting flag BEFORE scheduling timer
                    this.state.isWaitingForReset = true;
                    this.state.isReconnecting = false;
                    this.state.reconnectingStartTime = null;
                    
                    const resetDelay = resetMinutes * 60 * 1000;
                    
                    this.state.reconnectTimer = setTimeout(() => {
                        console.log(`[${timestamp()}] Retrying Lavalink connection after cooldown...`);
                        
                        // Reset ALL state for a completely fresh start
                        this.state.reconnectAttempts = 0;
                        this.state.nodesTriedThisCycle = 0;
                        this.state.totalNodesInCycle = 0; // Will be set when we get nodes
                        this.state.isWaitingForReset = false;
                        this.state.isReconnecting = false;
                        this.state.reconnectingStartTime = null;
                        this.state.shouldSwitchNode = false; // Don't force switch - let initialize() pick
                        
                        // Clear failed nodes in provider to get a completely fresh list
                        this.nodeProvider.failedNodes.clear();
                        this.nodeProvider.lastFetchTime = 0; // Allow API refresh
                        this.nodeProvider.currentNode = null; // Clear current node to force fresh pick
                        
                        // Restart health check after the cooldown
                        this.startHealthCheck();
                        this.startPeriodicReset();
                        
                        this.attemptReconnection();
                    }, resetDelay);
                    
                    return;
                }
                
                // Switch to next node (short delay)
                this.state.shouldSwitchNode = true; // Flag to switch node on next attempt
                this.state.isReconnecting = false;
                this.state.reconnectingStartTime = null;
                
                this.state.reconnectTimer = setTimeout(() => {
                    this.attemptReconnection();
                }, 2000); // 2 second delay before trying next node
                
                return;
            }
            
            // Schedule next attempt on same node with exponential backoff
            const delay = this.getReconnectDelay(this.state.reconnectAttempts);
            this.state.isReconnecting = false;
            this.state.reconnectingStartTime = null;
            
            this.state.reconnectTimer = setTimeout(() => {
                this.attemptReconnection();
            }, delay);
        }
    }

    // Handle connection events
    onConnect(node) {
        this.state.lastPing = Date.now();
        this.state.reconnectAttempts = 0;
        this.state.nodesTriedThisCycle = 0; // Reset node cycle counter
        this.state.totalNodesInCycle = 0; // Reset total nodes tracker
        this.state.isReconnecting = false;
        this.state.reconnectingStartTime = null;
        this.state.isWaitingForReset = false; // Clear the waiting state on successful connection
        this.state.shouldSwitchNode = false; // Clear node switch flag
        this.state.isInitialized = true;
        this.state.hasHadSuccessfulConnection = true;
        
        // Mark the current node as working and save it (this logs the connection)
        this.nodeProvider.markCurrentNodeWorking();
        
        // Clear any pending reconnection timers
        if (this.state.reconnectTimer) {
            clearTimeout(this.state.reconnectTimer);
            this.state.reconnectTimer = null;
        }
        
        // Start health check after successful connection (if not already started)
        if (!this.state.healthCheckInterval) {
            this.startHealthCheck();
        }
        
        // Start periodic reset as safety net (if not already started)
        if (!this.state.periodicResetInterval) {
            this.startPeriodicReset();
        }
    }

    onError(node, error) {
        const errorMsg = error?.message || error?.toString() || '';
        const errorCode = error?.code || '';
        
        // Always log errors for debugging, but handle differently based on initialization state
        console.error(`[${timestamp()}] Lavalink error (initialized: ${this.state.isInitialized}): ${errorMsg} (code: ${errorCode})`);
        
        // Don't handle errors during startup (let ready.js handle them)
        if (!this.state.isInitialized) {
            return;
        }
        
        // Check for authentication errors - these should trigger immediate node switch
        const isAuthError = errorMsg.includes('401') || 
                           errorMsg.includes('403') || 
                           errorMsg.includes('Unauthorized') ||
                           errorMsg.includes('Invalid authorization');
        
        if (isAuthError) {
            // Auth errors mean this node's credentials are bad, switch immediately
            this.state.shouldSwitchNode = true;
            this.state.reconnectAttempts = this.state.maxReconnectAttempts; // Force node switch
        }
        
        // Only handle errors if we've had a successful connection before
        if (this.state.hasHadSuccessfulConnection) {
            // Trigger reconnection for connection-related errors
            if (isAuthError || errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND' || 
                errorCode === 'ECONNRESET' || errorMsg.includes('Unable to connect')) {
                setTimeout(() => this.attemptReconnection(), isAuthError ? 1000 : 5000);
            }
        }
    }

    onDisconnect(node, reason) {
        // Don't log or handle disconnects during startup
        if (!this.state.isInitialized) {
            return;
        }
        
        const reasonStr = reason?.reason || reason?.toString() || 'Unknown';
        
        console.log(`[${timestamp()}] Lavalink disconnected: ${reasonStr}`);
        
        // Clear lingering heartbeat intervals to prevent log spam
        if (node) {
            if (node.heartBeatInterval) {
                clearInterval(node.heartBeatInterval);
                node.heartBeatInterval = null;
            }
            if (node.pingTimeout) {
                clearTimeout(node.pingTimeout);
                node.pingTimeout = null;
            }
        }
        
        // Check if this was an auth-related disconnect (code 4001 is common for auth)
        const isAuthDisconnect = reason?.code === 4001 || 
                                  reason?.code === 4003 ||
                                  reasonStr.includes('Unauthorized') ||
                                  reasonStr.includes('Invalid authorization');
        
        if (isAuthDisconnect) {
            // Auth disconnects mean this node's credentials are bad, switch immediately
            this.state.shouldSwitchNode = true;
            this.state.reconnectAttempts = this.state.maxReconnectAttempts; // Force node switch
        }
        
        // Only handle disconnects if we've had a successful connection before
        if (this.state.hasHadSuccessfulConnection) {
            // Clear health check interval
            if (this.state.healthCheckInterval) {
                clearInterval(this.state.healthCheckInterval);
                this.state.healthCheckInterval = null;
            }
            
            // Clear periodic reset interval
            if (this.state.periodicResetInterval) {
                clearInterval(this.state.periodicResetInterval);
                this.state.periodicResetInterval = null;
            }
            
            // Attempt reconnection for unexpected disconnections
            if (reasonStr !== 'destroy') {
                let delay = 2000; // Default 2 seconds
                
                if (isAuthDisconnect) {
                    delay = 1000;
                } else if (reasonStr === 'Socket got terminated due to no ping connection') {
                    delay = 5000;
                } else if (reasonStr.includes('timeout')) {
                    delay = 3000;
                }
                
                setTimeout(() => this.attemptReconnection(), delay);
            }
        }
    }

    // Initialize the connection manager after a delay to let Lavalink start up
    initialize() {
        this.state.isInitialized = true;
        this.startMonitoring();
    }

    // Start monitoring for Lavalink availability
    startMonitoring() {
        // Check immediately
        this.checkAndStartHealthChecks();
        
        // Then check every 5 seconds until we get a connection
        const monitoringInterval = setInterval(() => {
            if (this.isAvailable()) {
                clearInterval(monitoringInterval);
                this.startHealthCheck();
                this.startPeriodicReset();
            }
        }, 5000);
        
        // Stop monitoring after 2 minutes if no connection (fallback)
        setTimeout(() => {
            clearInterval(monitoringInterval);
            if (!this.isAvailable()) {
                this.startHealthCheck();
                this.startPeriodicReset();
            }
        }, 120000); // 2 minutes
        
        // Add a longer timeout to warn if Lavalink never starts
        setTimeout(() => {
            if (!this.isAvailable()) {
                console.error(`[${timestamp()}] CRITICAL: Lavalink has not connected after 5 minutes!`);
            }
        }, 300000); // 5 minutes
    }

    // Check if Lavalink is available and start health checks if it is
    checkAndStartHealthChecks() {
        if (this.isAvailable()) {
            this.startHealthCheck();
            this.startPeriodicReset();
            return true;
        }
        return false;
    }

    // Force a node switch when the current node is unresponsive (e.g. HTTP timeouts)
    // This destroys the current node even if its WebSocket appears connected,
    // then triggers reconnection to the next available node.
    async forceNodeSwitch() {
        console.log(`[${timestamp()}] Forcing node switch due to unresponsive node...`);

        // Cancel any pending reconnection
        if (this.state.reconnectTimer) {
            clearTimeout(this.state.reconnectTimer);
            this.state.reconnectTimer = null;
        }

        // Reset reconnection lock so attemptReconnection won't bail out
        this.state.isReconnecting = false;
        this.state.reconnectingStartTime = null;

        // Flag that we want the next node
        this.state.shouldSwitchNode = true;

        // Destroy the current node so attemptReconnection won't see it as connected
        const mainNode = this.client.lavalink.nodeManager.nodes.get('main-node');
        if (mainNode) {
            try {
                // Clear lingering heartbeat intervals
                if (mainNode.heartBeatInterval) {
                    clearInterval(mainNode.heartBeatInterval);
                    mainNode.heartBeatInterval = null;
                }
                if (mainNode.pingTimeout) {
                    clearTimeout(mainNode.pingTimeout);
                    mainNode.pingTimeout = null;
                }
                await mainNode.destroy('BeatDock-ForceSwitch', true);
            } catch (e) {
                // Ignore destroy errors
            }
        }

        // Now trigger reconnection — it will pick the next node
        this.attemptReconnection();
    }

    // Cleanup function
    destroy() {
        if (this.state.reconnectTimer) {
            clearTimeout(this.state.reconnectTimer);
        }
        if (this.state.healthCheckInterval) {
            clearInterval(this.state.healthCheckInterval);
        }
        if (this.state.periodicResetInterval) {
            clearInterval(this.state.periodicResetInterval);
        }
    }

    // Get connection status for status command
    getStatus() {
        const mainNode = this.client.lavalink.nodeManager.nodes.get('main-node');
        const isConnected = mainNode && mainNode.connected;
        const nodeStats = this.nodeProvider.getStats();
        
        return {
            isConnected,
            reconnectAttempts: this.state.reconnectAttempts,
            maxReconnectAttempts: this.state.maxReconnectAttempts,
            nodesTriedThisCycle: this.state.nodesTriedThisCycle,
            totalNodesInCycle: this.state.totalNodesInCycle,
            isReconnecting: this.state.isReconnecting,
            reconnectingStartTime: this.state.reconnectingStartTime,
            isWaitingForReset: this.state.isWaitingForReset,
            lastPing: this.state.lastPing,
            node: mainNode,
            nodeProvider: nodeStats
        };
    }
}

module.exports = LavalinkConnectionManager; 