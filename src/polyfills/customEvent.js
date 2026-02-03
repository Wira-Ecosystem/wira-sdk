(function () {
  // Polyfill Event if it doesn't exist (needed for CustomEvent)
  if (typeof global.Event === 'undefined') {
    global.Event = class Event {
      constructor(type, eventInitDict = {}) {
        this.type = type;
        this.bubbles = eventInitDict.bubbles ?? false;
        this.cancelable = eventInitDict.cancelable ?? false;
        this.defaultPrevented = false;
      }
      preventDefault() {
        this.defaultPrevented = true;
      }
      stopPropagation() {}
      stopImmediatePropagation() {}
    };
  }

  // Polyfill CustomEvent for libraries that expect browser APIs
  if (typeof global.CustomEvent === 'undefined') {
    global.CustomEvent = class CustomEvent extends global.Event {
      constructor(type, eventInitDict = {}) {
        super(type, eventInitDict);
        this.detail = eventInitDict.detail ?? null;
      }
    };
  }

  // Polyfill window.addEventListener for Expo DOM injection
  if (
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'undefined'
  ) {
    // Store event listeners
    const eventListeners = {};

    window.addEventListener = function (type, listener, options) {
      if (!eventListeners[type]) {
        eventListeners[type] = [];
      }
      eventListeners[type].push({ listener, options });
    };

    window.removeEventListener = function (type, listener, options) {
      if (!eventListeners[type]) return;
      eventListeners[type] = eventListeners[type].filter(
        (entry) => entry.listener !== listener
      );
    };

    window.dispatchEvent = function (event) {
      if (!event || !event.type) return true;
      const listeners = eventListeners[event.type];
      if (listeners) {
        listeners.forEach(({ listener, options }) => {
          try {
            if (typeof listener === 'function') {
              listener(event);
            } else if (listener && typeof listener.handleEvent === 'function') {
              listener.handleEvent(event);
            }
          } catch (e) {
            console.error('Error in event listener:', e);
          }
        });
      }
      return true;
    };
  } else if (
    typeof window !== 'undefined' &&
    typeof window.dispatchEvent === 'undefined'
  ) {
    // Fallback: only polyfill dispatchEvent if addEventListener exists but dispatchEvent doesn't
    window.dispatchEvent = function (event) {
      // In React Native, we don't have a real DOM event system
      // Just return true to indicate the event was dispatched
      return true;
    };
  }
})();
