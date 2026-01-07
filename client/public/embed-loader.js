(function() {
  'use strict';
  
  // Configuration
  const WIDGET_URL = 'https://your-domain.com/embed.html'; // Update with your domain
  const CONTAINER_ID = 'shipprimus-widget-container';
  
  // Create iframe
  function createWidget(containerId, options) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Container element not found:', containerId);
      return;
    }

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'shipprimus-iframe';
    iframe.src = WIDGET_URL + (options.context ? '?' + new URLSearchParams(options.context).toString() : '');
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.style.minHeight = '600px';
    iframe.setAttribute('allow', 'fullscreen');
    
    // Auto-height resizing
    let lastHeight = 0;
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'resize') {
        const height = event.data.height;
        if (height !== lastHeight) {
          iframe.style.height = height + 'px';
          lastHeight = height;
        }
      }
    });

    container.appendChild(iframe);
    
    // Send HubSpot context if available
    if (options.context) {
      iframe.onload = function() {
        iframe.contentWindow.postMessage({
          type: 'hubspot-context',
          context: options.context
        }, '*');
      };
    }

    return iframe;
  }

  // Initialize widget
  function init(options) {
    options = options || {};
    const containerId = options.containerId || CONTAINER_ID;
    
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        createWidget(containerId, options);
      });
    } else {
      createWidget(containerId, options);
    }
  }

  // Expose global API
  window.ShipPrimusWidget = {
    init: init,
    createWidget: createWidget
  };

  // Auto-init if container exists
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (document.getElementById(CONTAINER_ID)) {
        init();
      }
    });
  } else {
    if (document.getElementById(CONTAINER_ID)) {
      init();
    }
  }
})();
