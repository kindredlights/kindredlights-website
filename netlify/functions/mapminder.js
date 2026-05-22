// Netlify Function — Map Minder API Proxy
// Sits between the browser and Anthropic API
// Keeps the API key secure on the server side
//
// Supports two modes via the `mode` parameter:
//   - "reading"  → main Map Minder reading (Sonnet, ~20 sec, full response)
//   - "classify" → pre-screen for crisis content (Haiku, ~2 sec, JSON only)
//
// Default mode is "reading" for backward compatibility.

exports.handler = async function(event, context) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // CORS headers — allow kindredlights.org to call this
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const body = JSON.parse(event.body);
    const { messages, system, mode } = body;

    if (!messages || !system) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing messages or system prompt' })
      };
    }

    // Choose model and token budget based on mode
    // "classify" uses Haiku 4.5 — fast and cheap, plenty for binary classification
    // "reading" (default) uses Sonnet 4.5 — calibrated against this lineage,
    //   replaces the deprecated claude-sonnet-4-20250514 retiring June 15, 2026.
    //   Note: Sonnet 4.6 was tested but caused function timeouts due to slower
    //   generation; 4.5 is the right balance of capability and speed for the spec.
    const isClassify = (mode === 'classify');
    const model = isClassify
      ? 'claude-haiku-4-5-20251001'
      : 'claude-sonnet-4-5-20250929';
    const maxTokens = isClassify ? 200 : 2000;

    // Call Anthropic API with the key from environment
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        system: system,
        messages: messages
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'API error', detail: err })
      };
    }

    const data = await response.json();
    const text = data.content[0].text;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text })
    };

  } catch(e) {
    console.error('Function error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error', detail: e.message })
    };
  }
};
