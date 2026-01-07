# HubSpot Embedding Snippets

This document provides ready-to-use code snippets for embedding the ShipPrimus Portal into HubSpot pages.

## Option 1: Iframe Embed (Recommended)

### Basic Iframe

```html
<iframe 
  src="https://your-domain.com/embed.html"
  width="100%" 
  height="800px" 
  frameborder="0"
  id="shipprimus-iframe">
</iframe>

<script>
  // Auto-height resizing
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'resize') {
      document.getElementById('shipprimus-iframe').style.height = event.data.height + 'px';
    }
  });
</script>
```

### Iframe with HubSpot Context Prefill

```html
<iframe 
  src="https://your-domain.com/embed.html?email={{ contact.email }}&firstname={{ contact.firstname }}&lastname={{ contact.lastname }}&dealId={{ deal.id }}"
  width="100%" 
  height="800px" 
  frameborder="0"
  id="shipprimus-iframe">
</iframe>

<script>
  // Auto-height resizing
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'resize') {
      document.getElementById('shipprimus-iframe').style.height = event.data.height + 'px';
    }
  });
</script>
```

## Option 2: Script Loader Embed

### Basic Script Loader

```html
<div id="shipprimus-widget-container"></div>

<script src="https://your-domain.com/embed-loader.js"></script>
<script>
  ShipPrimusWidget.init({
    containerId: 'shipprimus-widget-container'
  });
</script>
```

### Script Loader with HubSpot Context

```html
<div id="shipprimus-widget-container"></div>

<script src="https://your-domain.com/embed-loader.js"></script>
<script>
  ShipPrimusWidget.init({
    containerId: 'shipprimus-widget-container',
    context: {
      email: '{{ contact.email }}',
      firstname: '{{ contact.firstname }}',
      lastname: '{{ contact.lastname }}',
      phone: '{{ contact.phone }}',
      dealId: '{{ deal.id }}',
      company: '{{ contact.company }}'
    }
  });
</script>
```

## PostMessage API

You can also send context via postMessage:

```javascript
// From HubSpot page to iframe
const iframe = document.getElementById('shipprimus-iframe');
iframe.contentWindow.postMessage({
  type: 'hubspot-context',
  context: {
    email: 'contact@example.com',
    firstname: 'John',
    lastname: 'Doe',
    dealId: '12345'
  }
}, '*');
```

## Configuration

Update `client/public/embed-loader.js` with your actual domain:

```javascript
const WIDGET_URL = 'https://your-domain.com/embed.html';
```

## CORS Configuration

Ensure your `ALLOWED_ORIGINS` environment variable includes HubSpot domains:

```env
ALLOWED_ORIGINS="http://localhost:3000,https://app.hubspot.com,https://*.hubspot.com"
```

## Notes

- The iframe automatically resizes based on content height
- Context parameters are optional and will prefill forms when users are logged in
- No secrets or API keys are exposed to the browser
- All API calls go through your backend server
