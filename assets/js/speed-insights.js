/**
 * Vercel Speed Insights Initialization
 * This script initializes Vercel Speed Insights for performance monitoring
 */

// Initialize the queue for Speed Insights
window.si = window.si || function() {
  (window.siq = window.siq || []).push(arguments);
};

// Load the Speed Insights script
(function() {
  // Check if we're in production (deployed on Vercel)
  const isProduction = window.location.hostname !== 'localhost' && 
                       window.location.hostname !== '127.0.0.1';
  
  if (!isProduction) {
    // Don't load Speed Insights in development
    console.log('[Speed Insights] Running in development mode - Speed Insights disabled');
    return;
  }

  // Create and inject the Speed Insights script
  const script = document.createElement('script');
  script.src = '/_vercel/speed-insights/script.js';
  script.defer = true;
  script.dataset.sdkn = '@vercel/speed-insights';
  script.dataset.sdkv = '2.0.0';
  
  script.onerror = function() {
    console.log('[Speed Insights] Failed to load script. Please check if content blockers are enabled.');
  };
  
  document.head.appendChild(script);
})();
