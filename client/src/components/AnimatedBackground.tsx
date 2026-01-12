import { useEffect } from 'react';

export default function AnimatedBackground() {
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AnimatedBackground.tsx:4',message:'AnimatedBackground component rendering',data:{stripeCount:32},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  }
  // #endregion

  const stripeColors = [
    { bg: '#f5f5f5', text: '#d0d0d0' },
    { bg: '#ffffff', text: '#e0e0e0' },
    { bg: '#e8e8e8', text: '#b8b8b8' },
    { bg: '#8b1538', text: '#b8456d' },
    { bg: '#d5d5d5', text: '#a0a0a0' },
    { bg: '#e2e4e6', text: '#b5b9bd' },
    { bg: '#ffffff', text: '#e0e0e0' },
    { bg: '#c8c8c8', text: '#989898' },
    { bg: '#f5f5f5', text: '#d0d0d0' },
    { bg: '#e8e8e8', text: '#b8b8b8' },
    { bg: '#ffffff', text: '#e0e0e0' },
    { bg: '#e2e4e6', text: '#b5b9bd' },
    { bg: '#d5d5d5', text: '#a0a0a0' },
    { bg: '#a52a4a', text: '#d87094' },
    { bg: '#c8c8c8', text: '#989898' },
    { bg: '#e2e4e6', text: '#b5b9bd' },
    { bg: '#ffffff', text: '#e0e0e0' },
    { bg: '#f5f5f5', text: '#d0d0d0' },
    { bg: '#8b1538', text: '#b8456d' },
    { bg: '#e8e8e8', text: '#b8b8b8' },
    { bg: '#ffffff', text: '#e0e0e0' },
    { bg: '#d5d5d5', text: '#a0a0a0' },
    { bg: '#e2e4e6', text: '#b5b9bd' },
    { bg: '#c8c8c8', text: '#989898' },
    { bg: '#f5f5f5', text: '#d0d0d0' },
    { bg: '#ffffff', text: '#e0e0e0' },
    { bg: '#d5d5d5', text: '#a0a0a0' },
    { bg: '#e2e4e6', text: '#b5b9bd' },
    { bg: '#c8c8c8', text: '#989898' },
    { bg: '#f5f5f5', text: '#d0d0d0' },
    { bg: '#a52a4a', text: '#d87094' },
    { bg: '#e8e8e8', text: '#b8b8b8' },
    { bg: '#ffffff', text: '#e0e0e0' },
    { bg: '#d5d5d5', text: '#a0a0a0' },
    { bg: '#e2e4e6', text: '#b5b9bd' },
    { bg: '#f5f5f5', text: '#d0d0d0' },
    { bg: '#8b1538', text: '#b8456d' },
    { bg: '#c8c8c8', text: '#989898' },
    { bg: '#ffffff', text: '#e0e0e0' },
    { bg: '#e8e8e8', text: '#b8b8b8' },
    { bg: '#d5d5d5', text: '#a0a0a0' },
    { bg: '#e2e4e6', text: '#b5b9bd' },
    { bg: '#f5f5f5', text: '#d0d0d0' },
    { bg: '#a52a4a', text: '#d87094' },
    { bg: '#c8c8c8', text: '#989898' },
    { bg: '#ffffff', text: '#e0e0e0' },
    { bg: '#e8e8e8', text: '#b8b8b8' },
    { bg: '#d5d5d5', text: '#a0a0a0' },
    { bg: '#e2e4e6', text: '#b5b9bd' },
    { bg: '#f5f5f5', text: '#d0d0d0' },
    { bg: '#8b1538', text: '#b8456d' },
  ];

  const textRepeat = 'S-2 INTERNATIONAL\u00A0'.repeat(25);

  // #region agent log
  useEffect(() => {
    setTimeout(() => {
      const bgElement = document.querySelector('[data-animated-bg]');
      const stripeContainer = document.querySelector('[data-stripe-container]');
      if (bgElement) {
        const computed = window.getComputedStyle(bgElement);
        const rect = bgElement.getBoundingClientRect();
        fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AnimatedBackground.tsx:useEffect',message:'Background element found in DOM',data:{position:computed.position,zIndex:computed.zIndex,display:computed.display,visibility:computed.visibility,width:rect.width,height:rect.height,hasStripeContainer:!!stripeContainer},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
      } else {
        fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AnimatedBackground.tsx:useEffect',message:'Background element NOT found in DOM',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
      }
    }, 100);
  }, []);
  // #endregion

  return (
    <>
      <style>{`
        @keyframes scroll-horizontal {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: -10, backgroundColor: '#f8f8f8' }} data-animated-bg>
        {/* Animated striped background */}
        <div 
          className="absolute -top-[100%] -left-[100%] w-[300%] h-[300%] flex flex-col"
          style={{ transform: 'rotate(30deg)' }}
          data-stripe-container
        >
          {stripeColors.map((color, index) => (
            <div
              key={index}
              className="w-full flex items-center whitespace-nowrap overflow-hidden text-2xl font-black tracking-wider"
              style={{
                padding: '18px 0',
                background: color.bg,
                color: color.text,
              }}
            >
              <div
                className="inline-block"
                style={{
                  animation: 'scroll-horizontal 90s linear infinite',
                }}
              >
                {textRepeat}
              </div>
            </div>
          ))}
        </div>
        
        {/* Fade overlay gradients - fade to white/gray at edges */}
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at top left, rgba(248, 248, 248, 0.7) 0%, transparent 30%),
              radial-gradient(ellipse at top right, rgba(248, 248, 248, 0.7) 0%, transparent 30%),
              radial-gradient(ellipse at bottom left, rgba(248, 248, 248, 0.7) 0%, transparent 30%),
              radial-gradient(ellipse at bottom right, rgba(248, 248, 248, 0.7) 0%, transparent 30%),
              linear-gradient(to top, rgba(248, 248, 248, 0.6) 0%, transparent 20%),
              linear-gradient(to bottom, rgba(248, 248, 248, 0.6) 0%, transparent 20%),
              linear-gradient(to left, rgba(248, 248, 248, 0.6) 0%, transparent 15%),
              linear-gradient(to right, rgba(248, 248, 248, 0.6) 0%, transparent 15%)
            `,
            pointerEvents: 'none',
          }}
        />
      </div>
    </>
  );
}