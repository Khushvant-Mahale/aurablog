#!/usr/bin/env python3
"""
AuraBlog Automated Content Generator
Uses Google Gemini API to write articles, Unsplash API to download related images,
and updates homepage cards and sitemaps automatically.
"""

import os
import re
import sys
import json
import datetime
import warnings
import requests
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
from dotenv import load_dotenv

# Suppress XML parsed as HTML warning for sitemaps
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

# Load environment variables
load_dotenv()

# Check for API Keys
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
UNSPLASH_KEY = os.getenv("UNSPLASH_ACCESS_KEY")

# Offline mock topics fallback (in case API keys are missing)
MOCK_TOPICS = [
    {
        "title": "Optimizing CSS for Zero Cumulative Layout Shift (CLS)",
        "slug": "css-cls-optimization-guide",
        "category": "Performance",
        "excerpt": "A deep dive into CSS techniques, aspect-ratio definitions, and dynamic element rendering rules to eliminate layout shifts.",
        "search_keyword": "css code speed",
        "estimated_read_time": "7 min read",
        "author": "Alex Zen"
    },
    {
        "title": "The Impact of Semantic HTML on Search Engine Crawlers",
        "slug": "semantic-html-crawler-seo",
        "category": "SEO",
        "excerpt": "How modern index spiders parse structural cues in semantic elements and what it means for your site's ranking visibility.",
        "search_keyword": "website crawl index",
        "estimated_read_time": "6 min read",
        "author": "Sarah Rose"
    },
    {
        "title": "Designing for Dark Mode: HSL Custom Property Strategies",
        "slug": "hsl-dark-mode-design-tokens",
        "category": "Web Design",
        "excerpt": "Learn to manage colors, borders, and overlays across responsive themes with HSL tailored variables and custom style properties.",
        "search_keyword": "color theme palettes",
        "estimated_read_time": "5 min read",
        "author": "Sarah Rose"
    }
]

def check_dependencies():
    """Verify standard google-genai package is installed if in online mode."""
    if GEMINI_KEY:
        try:
            from google import genai
            return genai
        except ImportError:
            print("Warning: google-genai package is not installed.")
            print("Please run: pip install -r requirements.txt")
            print("Running in Dry-Run fallback mode.\n")
            return None
    return None

def research_trending_topic(genai_module):
    """Pick or generate a trending blog topic."""
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    
    if not GEMINI_KEY or not genai_module:
        # Offline mode: pick a random mock topic and update the timestamp
        import random
        topic = random.choice(MOCK_TOPICS).copy()
        topic["date"] = date_str
        print(f"[Offline Mode] Selected Mock Topic: '{topic['title']}'")
        return topic
        
    print("Connecting to Gemini API to research trending topic...")
    # Requesting structured JSON details from Gemini
    prompt = """
    Identify one highly trending, searched-for topic in web design, SEO, or web performance.
    Provide a JSON response with the following keys. Do not include markdown wraps around the JSON.
    {
      "title": "A compelling, keyword-rich article title under 60 characters",
      "slug": "lowercase-hyphenated-slug-for-filename",
      "category": "SEO" or "Web Design" or "Performance",
      "excerpt": "A short, engaging summary of the article under 160 characters",
      "search_keyword": "A simple 2-word phrase to search Unsplash for a related background photo (e.g. 'coding screen', 'speedometer', 'seo chart')",
      "estimated_read_time": "X min read",
      "author": "Alex Zen" or "Sarah Rose"
    }
    """
    try:
        client = genai_module.Client(api_key=GEMINI_KEY)
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt
        )
        text = response.text.strip()
        
        # Clean any markdown code block backticks if Gemini includes them
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        topic = json.loads(text)
        topic["date"] = date_str
        print(f"Gemini Selected Topic: '{topic['title']}' (Category: {topic['category']})")
        return topic
    except Exception as e:
        print(f"API Error in topic generation: {e}. Falling back to mock topics.")
        import random
        topic = random.choice(MOCK_TOPICS).copy()
        topic["date"] = date_str
        return topic

def download_web_image(keyword, slug):
    """Search Unsplash API and download a related photo to local assets."""
    assets_dir = os.path.join(os.getcwd(), "assets", "images")
    os.makedirs(assets_dir, exist_ok=True)
    local_path = f"assets/images/{slug}.jpg"
    
    # Check Unsplash credentials
    if not UNSPLASH_KEY or UNSPLASH_KEY == "your_unsplash_access_key_here":
        print(f"No Unsplash key found. Generating styled SVG placeholder for '{keyword}'...")
        return generate_svg_placeholder(keyword, slug)
        
    print(f"Searching Unsplash for image related to: '{keyword}'...")
    url = "https://api.unsplash.com/search/photos"
    headers = {"Authorization": f"Client-ID {UNSPLASH_KEY}"}
    params = {"query": keyword, "per_page": 1, "orientation": "landscape"}
    
    try:
        r = requests.get(url, headers=headers, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        
        if data["results"]:
            img_url = data["results"][0]["urls"]["regular"]
            # Download the image
            print(f"Downloading image from: {img_url}")
            img_r = requests.get(img_url, timeout=15)
            img_r.raise_for_status()
            
            with open(local_path, "wb") as f:
                f.write(img_r.content)
            print(f"Successfully saved image to: {local_path}")
            return f"../{local_path}" # Relative path for posts/*.html files
        else:
            print("No Unsplash results. Generating SVG placeholder.")
            return generate_svg_placeholder(keyword, slug)
    except Exception as e:
        print(f"Failed to fetch image from Unsplash: {e}. Generating SVG placeholder.")
        return generate_svg_placeholder(keyword, slug)

def generate_svg_placeholder(keyword, slug):
    """Fallback generator creating a clean, styled SVG placeholder saved as a file."""
    local_path = f"assets/images/{slug}.svg"
    svg_content = f"""<svg width="800" height="450" viewBox="0 0 800 450" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="450" fill="#1E293B"/>
      <circle cx="400" cy="225" r="100" fill="#6366F1" fill-opacity="0.1" stroke="#6366F1" stroke-opacity="0.3" stroke-width="4"/>
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#E2E8F0" font-family="sans-serif" font-size="28" font-weight="bold">{keyword.upper()}</text>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#64748B" font-family="sans-serif" font-size="16">AuraBlog AI Feature</text>
    </svg>"""
    try:
        with open(local_path, "w") as f:
            f.write(svg_content)
        print(f"Saved SVG placeholder to: {local_path}")
        return f"../{local_path}"
    except Exception as e:
        print(f"Error generating SVG file: {e}")
        return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450'><rect width='100%' height='100%' fill='%231e293b'/></svg>"

def generate_article_content(genai_module, topic):
    """Write the full HTML article body using Gemini."""
    if not GEMINI_KEY or not genai_module:
        # Offline mode mock content
        print("[Offline Mode] Generating template article body...")
        return f"""
        <p>Welcome to this automated article on <strong>{topic['title']}</strong>. In this review, we'll break down why this topic is trending in the industry and how it affects your site's structure.</p>
        <h2>The Core Concepts</h2>
        <p>Understanding the fundamental layers of {topic['category']} is essential to achieving consistent Google Lighthouse scores. When building layouts, developers must maintain strict control over DOM nodes, styles, and Javascript execution budgets.</p>
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
        <p>By following these standard practices, you will establish a solid foundation that search crawlers trust and visitors enjoy browsing.</p>
        """
        
    print(f"Generating full article copywriting for '{topic['title']}'...")
    prompt = f"""
    Write a detailed, engaging, and professional web developer article about: '{topic['title']}'.
    The category is: {topic['category']}.
    The target audience consists of professional web developers, designers, and SEO specialists.
    
    Requirements:
    1. Output ONLY the HTML contents that will go INSIDE the article body (e.g. paragraph tags <p>, H2 headings <h2>, H3 headings <h3>, list items <ul>/<li>, and blockquotes <blockquote>).
    2. Write at least 4-5 detailed paragraphs.
    3. Include a <blockquote> with a short, inspiring quote related to web quality.
    4. Provide some code blocks or concrete technical examples if applicable.
    5. Do not include H1 tags, html wraps, or markdown backticks around your output.
    """
    try:
        client = genai_module.Client(api_key=GEMINI_KEY)
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt
        )
        text = response.text.strip()
        
        # Strip any accidental markdown blocks
        if text.startswith("```html"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()
    except Exception as e:
        print(f"API Error in article body generation: {e}. Falling back to template text.")
        return f"<p>Error generating content body. Topic was: {topic['title']}. Please check your API key configuration.</p>"

def save_article_file(topic, content_html, image_path):
    """Write the complete formatted HTML post page."""
    posts_dir = os.path.join(os.getcwd(), "posts")
    os.makedirs(posts_dir, exist_ok=True)
    post_path = os.path.join(posts_dir, f"{topic['slug']}.html")
    
    # We load variables from root variables.css
    # and main.css. Note relative imports (../css/...)
    
    # JSON-LD Schema
    schema_json = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": f"https://aurablog.com/posts/{topic['slug']}.html"
      },
      "headline": topic["title"],
      "description": topic["excerpt"],
      "image": f"https://aurablog.com/{image_path.replace('../', '')}",
      "datePublished": f"{topic['date']}T08:00:00+00:00",
      "dateModified": f"{topic['date']}T08:00:00+00:00",
      "author": {
        "@type": "Person",
        "name": topic["author"],
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
    }
    
    avatar_initials = "".join([n[0] for n in topic["author"].split()]).upper()
    avatar_color = "#6366F1" if topic["author"] == "Alex Zen" else "#06B6D4"

    full_html = f"""<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary SEO Meta Tags -->
  <title>{topic['title']} | AuraBlog</title>
  <meta name="description" content="{topic['excerpt']}">
  <link rel="canonical" href="https://aurablog.com/posts/{topic['slug']}.html">
  <meta name="robots" content="index, follow">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://aurablog.com/posts/{topic['slug']}.html">
  <meta property="og:title" content="{topic['title']} | AuraBlog">
  <meta property="og:description" content="{topic['excerpt']}">
  <meta property="og:image" content="https://aurablog.com/{image_path.replace('../', '')}">
  
  <!-- Stylesheets -->
  <link rel="stylesheet" href="../css/variables.css?v=2">
  <link rel="stylesheet" href="../css/main.css?v=2">
  
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%236366f1'/><path d='M30 70V30l40 40V30' stroke='white' stroke-width='10' stroke-linecap='round' stroke-linejoin='round' fill='none'/></svg>">

  <!-- JSON-LD BlogPosting Schema -->
  <script type="application/ld+json">
  {json.dumps(schema_json, indent=2)}
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
        <button class="mobile-menu-btn" aria-label="Toggle navigation drawer" id="mobile-toggle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
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
          <span class="article-category">{topic['category']}</span>
          <h1 class="article-title">{topic['title']}</h1>
          <div class="article-meta">
            <div class="article-author-info">
              <svg width="32" height="32" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="{avatar_color}"/><text x="50" y="55" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Outfit" font-size="30" font-weight="700">{avatar_initials}</text></svg>
              <span>{topic['author']}</span>
            </div>
            <span>•</span>
            <time datetime="{topic['date']}">{datetime.datetime.strptime(topic['date'], "%Y-%m-%d").strftime("%B %d, %Y")}</time>
            <span>•</span>
            <span>{topic['estimated_read_time']}</span>
          </div>
        </header>

        <!-- Hero Image -->
        <img class="article-hero-image" src="{image_path}" alt="{topic['title']}" width="800" height="450">

        <!-- Content Body -->
        <div class="article-content">
          {content_html}
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
            <svg width="40" height="40" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="{avatar_color}"/><text x="50" y="55" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Outfit" font-size="30" font-weight="700">{avatar_initials}</text></svg>
          </div>
          <div class="author-widget-name">{topic['author']}</div>
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
          <li><a href="../sitemap.xml">Sitemap</a></li>
        </ul>
      </div>
      <div>
        <h3 class="footer-title">Contact & Info</h3>
        <ul class="footer-links">
          <li><a href="../contact.html">Send a Message</a></li>
          <li>Email: hello@aurablog.com</li>
          <li>Location: SF, California</li>
        </ul>
      </div>
    </div>
    <div class="container footer-bottom">
      <p>&copy; 2026 AuraBlog. Built for maximum SEO. All rights reserved.</p>
      <p>Theme: Modern Glassmorphic</p>
    </div>
  </footer>

  <!-- Cookie Consent compliance Banner -->
  <div class="cookie-banner hidden" id="cookie-banner" role="region" aria-label="Cookie Consent Banner">
    <div class="container cookie-banner-content">
      <p class="cookie-banner-text">We use cookies to personalize content, ads, and to analyze traffic. By clicking "Accept All", you agree to our use of cookies. Read our <a href="../privacy.html">Privacy Policy</a>.</p>
      <div class="cookie-banner-actions">
        <button class="btn btn-primary cookie-banner-btn cookie-banner-accept-btn" id="cookie-accept">Accept All</button>
      </div>
    </div>
  </div>

  <script src="../js/main.js"></script>
</body>
</html>
"""
    with open(post_path, "w", encoding="utf-8") as f:
        f.write(full_html)
    print(f"Saved complete article to: {post_path}")
    return f"posts/{topic['slug']}.html"

def inject_homepage_card(topic, image_path):
    """Modify index.html to insert a new blog post card at the top of the feed."""
    index_path = os.path.join(os.getcwd(), "index.html")
    if not os.path.exists(index_path):
        print(f"Error: index.html not found at: {index_path}")
        return False
        
    print("Modifying index.html to inject new post card...")
    with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()
        
    soup = BeautifulSoup(html, "html.parser")
    posts_grid = soup.find(class_="posts-grid")
    
    if not posts_grid:
        print("Error: Could not locate element with class '.posts-grid' inside index.html")
        return False
        
    # Check if a card with this slug already exists to prevent duplicates
    post_url = f"posts/{topic['slug']}.html"
    existing_link = posts_grid.find("a", href=post_url)
    if existing_link:
        print(f"A card pointing to '{post_url}' already exists. Replacing it.")
        # Find the parent card and remove it
        existing_card = existing_link.find_parent("article")
        if existing_card:
            existing_card.decompose()

    # Create the card HTML
    date_formatted = datetime.datetime.strptime(topic['date'], "%Y-%m-%d").strftime("%B %d, %Y")
    
    # Format image path for homepage (strip leading '../' if it exists)
    homepage_img_path = image_path.replace("../", "")
    
    avatar_initials = "".join([n[0] for n in topic["author"].split()]).upper()
    avatar_color = "#6366F1" if topic["author"] == "Alex Zen" else "#06B6D4"
    
    card_html = f"""<article class="post-card">
              <div class="post-card-img-wrapper">
                <img class="post-card-img" src="{homepage_img_path}" alt="{topic['title']}" style="width:100%; height:100%; object-fit:cover;">
              </div>
              <div class="post-card-content">
                <div class="post-card-meta">
                  <span class="post-card-tag">{topic['category']}</span>
                  <span>•</span>
                  <time datetime="{topic['date']}">{date_formatted}</time>
                </div>
                <h3 class="post-card-title"><a href="{post_url}">{topic['title']}</a></h3>
                <p class="post-card-excerpt">{topic['excerpt']}</p>
                <div class="post-card-footer">
                  <span class="post-card-author">
                    <svg width="24" height="24" viewBox="0 0 100 100" style="display:inline-block; vertical-align:middle; margin-right:4px;"><circle cx="50" cy="50" r="50" fill="{avatar_color}"/><text x="50" y="55" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Outfit" font-size="30" font-weight="700">{avatar_initials}</text></svg>
                    {topic['author']}
                  </span>
                  <span>{topic['estimated_read_time']}</span>
                </div>
              </div>
            </article>"""
            
    # Parse card and insert as first child of grid
    card_soup = BeautifulSoup(card_html, "html.parser")
    posts_grid.insert(0, card_soup.article)
    
    # Save the index file with clean indent structure
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(str(soup))
    print("Successfully injected post card into index.html homepage feed.")
    return True

def append_sitemap_url(slug, date):
    """Modify sitemap.xml to index the new article."""
    sitemap_path = os.path.join(os.getcwd(), "sitemap.xml")
    if not os.path.exists(sitemap_path):
        print(f"Error: sitemap.xml not found at: {sitemap_path}")
        return False
        
    print("Modifying sitemap.xml to register new URL...")
    with open(sitemap_path, "r", encoding="utf-8") as f:
        xml = f.read()
        
    soup = BeautifulSoup(xml, "html.parser") # standard built-in parser
    urlset = soup.find("urlset")
    
    if not urlset:
        print("Error: Could not locate <urlset> inside sitemap.xml")
        return False
        
    post_url = f"https://aurablog.com/posts/{slug}.html"
    
    # Check for duplicates
    existing_url = urlset.find("loc", string=post_url)
    if existing_url:
        print(f"Sitemap entry for '{post_url}' already exists. Skipping.")
        return True
        
    # Create the URL element structure
    new_url_tag = soup.new_tag("url")
    
    loc_tag = soup.new_tag("loc")
    loc_tag.string = post_url
    
    lastmod_tag = soup.new_tag("lastmod")
    lastmod_tag.string = date
    
    changefreq_tag = soup.new_tag("changefreq")
    changefreq_tag.string = "monthly"
    
    priority_tag = soup.new_tag("priority")
    priority_tag.string = "0.9"
    
    new_url_tag.append(loc_tag)
    new_url_tag.append(lastmod_tag)
    new_url_tag.append(changefreq_tag)
    new_url_tag.append(priority_tag)
    
    urlset.append(new_url_tag)
    
    with open(sitemap_path, "w", encoding="utf-8") as f:
        f.write(str(soup))
    print("Successfully appended new URL entry to sitemap.xml.")
    return True

def main():
    print("=== AuraBlog AI Generator Started ===")
    genai_module = check_dependencies()
    
    # 1. Research / Select Topic
    topic = research_trending_topic(genai_module)
    
    # 2. Search & Download web image from Unsplash
    image_path = download_web_image(topic["search_keyword"], topic["slug"])
    
    # 3. Generate article HTML copy
    content_html = generate_article_content(genai_module, topic)
    
    # 4. Save the HTML page
    post_rel_path = save_article_file(topic, content_html, image_path)
    
    # 5. Inject card into homepage index grid
    inject_homepage_card(topic, image_path)
    
    # 6. Register URL in sitemap index
    append_sitemap_url(topic["slug"], topic["date"])
    
    print("\n=== Generator Completed Successfully ===")
    print(f"New post is available at: {post_rel_path}")

if __name__ == "__main__":
    main()
