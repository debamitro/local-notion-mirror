const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

let mcpConnected = false;
let authToken = null;
const NOTION_API_URL = 'https://api.notion.com';

const notionClient = {
    async connect(apiKey) {
        if (!apiKey) {
            throw new Error('API key is required');
        }

        try {
            const response = await fetch(`${NOTION_API_URL}/v1/users/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Notion-Version': '2022-06-28'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to connect to Notion MCP: ${response.statusText}`);
            }

            authToken = apiKey;
            mcpConnected = true;
            console.log('Successfully connected to Notion MCP');
        } catch (error) {
            console.error('Error connecting to Notion MCP:', error);
            mcpConnected = false;
        }
    },

    isConnected() {
        return mcpConnected;
    },

    async getPages() {
        if (!mcpConnected || !authToken) {
            throw new Error('Not connected to Notion');
        }

        const response = await fetch(`${NOTION_API_URL}/v1/search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: { property: 'object', value: 'page' }
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch Notion pages: ${response.statusText}`);
        }

        const data = await response.json();
        return data.results;
    }
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Notion MCP connection endpoints
app.post('/api/notion/connect', async (req, res) => {
    try {
        const { apiKey } = req.body;
        
        if (!apiKey) {
            return res.status(400).json({ error: 'API key is required' });
        }

        await notionClient.connect(apiKey);
        res.json({ success: true });
    } catch (error) {
        console.error('Error connecting to Notion:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/notion/status', (req, res) => {
    res.json({ connected: notionClient.isConnected() });
});

app.post('/api/notion/disconnect', (req, res) => {
    mcpConnected = false;
    authToken = null;
    res.json({ success: true, message: 'Disconnected from Notion' });
});

app.get('/api/notion/pages', async (req, res) => {
    try {
        if (!notionClient.isConnected()) {
            return res.status(401).json({ error: 'Not connected to Notion' });
        }
        const pages = await notionClient.getPages();
        res.json({ pages });
    } catch (error) {
        console.error('Error fetching Notion pages:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gemma3:4b',
                prompt: message,
                stream: false
            })
        });

        if (!ollamaResponse.ok) {
            throw new Error(`Ollama API error: ${ollamaResponse.status}`);
        }

        const data = await ollamaResponse.json();
        res.json({ response: data.response });

    } catch (error) {
        console.error('Error calling Ollama:', error);
        
        if (error.code === 'ECONNREFUSED') {
            res.status(503).json({ 
                error: 'Unable to connect to Ollama. Make sure Ollama is running on localhost:11434' 
            });
        } else {
            res.status(500).json({ 
                error: 'Internal server error. Please try again.' 
            });
        }
    }
});

app.get('/api/models', async (req, res) => {
    try {
        const ollamaResponse = await fetch('http://localhost:11434/api/tags');
        
        if (!ollamaResponse.ok) {
            throw new Error(`Ollama API error: ${ollamaResponse.status}`);
        }

        const data = await ollamaResponse.json();
        res.json(data);

    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ 
            error: 'Unable to fetch available models' 
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Try to load SSL certificates, fallback to HTTP if not found
let server;
try {
    const privateKey = fs.readFileSync('./ssl/private-key.pem', 'utf8');
    const certificate = fs.readFileSync('./ssl/certificate.pem', 'utf8');
    const credentials = { key: privateKey, cert: certificate };
    
    server = https.createServer(credentials, app);
    server.listen(PORT, () => {
        console.log(`HTTPS Server running on https://localhost:${PORT}`);
        console.log('Make sure Ollama is running on http://localhost:11434');
    });
} catch (error) {
    console.log('SSL certificates not found, falling back to HTTP');
    console.log('To enable HTTPS, run: npm run generate-certs');
    server = app.listen(PORT, () => {
        console.log(`HTTP Server running on http://localhost:${PORT}`);
        console.log('Make sure Ollama is running on http://localhost:11434');
    });
}