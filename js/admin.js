/* AI Blog Creator Studio Logic Engine */

document.addEventListener('DOMContentLoaded', () => {
  initAdminSettings();
  initAdminTabs();
  initAdminPrompts();
  initGenerator();
});

// State Store
const state = {
  geminiKey: localStorage.getItem('geminiKey') || '',
  unsplashKey: localStorage.getItem('unsplashKey') || '',
  currentPost: null // Holds generated post data
};

/**
 * Settings Modal and API Key Management
 */
function initAdminSettings() {
  const modal = document.getElementById('settings-modal');
  const openBtn = document.getElementById('open-settings-btn');
  const closeBtn = document.getElementById('close-settings-btn');
  const saveBtn = document.getElementById('save-keys-btn');
  const clearBtn = document.getElementById('clear-keys-btn');
  const geminiInput = document.getElementById('gemini-key-input');
  const unsplashInput = document.getElementById('unsplash-key-input');
  const apiStatusAlert = document.getElementById('api-status-alert');

  // Populate inputs if values exist
  if (state.geminiKey) geminiInput.value = state.geminiKey;
  if (state.unsplashKey) unsplashInput.value = state.unsplashKey;
  updateApiStatusUI();

  function openModal() {
    modal.classList.add('open');
  }

  function closeModal() {
    modal.classList.remove('open');
  }

  function updateApiStatusUI() {
    if (state.geminiKey) {
      apiStatusAlert.style.display = 'none';
      openBtn.classList.remove('btn-outline');
      openBtn.classList.add('btn-primary');
      openBtn.style.boxShadow = '0 0 10px hsla(142, 70%, 50%, 0.3)';
    } else {
      apiStatusAlert.style.display = 'block';
      openBtn.classList.add('btn-outline');
      openBtn.classList.remove('btn-primary');
      openBtn.style.boxShadow = '';
    }
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  saveBtn.addEventListener('click', () => {
    state.geminiKey = geminiInput.value.trim();
    state.unsplashKey = unsplashInput.value.trim();

    localStorage.setItem('geminiKey', state.geminiKey);
    localStorage.setItem('unsplashKey', state.unsplashKey);

    updateApiStatusUI();
    closeModal();
    logConsole('[SYSTEM] API configurations updated and saved.', 'success');
  });

  clearBtn.addEventListener('click', () => {
    state.geminiKey = '';
    state.unsplashKey = '';
    geminiInput.value = '';
    unsplashInput.value = '';

    localStorage.removeItem('geminiKey');
    localStorage.removeItem('unsplashKey');

    updateApiStatusUI();
    closeModal();
    logConsole('[SYSTEM] API credentials cleared.', 'info');
  });
}

/**
 * Tab Navigation System for Output panel
 */
function initAdminTabs() {
  const tabButtons = document.querySelectorAll('.output-tab-btn');
  const tabContents = document.querySelectorAll('.output-tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');
      
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${tabTarget}`).classList.add('active');
    });
  });
}

/**
 * Setup Trend Card Suggestions Binds
 */
function initAdminPrompts() {
  const cards = document.querySelectorAll('.trend-card');
  const promptInput = document.getElementById('ai-prompt-input');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      promptInput.value = prompt;
      logConsole(`[SYSTEM] Selected suggested topic: "${card.querySelector('.trend-title').textContent}"`, 'info');
      
      // Add visual active state to selected card
      cards.forEach(c => c.style.borderColor = '');
      card.style.borderColor = 'var(--primary)';
    });
  });
}

/**
 * Console log helper
 */
function logConsole(message, type = '') {
  const consoleOutput = document.getElementById('console-output');
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.textContent = message;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

/**
 * Workflow Generator Orchestrator
 */
function initGenerator() {
  const generateBtn = document.getElementById('generate-blog-btn');
  const promptInput = document.getElementById('ai-prompt-input');
  const authorSelect = document.getElementById('author-select');

  generateBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      logConsole('[ERROR] Prompt input is empty. Please select a topic suggestion or type your own.', 'error');
      alert('Please enter a prompt first.');
      return;
    }

    const author = authorSelect.value;
    const today = new Date().toISOString().split('T')[0];

    // Disable button during pipeline run
    generateBtn.disabled = true;
    generateBtn.style.opacity = '0.5';
    resetVisualizer();

    logConsole('[SYSTEM] Starting AI content pipeline...', 'info');

    try {
      // 1. Pipeline Stage 1: Trend Research (Define Topic)
      updateNodeState('node-trend', 'active', 'Analyzing');
      logConsole('[STAGE 1] Querying Gemini for topic structuring...', 'info');
      
      const topic = await runTopicResearchStage(prompt, author, today);
      
      updateNodeState('node-trend', 'success', 'Completed');
      updateConnectorState('connector-1', true);
      logConsole(`[STAGE 1 SUCCESS] Selected Topic: "${topic.title}"`, 'success');

      // 2. Pipeline Stage 2: Drafting HTML Copy
      updateNodeState('node-copy', 'active', 'Writing');
      logConsole('[STAGE 2] Querying Gemini for copywriting contents...', 'info');
      
      const articleBodyHtml = await runCopywritingStage(topic);
      
      updateNodeState('node-copy', 'success', 'Completed');
      updateConnectorState('connector-2', true);
      logConsole('[STAGE 2 SUCCESS] Article content drafted successfully.', 'success');

      // 3. Pipeline Stage 3: Image Search
      updateNodeState('node-media', 'active', 'Searching');
      logConsole(`[STAGE 3] Querying Unsplash for media asset: "${topic.search_keyword}"`, 'info');
      
      const imagePath = await runMediaSearchStage(topic.search_keyword, topic.slug);
      
      updateNodeState('node-media', 'success', 'Completed');
      updateConnectorState('connector-3', true);
      logConsole(`[STAGE 3 SUCCESS] Image asset registered: "${imagePath}"`, 'success');

      // 4. Pipeline Stage 4: Template Compile
      updateNodeState('node-compile', 'active', 'Compiling');
      logConsole('[STAGE 4] Compiling static templates & schema JSON-LD...', 'info');
      
      const fullPageHtml = compileHtmlTemplate(topic, articleBodyHtml, imagePath);
      
      updateNodeState('node-compile', 'success', 'Ready');
      logConsole('[STAGE 4 SUCCESS] Compilation successful. Presenting output.', 'success');

      // Store in state
      state.currentPost = {
        topic,
        html: fullPageHtml
      };

      // Present outputs in Tab Views
      presentPostOutputs(topic, fullPageHtml);
      logConsole('[SYSTEM] AI Pipeline completed. Ready to publish!', 'success');

    } catch (error) {
      logConsole(`[PIPELINE EXCEPTION] Pipeline failed: ${error.message}`, 'error');
      console.error(error);
    } finally {
      generateBtn.disabled = false;
      generateBtn.style.opacity = '1';
    }
  });

  // Setup downloader, copy, and publish triggers
  const downloadBtn = document.getElementById('download-post-file-btn');
  const copyBtn = document.getElementById('copy-source-code-btn');
  const publishDirectlyBtn = document.getElementById('publish-directly-btn');
  const publishStatusBanner = document.getElementById('publish-status-banner');

  downloadBtn.addEventListener('click', () => {
    if (!state.currentPost) return;
    const blob = new Blob([state.currentPost.html], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${state.currentPost.topic.slug}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logConsole(`[SYSTEM] Downloaded file: "${state.currentPost.topic.slug}.html"`, 'success');
  });

  copyBtn.addEventListener('click', () => {
    if (!state.currentPost) return;
    navigator.clipboard.writeText(state.currentPost.html).then(() => {
      logConsole('[SYSTEM] Source code copied to clipboard!', 'success');
      alert('Source code copied to clipboard!');
    });
  });

  publishDirectlyBtn.addEventListener('click', async () => {
    if (!state.currentPost) return;

    publishDirectlyBtn.disabled = true;
    publishDirectlyBtn.textContent = 'Publishing...';
    publishStatusBanner.style.display = 'none';
    logConsole('[SYSTEM] Triggering direct publish via local Python server...', 'info');

    try {
      const publishUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? '/api/publish'
        : 'http://localhost:8000/api/publish';

      const response = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: state.currentPost.topic.slug,
          html: state.currentPost.html
        })
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        publishStatusBanner.className = 'alert alert-success';
        publishStatusBanner.style.background = 'hsla(142, 70%, 50%, 0.1)';
        publishStatusBanner.style.border = '1px solid hsl(142, 70%, 50%)';
        publishStatusBanner.style.color = 'var(--text-primary)';
        publishStatusBanner.innerHTML = `<strong>Success!</strong> ${result.message}`;
        publishStatusBanner.style.display = 'block';
        logConsole(`[SYSTEM SUCCESS] ${result.message}`, 'success');
      } else {
        throw new Error(result.message || 'Publishing endpoint failed');
      }
    } catch (error) {
      publishStatusBanner.className = 'alert alert-warning';
      publishStatusBanner.innerHTML = `<strong>Publish skipped/failed:</strong> ${error.message}. Make sure your local server is running by executing 'npm run dev' in your terminal.`;
      publishStatusBanner.style.display = 'block';
      logConsole(`[ERROR] Direct publish failed: ${error.message}`, 'error');
    } finally {
      publishDirectlyBtn.disabled = false;
      publishDirectlyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; vertical-align:middle;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        Publish Directly
      `;
    }
  });
}

/**
 * Visualizer State Modifiers
 */
function resetVisualizer() {
  const nodes = ['node-trend', 'node-copy', 'node-media', 'node-compile'];
  nodes.forEach(node => {
    const el = document.getElementById(node);
    el.className = 'visualizer-node';
    el.querySelector('.node-status').textContent = 'Idle';
  });

  const connectors = ['connector-1', 'connector-2', 'connector-3'];
  connectors.forEach(c => {
    document.getElementById(c).className = 'visualizer-connector';
  });
}

function updateNodeState(nodeId, stateClass, statusText) {
  const node = document.getElementById(nodeId);
  node.className = `visualizer-node ${stateClass}`;
  node.querySelector('.node-status').textContent = statusText;
}

function updateConnectorState(connectorId, isActive) {
  const connector = document.getElementById(connectorId);
  if (isActive) {
    connector.classList.add('active');
  } else {
    connector.classList.remove('active');
  }
}

/**
 * API Calls: Stage 1 Topic Research
 */
async function runTopicResearchStage(prompt, author, dateStr) {
  if (!state.geminiKey) {
    // Dry-run mockup delay
    logConsole('[SYSTEM] Gemini API key missing. Mocking Stage 1 topic values...', 'info');
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      title: "Optimizing CSS for Zero Cumulative Layout Shift (CLS)",
      slug: "css-cls-optimization-guide",
      category: "Performance",
      excerpt: "A deep dive into CSS techniques, aspect-ratio definitions, and dynamic element rendering rules to eliminate layout shifts.",
      search_keyword: "css coding speed",
      estimated_read_time: "6 min read",
      author,
      date: dateStr
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${state.geminiKey}`;
  const requestBody = {
    contents: [{
      parts: [{
        text: `Analyze this request: "${prompt}". Respond with a structured JSON object containing topic keys for a blog. The slug must be a lowercase hyphenated string matching the title. Excerpt must be under 160 characters. Search keyword must be a simple 2-word phrase to search stock photos (e.g. 'speedometer dial', 'code monitor'). Category must be either 'SEO', 'Web Design', or 'Performance'. Estimated read time must be a string like 'X min read'. Author must be: '${author}'.
        
        Provide the response in raw JSON format. Do not wrap it in markdown blockquotes or backticks:
        {
          "title": "A compelling, keyword-rich article title under 60 characters",
          "slug": "lowercase-hyphenated-slug-for-filename",
          "category": "SEO" or "Web Design" or "Performance",
          "excerpt": "A short summary",
          "search_keyword": "unsplash search keyword",
          "estimated_read_time": "5 min read",
          "author": "${author}"
        }`
      }]
    }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Gemini API call failed');
  }

  const result = await response.json();
  let text = result.candidates[0].content.parts[0].text.stripJSON();
  const topic = JSON.parse(text);
  topic.date = dateStr;
  return topic;
}

/**
 * API Calls: Stage 2 Copywriting Content
 */
async function runCopywritingStage(topic) {
  if (!state.geminiKey) {
    // Dry-run mockup delay
    logConsole('[SYSTEM] Gemini API key missing. Mocking Stage 2 HTML copywriting content...', 'info');
    await new Promise(resolve => setTimeout(resolve, 2000));
    return `
    <p>Welcome to this automated article on <strong>${topic.title}</strong>. In this review, we'll break down why this topic is trending in the industry and how it affects your site's structure.</p>
    <h2>The Core Concepts</h2>
    <p>Understanding the fundamental layers of ${topic.category} is essential to achieving consistent Google Lighthouse scores. When building layouts, developers must maintain strict control over DOM nodes, styles, and Javascript execution budgets.</p>
    <blockquote>
      "Simplicity is the ultimate sophistication in web engineering. Less code means faster parsing, which guarantees higher rankings."
    </blockquote>
    <h2>Key Recommendations</h2>
    <ul>
      <li><strong>Perform Regular Audits:</strong> Keep your indices clear of duplicate canonical entries.</li>
      <li><strong>Optimize Images:</strong> Ensure all web assets are compressed and utilize modern responsive layout sizes.</li>
      <li><strong>Limit Bloat:</strong> Rely on vanilla styling engines rather than large utility libraries.</li>
    </ul>
    <h2>Summary</h2>
    <p>By following these practices, you will establish a solid foundation that search crawlers trust and visitors enjoy browsing.</p>
    `;
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${state.geminiKey}`;
  const requestBody = {
    contents: [{
      parts: [{
        text: `Write a detailed, engaging, and professional web developer article about: '${topic.title}'. 
        The category is: ${topic.category}.
        
        Requirements:
        1. Output ONLY the HTML contents that will go INSIDE the article body (e.g. paragraph tags <p>, H2 headings <h2>, H3 headings <h3>, list items <ul>/<li>, and blockquotes <blockquote>).
        2. Write at least 4-5 detailed paragraphs.
        3. Include a <blockquote> with a short, inspiring quote related to web quality.
        4. Provide code blocks or concrete technical examples if applicable.
        5. Do not include H1 tags, html wraps, or markdown backticks around your output.`
      }]
    }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error('Gemini copywriting call failed');
  }

  const result = await response.json();
  let text = result.candidates[0].content.parts[0].text.stripJSON();
  return text;
}

/**
 * API Calls: Stage 3 Media Search (Unsplash)
 */
async function runMediaSearchStage(keyword, slug) {
  if (!state.unsplashKey || state.unsplashKey === 'your_unsplash_access_key_here') {
    logConsole('[SYSTEM] Unsplash API key missing. Mocking Stage 3 vector placeholder...', 'info');
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Since this is in the preview, we can generate a mock SVG link
    return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><rect width='100%' height='100%' fill='%231e293b'/><text x='50%' y='50%' fill='%23e2e8f0' font-size='28' font-weight='bold' text-anchor='middle'>${keyword.toUpperCase()}</text></svg>`;
  }

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`;
  
  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Client-ID ${state.unsplashKey}` }
    });

    if (!response.ok) throw new Error('Unsplash fetch failed');
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const imgUrl = data.results[0].urls.regular;
      // In browser preview, we link directly to the Unsplash URL
      return imgUrl;
    }
  } catch (e) {
    logConsole(`[WARNING] Unsplash query failed: ${e.message}. Using SVG fallback.`, 'error');
  }
  
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><rect width='100%' height='100%' fill='%231e293b'/><text x='50%' y='50%' fill='%23e2e8f0' font-size='28' font-weight='bold' text-anchor='middle'>${keyword.toUpperCase()}</text></svg>`;
}

/**
 * Helpers for stripping JSON Markdown formatting
 */
String.prototype.stripJSON = function() {
  let s = this.trim();
  if (s.startsWith("```json")) s = s.substring(7);
  if (s.startsWith("```html")) s = s.substring(7);
  if (s.endsWith("```")) s = s.substring(0, s.length - 3);
  return s.trim();
};

/**
 * Stage 4: Compile HTML Post Template
 */
function compileHtmlTemplate(topic, bodyHtml, imagePath) {
  const avatarInitials = topic.author.split(' ').map(n => n[0]).join('').toUpperCase();
  const avatarColor = topic.author === 'Alex Zen' ? '#6366F1' : '#06B6D4';
  
  // Format Date for display
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const d = new Date(topic.date);
  const formattedDate = `${months[d.getMonth()]} ${d.getDate() + 1}, ${d.getFullYear()}`;

  const schemaJson = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://aurablog.com/posts/${topic.slug}.html`
    },
    "headline": topic.title,
    "description": topic.excerpt,
    "image": imagePath.startsWith('data:') ? 'https://aurablog.com/assets/logo.png' : imagePath,
    "datePublished": `${topic.date}T08:00:00+00:00`,
    "dateModified": `${topic.date}T08:00:00+00:00`,
    "author": {
      "@type": "Person",
      "name": topic.author,
      "url": "https://aurablog.com/about.html"
    },
    "publisher": {
      "@type": "Organization",
      "name": "AuraBlog",
      "logo": {
        "@type": "ImageObject",
        "url": "https://aurablog.com/assets/logo.png"
      }
    }
  };

  // We construct the HTML using relative paths since it goes inside `/posts/`
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary SEO Meta Tags -->
  <title>${topic.title} | AuraBlog</title>
  <meta name="description" content="${topic.excerpt}">
  <link rel="canonical" href="https://aurablog.com/posts/${topic.slug}.html">
  <meta name="robots" content="index, follow">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://aurablog.com/posts/${topic.slug}.html">
  <meta property="og:title" content="${topic.title} | AuraBlog">
  <meta property="og:description" content="${topic.excerpt}">
  <meta property="og:image" content="${imagePath}">
  
  <!-- Stylesheets -->
  <link rel="stylesheet" href="../css/variables.css?v=2">
  <link rel="stylesheet" href="../css/main.css?v=2">
  
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%236366f1'/><path d='M30 70V30l40 40V30' stroke='white' stroke-width='10' stroke-linecap='round' stroke-linejoin='round' fill='none'/></svg>">

  <!-- JSON-LD BlogPosting Schema -->
  <script type="application/ld+json">
  ${JSON.stringify(schemaJson, null, 2)}
  </script>
</head>
<body>

  <!-- Navigation Header -->
  <header class="navbar-wrapper">
    <div class="container navbar">
      <a href="../index.html" class="nav-brand" id="logo-link">
        <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect width="100" height="100" rx="24" fill="url(#brand-grad)" />
          <path d="M30 70V30L70 70V30" stroke="white" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
          <defs>
            <linearGradient id="brand-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stop-color="#6366F1" />
              <stop offset="1" stop-color="#06B6D4" />
            </linearGradient>
          </defs>
        </svg>
        <span>Aura</span>Blog
      </a>
      
      <nav aria-label="Main Navigation">
        <ul class="nav-menu">
          <li><a href="../index.html" class="nav-link">Home</a></li>
          <li><a href="../about.html" class="nav-link">About</a></li>
          <li><a href="../contact.html" class="nav-link">Contact</a></li>
        </ul>
      </nav>
      
      <div class="nav-controls">
        <button class="theme-toggle-btn" aria-label="Toggle theme" id="theme-toggle">
          <svg class="sun-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.01c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>
          <svg class="moon-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.37 5.51c-.18-.64-.9-1-1.54-.82-.64.18-1 .9-.82 1.54 1.41 4.97 6 8.52 11.37 8.52.64 0 1.28-.06 1.9-.17.65-.11 1.09-.72.98-1.37-.11-.64-.72-1.09-1.37-.98-.5.09-1.02.14-1.54.14-4.52 0-8.24-3.41-8.98-7.83z"/></svg>
        </button>
      </div>
    </div>
  </header>

  <!-- Top Leaderboard Ad Placement -->
  <div class="container fade-in" style="animation-delay: 0.1s;">
    <div class="ad-slot ad-leaderboard" aria-label="Advertisement Banner">
      <span class="ad-slot-dimensions">728 x 90 (Leaderboard)</span>
    </div>
  </div>

  <!-- 2-Column Article & Sidebar Container -->
  <main class="container fade-in" style="animation-delay: 0.2s;">
    <div class="layout-grid">
      <!-- Left Side: Article Content -->
      <article class="main-content">
        <header class="article-header">
          <span class="article-category">${topic.category}</span>
          <h1 class="article-title">${topic.title}</h1>
          <div class="article-meta">
            <div class="article-author-info">
              <svg width="32" height="32" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="${avatarColor}"/><text x="50" y="55" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Outfit" font-size="30" font-weight="700">${avatarInitials}</text></svg>
              <span>${topic.author}</span>
            </div>
            <span>•</span>
            <time datetime="${topic.date}">${formattedDate}</time>
            <span>•</span>
            <span>${topic.estimated_read_time || topic.read_time || '5 min read'}</span>
          </div>
        </header>

        <!-- Hero Image -->
        <img class="article-hero-image" src="${imagePath}" alt="${topic.title}" width="800" height="450">

        <!-- Content Body -->
        <div class="article-content">
          ${bodyHtml}
        </div>

        <!-- Article Footer -->
        <footer class="article-footer">
          <div class="newsletter-card" style="margin: var(--space-xl) 0 0 0;">
            <h3 class="newsletter-title">Subscribe for More Insights</h3>
            <p class="newsletter-desc">Keep your codebase optimized and stay ahead of updates with our bi-weekly updates.</p>
            <form class="newsletter-form">
              <input type="email" placeholder="Enter your email address" required aria-label="Email address">
              <button type="submit" class="btn btn-primary">Subscribe</button>
            </form>
          </div>
        </footer>
      </article>

      <!-- Right Side: Sticky Ad-Monetized Sidebar -->
      <aside class="sidebar" aria-label="Sidebar Content">
        <!-- Sidebar Author Profile Widget -->
        <div class="sidebar-widget author-widget">
          <div class="author-widget-avatar">
            <svg width="40" height="40" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="${avatarColor}"/><text x="50" y="55" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Outfit" font-size="30" font-weight="700">${avatarInitials}</text></svg>
          </div>
          <div class="author-widget-name">${topic.author}</div>
          <p class="author-widget-bio">Technical writer, web developer, and contributor at AuraBlog.</p>
        </div>

        <!-- Sidebar Skyscraper Ad Placement -->
        <div class="sidebar-widget" style="padding: 0; background: none; border: none; box-shadow: none;">
          <div class="ad-slot ad-skyscraper" aria-label="Advertisement Skyscraper Slot">
            <span class="ad-slot-dimensions">300 x 600 (Half Page)</span>
          </div>
        </div>

        <!-- Trending / Popular Posts Widget -->
        <div class="sidebar-widget">
          <h3 class="sidebar-widget-title">Trending Now</h3>
          <ol class="popular-posts-list">
            <li class="popular-posts-item">
              <span class="popular-posts-rank">1</span>
              <a href="seo-checklist-2026.html" class="popular-posts-link">The Ultimate High-SEO Website Audit Checklist</a>
            </li>
            <li class="popular-posts-item">
              <span class="popular-posts-rank">2</span>
              <a href="maximizing-core-web-vitals.html" class="popular-posts-link">Maximizing Core Web Vitals: A Deep Dive into Page Speed</a>
            </li>
            <li class="popular-posts-item">
              <span class="popular-posts-rank">3</span>
              <a href="next-gen-web-design.html" class="popular-posts-link">Next-Gen Web Design: Blending Aesthetics with Speed</a>
            </li>
          </ol>
        </div>
      </aside>
    </div>
  </main>

  <!-- Footer Section -->
  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <div class="footer-brand"><span>Aura</span>Blog</div>
        <p class="footer-desc">A premium blogging site focused on the absolute intersection of modern aesthetics, seamless web performance, and search engine optimization.</p>
      </div>
      <div>
        <h3 class="footer-title">Navigation</h3>
        <ul class="footer-links">
          <li><a href="../index.html">Home</a></li>
          <li><a href="../about.html">About</a></li>
          <li><a href="../contact.html">Contact</a></li>
          <li><a href="../privacy.html">Privacy Policy</a></li>
        </ul>
      </div>
      <div>
        <h3 class="footer-title">Contact & Info</h3>
        <ul class="footer-links">
          <li>Email: hello@aurablog.com</li>
          <li>Location: SF, California</li>
        </ul>
      </div>
    </div>
  </footer>

  <script src="../js/main.js"></script>
</body>
</html>`;
}

/**
 * Present compiled outputs in Live Preview, HTML viewer, and Download Tab panels
 */
function presentPostOutputs(topic, htmlContent) {
  // 1. Hide Empty States
  document.getElementById('preview-empty').style.display = 'none';
  document.getElementById('code-empty').style.display = 'none';
  document.getElementById('publish-empty').style.display = 'none';

  // 2. Setup Live Preview Iframe
  const iframe = document.getElementById('article-preview-frame');
  iframe.style.display = 'block';
  
  // We write the HTML content to the iframe document object.
  // Note: we replace relative stylesheet paths "../css/main.css" with local paths "css/main.css"
  // so the stylesheet loads correctly in the iframe context!
  const previewHtml = htmlContent
    .replaceAll('../css/', 'css/')
    .replaceAll('../js/', 'js/')
    .replaceAll('../assets/', 'assets/');

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(previewHtml);
  iframeDoc.close();

  // 3. Setup Source Code tab
  const codeBox = document.getElementById('code-viewer-box');
  const codeTag = document.getElementById('code-viewer');
  codeBox.style.display = 'block';
  codeTag.textContent = htmlContent;

  // 4. Setup Download / Publish tab
  const publishActive = document.getElementById('publish-active');
  publishActive.style.display = 'block';
  document.getElementById('publish-card-title').textContent = topic.title;
  document.getElementById('publish-card-desc').textContent = topic.excerpt;
}
