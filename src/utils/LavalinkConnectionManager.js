class LavalinkConnectionManager {
    constructor(client) {
        this.client = client;
        this.state = {
            reconnectAttempts: 0,
            maxReconnectAttempts: parseInt(process.env.LAVALINK_MAX_RECONNECT_ATTEMPTS || "10", 10),
            baseDelay: parseInt(process.env.LAVALINK_BASE_DELAY_MS || "1000", 10),
            maxDelay: parseInt(process.env.LAVALINK_MAX_DELAY_MS || "30000", 10),
            reconnectTimer: null,
            healthCheckInterval: null,
            periodicResetInterval: null,
            lastPing: Date.now(),
            isReconnecting: false,
            isInitialized: false,
            hasHadSuccessfulConnection: false
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
                console.error('Health check: Node not connected, attempting reconnection...');
                lastHealthStatus = false;
                this.attemptReconnection();
            } else {
                // Update last ping time if node is connected
                this.state.lastPing = Date.now();
                
                // Only log if status changed from unhealthy to healthy
                if (!lastHealthStatus) {
                    console.info('Health check: Node is healthy');
                    lastHealthStatus = true;
                }
                
                // Reset reconnection attempts if we're connected and healthy
                if (this.state.reconnectAttempts > 0) {
                    console.log('✅ Connection restored, resetting reconnection attempts');
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
                console.log('🔄 Periodic reset: No recent connection activity, attempting reconnection...');
                this.state.reconnectAttempts = 0; // Reset attempts
                this.attemptReconnection();
            }
        }, 60 * 60 * 1000); // Check every hour
    }

    // Reconnection logic
    async attemptReconnection() {
        if (this.state.isReconnecting) {
            console.log('Reconnection already in progress, skipping...');
            return;
        }

        // Check if Lavalink manager is ready
        if (!this.isManagerReady()) {
            console.log('Lavalink manager not ready yet, skipping reconnection...');
            return;
        }
        
        this.state.isReconnecting = true;
        console.log('Starting Lavalink reconnection process...');
        
        try {
            const mainNode = this.client.lavalink.nodeManager.nodes.get('main-node');
            
            if (mainNode && mainNode.connected) {
                console.log('Node is already connected, skipping reconnection');
                this.state.isReconnecting = false;
                return;
            }
            
            // Destroy existing node if it exists but is disconnected
            if (mainNode) {
                console.log('Destroying existing disconnected node...');
                try {
                    await mainNode.destroy();
                } catch (error) {
                    console.log('Error destroying existing node:', error.message);
                }
            }
            
            // Create new node
            console.log(`Attempting to reconnect Lavalink (attempt ${this.state.reconnectAttempts + 1}/${this.state.maxReconnectAttempts})...`);
            console.log('Attempting to connect to Lavalink server...');
            
            let newNode;
            try {
                newNode = this.client.lavalink.nodeManager.createNode({
                    host: process.env.LAVALINK_HOST,
                    port: parseInt(process.env.LAVALINK_PORT),
                    authorization: process.env.LAVALINK_PASSWORD,
                    id: "main-node",
                    reconnectTimeout: 10000, // 10 second timeout
                    reconnectTries: 3, // Try 3 times per attempt
                });
            } catch (error) {
                throw new Error(`Failed to create node: ${error.message}`);
            }
            
            // Validate the created node
            if (!newNode) {
                throw new Error('Node creation failed - no node object returned');
            }
            
            // Wait for connection with proper error handling
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    // Clean up event listeners before rejecting
                    if (typeof newNode.off === 'function') {
                        newNode.off('connect', onConnect);
                        newNode.off('error', onError);
                    }
                    reject(new Error('Connection timeout'));
                }, 15000); // 15 second timeout
                
                const onConnect = () => {
                    clearTimeout(timeout);
                    // Clean up event listeners on success
                    if (typeof newNode.off === 'function') {
                        newNode.off('connect', onConnect);
                        newNode.off('error', onError);
                    }
                    resolve();
                };
                
                const onError = (error) => {
                    clearTimeout(timeout);
                    // Clean up event listeners on error
                    if (typeof newNode.off === 'function') {
                        newNode.off('connect', onConnect);
                        newNode.off('error', onError);
                    }
                    reject(error);
                };
                
                // Check if the node has the event methods
                if (typeof newNode.once === 'function') {
                    newNode.once('connect', onConnect);
                    newNode.once('error', onError);
                } else {
                    // If the node doesn't have event methods, wait a bit and check if it's connected
                    setTimeout(() => {
                        if (newNode.connected) {
                            clearTimeout(timeout);
                            resolve();
                        } else {
                            clearTimeout(timeout);
                            reject(new Error('Node created but not connected'));
                        }
                    }, 2000);
                }
            });
            
            console.log('✅ Lavalink reconnection successful!');
            this.state.reconnectAttempts = 0;
            this.state.isReconnecting = false;
            
        } catch (error) {
            console.error('❌ Reconnection attempt failed:', error.message);
            this.state.reconnectAttempts++;
            
            if (this.state.reconnectAttempts >= this.state.maxReconnectAttempts) {
                console.error('🚨 Max reconnection attempts reached. Will retry after 5 minutes...');
                this.state.isReconnecting = false;
                
                // Reset attempts after configured period and try again
                const resetMinutes = parseInt(process.env.LAVALINK_RESET_ATTEMPTS_AFTER_MINUTES || "5", 10);
                const resetDelay = resetMinutes * 60 * 1000;
                
                this.state.reconnectTimer = setTimeout(() => {
                    console.log('🔄 Resetting reconnection attempts and trying again...');
                    this.state.reconnectAttempts = 0;
                    this.state.isReconnecting = false;
                    this.attemptReconnection();
                }, resetDelay);
                
                return;
            }
            
            // Schedule next attempt with exponential backoff
            const delay = this.getReconnectDelay(this.state.reconnectAttempts);
            console.log(`⏰ Scheduling next reconnection attempt in ${Math.round(delay / 1000)} seconds...`);
            
            this.state.reconnectTimer = setTimeout(() => {
                this.state.isReconnecting = false;
                this.attemptReconnection();
            }, delay);
        }
    }

    // Handle connection events
    onConnect(node) {
        console.log('Lavalink node connected successfully.');
        this.state.lastPing = Date.now();
        this.state.reconnectAttempts = 0;
        this.state.isReconnecting = false;
        this.state.isInitialized = true;
        this.state.hasHadSuccessfulConnection = true; // Mark successful connection
        
        // Clear any pending reconnection timers
        if (this.state.reconnectTimer) {
            clearTimeout(this.state.reconnectTimer);
            this.state.reconnectTimer = null;
        }
        
        // Start health check after successful connection (if not already started)
        if (!this.state.healthCheckInterval) {
            console.log('✅ Starting health checks after successful connection...');
            this.startHealthCheck();
        }
        
        // Start periodic reset as safety net (if not already started)
        if (!this.state.periodicResetInterval) {
            this.startPeriodicReset();
        }
    }

    onError(node, error) {
        // Don't log or handle errors during startup
        if (!this.state.isInitialized) {
            return;
        }
        
        // Only log errors if we've had a successful connection before
        if (this.state.hasHadSuccessfulConnection) {
            console.error('Lavalink node encountered an error:', error);
            
            // Only trigger reconnection for connection-related errors
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.message.includes('Unable to connect')) {
                console.log('Connection error detected, will attempt reconnection...');
                setTimeout(() => this.attemptReconnection(), 5000); // Wait 5 seconds before attempting
            }
        }
    }

    onDisconnect(node, reason) {
        // Don't log or handle disconnects during startup
        if (!this.state.isInitialized) {
            return;
        }
        
        // Only log disconnects if we've had a successful connection before
        if (this.state.hasHadSuccessfulConnection) {
            console.log(`Lavalink node disconnected. Reason: ${reason.reason || 'Unknown'}`);
            
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
            if (reason.reason !== 'destroy') {
                console.log('Unexpected disconnection, attempting reconnection...');
                
                // Different handling based on disconnect reason
                let delay = 2000; // Default 2 seconds
                
                if (reason.reason === 'Socket got terminated due to no ping connection') {
                    console.log('No ping connection detected - this might be a network issue');
                    delay = 5000; // Wait 5 seconds for network issues
                } else if (reason.reason.includes('timeout')) {
                    console.log('Connection timeout detected');
                    delay = 3000; // Wait 3 seconds for timeouts
                }
                
                setTimeout(() => this.attemptReconnection(), delay);
            }
        } else {
            console.log('No successful connection yet, not triggering reconnection...');
        }
    }

    // Initialize the connection manager after a delay to let Lavalink start up
    initialize() {
        console.log('🔄 Lavalink connection manager initializing...');
        this.state.isInitialized = true;
        
        // Start monitoring immediately
        this.startMonitoring();
    }

    // Start monitoring for Lavalink availability
    startMonitoring() {
        // Check immediately
        this.checkAndStartHealthChecks();
        
        // Then check every 5 seconds until we get a connection
        const monitoringInterval = setInterval(() => {
            if (this.isAvailable()) {
                console.log('✅ Lavalink connection detected, starting health checks...');
                clearInterval(monitoringInterval);
                this.startHealthCheck();
                this.startPeriodicReset();
            }
        }, 5000);
        
        // Stop monitoring after 2 minutes if no connection (fallback)
        setTimeout(() => {
            clearInterval(monitoringInterval);
            if (!this.isAvailable()) {
                console.log('⚠️ No Lavalink connection detected after 2 minutes, starting health checks anyway...');
                this.startHealthCheck();
                this.startPeriodicReset();
            }
        }, 120000); // 2 minutes
        
        // Add a longer timeout to warn if Lavalink never starts
        setTimeout(() => {
            if (!this.isAvailable()) {
                console.error('🚨 CRITICAL: Lavalink has not connected after 5 minutes!');
                console.error('   - Check if Lavalink container is running: docker ps');
                console.error('   - Check Lavalink logs: docker logs <lavalink-container>');
                console.error('   - Verify network connectivity between containers');
            }
        }, 300000); // 5 minutes
    }

    // Check if Lavalink is available and start health checks if it is
    checkAndStartHealthChecks() {
        if (this.isAvailable()) {
            console.log('✅ Lavalink already connected, starting health checks...');
            this.startHealthCheck();
            this.startPeriodicReset();
            return true;
        }
        return false;
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
        
        return {
            isConnected,
            reconnectAttempts: this.state.reconnectAttempts,
            maxReconnectAttempts: this.state.maxReconnectAttempts,
            isReconnecting: this.state.isReconnecting,
            lastPing: this.state.lastPing,
            node: mainNode
        };
    }
}

module.exports = LavalinkConnectionManager; 