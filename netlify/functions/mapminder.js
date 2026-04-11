// Netlify Function — Map Minder API Proxy
// Sits between the browser and Anthropic API
// Keeps the API key secure on the server side

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
    const { messages, system } = body;

    if (!messages || !system) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing messages or system prompt' })
      };
    }

    // Call Anthropic API with the key from environment
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
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
