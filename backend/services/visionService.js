const crypto = require('crypto');

// Prompts the AI model to return JSON matching this schema
const PROMPT = `Analyze this product image. Extract and return a JSON object with the following fields:
{
  "name": "Clean, concise name of the product",
  "brand": "Brand or manufacturer name, if visible, otherwise null",
  "category": "Suggested inventory category (e.g., Electronics, Food & Beverage, Apparel, Office Supplies)",
  "description": "Short marketing description based on packaging text or appearance (1-2 sentences)",
  "suggestedSku": "A clean generated SKU code (uppercase, e.g. BRAND-PROD-COLOR)"
}
Return ONLY valid raw JSON. Do not include markdown code block formatting (such as \`\`\`json).`;

const MOCK_PRODUCTS = [
  {
    name: "Classic Stainless Steel Water Bottle",
    brand: "HydroFlow",
    category: "Sports & Outdoors",
    description: "Double-walled vacuum insulated water bottle, 32oz, keep drinks cold for 24 hours.",
    suggestedSku: "HYDRO-FLW-32SS"
  },
  {
    name: "Wireless Mechanical Keyboard",
    brand: "KeyChronicle",
    category: "Electronics",
    description: "Compact 75% layout mechanical keyboard with hot-swappable tactile brown switches and RGB backlighting.",
    suggestedSku: "KEY-CHRN-75M"
  },
  {
    name: "Organic Dark Roast Coffee Beans",
    brand: "BeanStreet",
    category: "Food & Beverage",
    description: "Fair-trade certified single-origin whole bean coffee, bold flavor profile with notes of chocolate.",
    suggestedSku: "BEAN-STR-DARK"
  },
  {
    name: "Minimalist Leather Cardholder",
    brand: "SleekCraft",
    category: "Apparel & Accessories",
    description: "Full-grain leather slim wallet cardholder with 5 card slots and central cash pocket.",
    suggestedSku: "SLK-CRFT-CARD"
  }
];

function getMockProduct() {
  const index = Math.floor(Math.random() * MOCK_PRODUCTS.length);
  return MOCK_PRODUCTS[index];
}

async function extractProductFromImage({ imageBuffer, mimeType, provider, apiKey, useSandbox }) {
  if (useSandbox || !apiKey) {
    // Delay to simulate API call latency
    await new Promise(resolve => setTimeout(resolve, 1500));
    return getMockProduct();
  }

  const base64Data = imageBuffer.toString('base64');

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }

    const data = await response.json();
    try {
      const textResponse = data.candidates[0].content.parts[0].text;
      return JSON.parse(textResponse);
    } catch (e) {
      throw new Error("Failed to parse JSON response from Gemini Vision API: " + e.message);
    }

  } else if (provider === 'openai') {
    const url = 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${base64Data}`
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }

    const data = await response.json();
    try {
      const textResponse = data.choices[0].message.content;
      return JSON.parse(textResponse);
    } catch (e) {
      throw new Error("Failed to parse JSON response from OpenAI Vision API: " + e.message);
    }
  } else {
    throw new Error(`Unsupported Vision API provider: ${provider}`);
  }
}

module.exports = {
  extractProductFromImage
};
