/**
 * Graceful Shutdown Manager
 * Handles application shutdown with proper cleanup and timeout management
 */

const { SHUTDOWN } = require('../config/constants');

class ShutdownManager {
    constructor() {
        this.isShuttingDown = false;
        this.cleanupTasks = [];
        this.forceExitTimer = null;
    }

    /**
     * Registers a cleanup task to be executed during shutdown
     * @param {Function} task - Async function to execute during cleanup
     * @param {string} name - Name of the cleanup task for logging
     */
    registerCleanupTask(task, name) {
        this.cleanupTasks.push({ task, name });
    }

    /**
     * Initiates graceful shutdown process
     * @param {string} signal - Signal that triggered the shutdown
     * @returns {Promise<void>}
     */
    async initiateShutdown(signal) {
        if (this.isShuttingDown) {
            console.log(`Shutdown already in progress, ignoring ${signal}`);
            return;
        }

        this.isShuttingDown = true;
        console.log(`Received ${signal}, initiating graceful shutdown...`);

        // Set a force exit timer as a safety net
        this.forceExitTimer = setTimeout(() => {
            console.error('Graceful shutdown timed out, forcing exit');
            process.exit(1);
        }, SHUTDOWN.GRACEFUL_TIMEOUT_MS);

        try {
            // Execute all cleanup tasks
            await this.executeCleanupTasks();
            
            console.log('Graceful shutdown completed successfully');
            
            // Clear the force exit timer
            if (this.forceExitTimer) {
                clearTimeout(this.forceExitTimer);
                this.forceExitTimer = null;
            }

            // Small delay to ensure all async operations complete
            setTimeout(() => {
                process.exit(0);
            }, SHUTDOWN.FORCE_EXIT_DELAY_MS);

        } catch (error) {
            console.error('Error during graceful shutdown:', error);
            
            // Clear the force exit timer
            if (this.forceExitTimer) {
                clearTimeout(this.forceExitTimer);
                this.forceExitTimer = null;
            }

            // Exit with error code
            setTimeout(() => {
                process.exit(1);
            }, SHUTDOWN.FORCE_EXIT_DELAY_MS);
        }
    }

    /**
     * Executes all registered cleanup tasks
     * @returns {Promise<void>}
     */
    async executeCleanupTasks() {
        console.log(`Executing ${this.cleanupTasks.length} cleanup tasks...`);

        const cleanupPromises = this.cleanupTasks.map(async ({ task, name }) => {
            try {
                console.log(`Executing cleanup task: ${name}`);
                await task();
                console.log(`Cleanup task completed: ${name}`);
            } catch (error) {
                console.error(`Cleanup task failed: ${name}`, error);
                // Don't throw here, let other cleanup tasks continue
            }
        });

        // Wait for all cleanup tasks to complete (or fail)
        await Promise.allSettled(cleanupPromises);
    }

    /**
     * Sets up signal handlers for graceful shutdown
     */
    setupSignalHandlers() {
        // Handle SIGINT (Ctrl+C)
        process.on('SIGINT', () => {
            this.initiateShutdown('SIGINT');
        });

        // Handle SIGTERM (termination request)
        process.on('SIGTERM', () => {
            this.initiateShutdown('SIGTERM');
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            this.initiateShutdown('UNCAUGHT_EXCEPTION');
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.initiateShutdown('UNHANDLED_REJECTION');
        });
    }

    /**
     * Checks if shutdown is in progress
     * @returns {boolean}
     */
    isShutdownInProgress() {
        return this.isShuttingDown;
    }
}

// Export singleton instance
module.exports = new ShutdownManager();