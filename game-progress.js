/**
 * JumpiGames Progress Manager
 * 
 * This library allows games embedded in iframes to save and load progress
 * by communicating with the parent page via postMessage.
 * 
 * Usage in games:
 *   // Load progress
 *   window.JumpiProgress.load((progressData) => {
 *     if (progressData) {
 *       // Use progressData.progress, progressData.highScore, etc.
 *     }
 *   });
 * 
 *   // Save progress
 *   window.JumpiProgress.save({
 *     progress: { level: 5, coins: 100 },
 *     highScore: 5000,
 *     level: 5,
 *     achievements: ['first_win']
 *   });
 */

(function() {
  'use strict';

  // Determine API URL based on current host
  const API_URL = window.location.hostname === 'jumpigames.com' || window.location.hostname === 'www.jumpigames.com' 
    ? 'https://jumpigames.com' 
    : 'http://localhost:3000';
  const MESSAGE_PREFIX = 'jumpi-progress-';

  // Check if we're in an iframe (game context)
  const isInIframe = window.self !== window.top;

  /**
   * Game-side API (for games inside iframes)
   */
  const GameAPI = {
    /**
     * Load saved progress
     * @param {Function} callback - Callback function that receives progress data
     */
    load: function(callback) {
      if (!isInIframe) {
        console.warn('JumpiProgress.load() should only be called from within an iframe');
        if (callback) callback(null);
        return;
      }

      // Request progress from parent
      window.parent.postMessage({
        type: MESSAGE_PREFIX + 'load',
        gameSlug: this.getGameSlug()
      }, '*');

      // Listen for response
      const messageHandler = (event) => {
        if (event.data && event.data.type === MESSAGE_PREFIX + 'load-response') {
          window.removeEventListener('message', messageHandler);
          if (callback) {
            callback(event.data.progress || null);
          }
        }
      };

      window.addEventListener('message', messageHandler);

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        if (callback) callback(null);
      }, 5000);
    },

    /**
     * Save progress
     * @param {Object} progressData - Progress data to save
     * @param {Function} callback - Optional callback after save
     */
    save: function(progressData, callback) {
      if (!isInIframe) {
        console.warn('JumpiProgress.save() should only be called from within an iframe');
        if (callback) callback(false);
        return;
      }

      if (!progressData) {
        console.error('JumpiProgress.save() requires progress data');
        if (callback) callback(false);
        return;
      }

      // Send save request to parent
      window.parent.postMessage({
        type: MESSAGE_PREFIX + 'save',
        gameSlug: this.getGameSlug(),
        progressData: progressData
      }, '*');

      // Listen for response
      const messageHandler = (event) => {
        if (event.data && event.data.type === MESSAGE_PREFIX + 'save-response') {
          window.removeEventListener('message', messageHandler);
          if (callback) {
            callback(event.data.success || false);
          }
        }
      };

      window.addEventListener('message', messageHandler);

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        if (callback) callback(false);
      }, 5000);
    },

    /**
     * Get game slug from URL parameters
     */
    getGameSlug: function() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('slug') || urlParams.get('gameSlug') || '';
      } catch (e) {
        return '';
      }
    }
  };

  /**
   * Parent-side API (for game.html page)
   */
  const ParentAPI = {
    /**
     * Initialize progress manager in parent page
     * @param {string} gameSlug - The game slug identifier
     * @param {HTMLIFrameElement} iframe - The iframe element containing the game
     */
    init: function(gameSlug, iframe) {
      if (isInIframe) {
        console.warn('ParentAPI.init() should only be called from the parent page');
        return;
      }

      // Listen for messages from iframe
      window.addEventListener('message', (event) => {
        // Security: In production, check event.origin
        if (!event.data || !event.data.type || !event.data.type.startsWith(MESSAGE_PREFIX)) {
          return;
        }

        const messageType = event.data.type;
        const sourceGameSlug = event.data.gameSlug || gameSlug;

        if (messageType === MESSAGE_PREFIX + 'load') {
          this.handleLoadProgress(sourceGameSlug, iframe);
        } else if (messageType === MESSAGE_PREFIX + 'save') {
          this.handleSaveProgress(sourceGameSlug, event.data.progressData, iframe);
        }
      });

      // Auto-load progress when iframe loads
      if (iframe.contentWindow) {
        iframe.addEventListener('load', () => {
          setTimeout(() => {
            this.handleLoadProgress(gameSlug, iframe);
          }, 1000); // Wait a bit for game to initialize
        });
      }
    },

    /**
     * Handle load progress request from game
     */
    handleLoadProgress: async function(gameSlug, iframe) {
      if (!gameSlug) {
        this.sendLoadResponse(iframe, null);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/game-progress/${encodeURIComponent(gameSlug)}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const progress = await response.json();
          this.sendLoadResponse(iframe, progress);
        } else {
          this.sendLoadResponse(iframe, null);
        }
      } catch (error) {
        console.error('Error loading progress:', error);
        this.sendLoadResponse(iframe, null);
      }
    },

    /**
     * Handle save progress request from game
     */
    handleSaveProgress: async function(gameSlug, progressData, iframe) {
      if (!gameSlug) {
        this.sendSaveResponse(iframe, false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/game-progress/${encodeURIComponent(gameSlug)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(progressData)
        });

        if (response.ok) {
          this.sendSaveResponse(iframe, true);
        } else {
          this.sendSaveResponse(iframe, false);
        }
      } catch (error) {
        console.error('Error saving progress:', error);
        this.sendSaveResponse(iframe, false);
      }
    },

    /**
     * Send load response to iframe
     */
    sendLoadResponse: function(iframe, progress) {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: MESSAGE_PREFIX + 'load-response',
          progress: progress
        }, '*');
      }
    },

    /**
     * Send save response to iframe
     */
    sendSaveResponse: function(iframe, success) {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: MESSAGE_PREFIX + 'save-response',
          success: success
        }, '*');
      }
    }
  };

  // Expose API based on context
  if (isInIframe) {
    // Game is in iframe - expose GameAPI
    window.JumpiProgress = GameAPI;
  } else {
    // Parent page - expose ParentAPI
    window.JumpiProgress = ParentAPI;
  }

})();
