// Netlify Function — Trigger Decoder API Proxy
// Sits between the browser and Anthropic API
// Keeps the API key secure on the server side
//
// Supports two modes via the `mode` parameter:
//   - "reading"  → main Trigger Decoder reading (Sonnet, ~20 sec, full response)
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
    // Both modes use Haiku 4.5 — fast enough to fit comfortably under Netlify
    // function timeouts even at peak Sunday API load. Framework prompt does
    // the heavy lifting; Haiku is plenty capable for the diagnostic register.
    // Sonnet 4.5 retired May 18, 2026. Sonnet 4.6 tested but caused intermittent
    // 504 timeouts during peak periods.
    const isClassify = (mode === 'classify');
    const model = 'claude-haiku-4-5-20251001';
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
