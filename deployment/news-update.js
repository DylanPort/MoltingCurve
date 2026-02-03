// Updated fetchNews function with images and multiple categories
async function fetchNews() {
  try {
    const allNews = [];
    
    // 1. Crypto news from CryptoCompare (includes images)
    try {
      const cryptoRes = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
      const cryptoData = await cryptoRes.json();
      const cryptoNews = (cryptoData.Data || []).slice(0, 15).map(item => ({
        id: `crypto-${item.id}`,
        title: item.title,
        description: item.body?.slice(0, 200) || '',
        source: item.source || 'Crypto',
        category: 'crypto',
        image_url: item.imageurl || null,
        url: item.url || item.guid,
        published_at: new Date(item.published_on * 1000).toISOString()
      }));
      allNews.push(...cryptoNews);
    } catch (e) { console.error('Crypto news fetch error:', e); }
    
    // 2. General/Politics/Tech news from GNews API (free tier)
    const gnewsKey = '4c8fabc5e17d0f12fcf7b97cdf81fde5';
    const categories = [
      { cat: 'politics', query: 'world politics government' },
      { cat: 'general', query: 'breaking news today' },
      { cat: 'tech', query: 'technology AI software' }
    ];
    
    for (const { cat, query } of categories) {
      try {
        const res = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=5&apikey=${gnewsKey}`);
        const data = await res.json();
        if (data.articles) {
          const catNews = data.articles.map((item, i) => ({
            id: `${cat}-${Date.now()}-${i}`,
            title: item.title,
            description: item.description || '',
            source: item.source?.name || 'News',
            category: cat,
            image_url: item.image || null,
            url: item.url,
            published_at: item.publishedAt || new Date().toISOString()
          }));
          allNews.push(...catNews);
        }
      } catch (e) { console.error(`${cat} news fetch error:`, e); }
    }
    
    // Sort by date and limit
    newsCache = allNews
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .slice(0, 30);
    
    lastNewsFetch = Date.now();
    console.log(`📰 Fetched ${newsCache.length} news items (crypto: ${newsCache.filter(n=>n.category==='crypto').length}, politics: ${newsCache.filter(n=>n.category==='politics').length}, general: ${newsCache.filter(n=>n.category==='general').length}, tech: ${newsCache.filter(n=>n.category==='tech').length})`);
  } catch (e) { console.error('News fetch error:', e); }
}
