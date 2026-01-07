import { useEffect, useRef } from 'react';

interface HubSpotEmbedProps {
  children: React.ReactNode;
}

export default function HubSpotEmbed({ children }: HubSpotEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-height resizing for iframe embedding
    const sendHeight = () => {
      if (containerRef.current && window.parent !== window) {
        const height = containerRef.current.scrollHeight;
        window.parent.postMessage(
          { type: 'resize', height },
          '*'
        );
      }
    };

    // Send height on mount and resize
    sendHeight();
    const resizeObserver = new ResizeObserver(sendHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Listen for postMessage from parent (HubSpot)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'hubspot-context') {
        // Store HubSpot context for form prefilling
        sessionStorage.setItem('hubspotContext', JSON.stringify(event.data.context));
        window.dispatchEvent(new Event('hubspot-context-updated'));
      }
    };

    window.addEventListener('message', handleMessage);

    // Check URL params for HubSpot context
    const params = new URLSearchParams(window.location.search);
    const hubspotContext: any = {};
    if (params.get('email')) hubspotContext.email = params.get('email');
    if (params.get('firstname')) hubspotContext.firstname = params.get('firstname');
    if (params.get('lastname')) hubspotContext.lastname = params.get('lastname');
    if (params.get('phone')) hubspotContext.phone = params.get('phone');
    if (params.get('dealId')) hubspotContext.dealId = params.get('dealId');
    if (params.get('company')) hubspotContext.company = params.get('company');

    if (Object.keys(hubspotContext).length > 0) {
      sessionStorage.setItem('hubspotContext', JSON.stringify(hubspotContext));
      window.dispatchEvent(new Event('hubspot-context-updated'));
    }

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen">
      {children}
    </div>
  );
}
