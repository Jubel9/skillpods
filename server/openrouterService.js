// server/openrouterService.js
require('dotenv').config();
const axios = require('axios');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// REFACTORED to accept a messages array
async function generateApiResponse(messages) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OpenRouter API key is not set in .env file.');
    }
    if (!messages || messages.length === 0) {
        throw new Error('Messages array cannot be empty.');
    }

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: "deepseek/deepseek-r1-0528:free", // Using the specified free model
                messages: messages
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        handleApiError(error);
    }
}

function handleApiError(error) {
    if (error.response) {
        console.error('API Error Response:', error.response.data);
    } else {
        console.error('Error making API request:', error.message);
    }
    throw new Error('Failed to get response from AI service.');
}

module.exports = { generateApiResponse };