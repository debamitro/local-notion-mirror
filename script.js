class ChatApp {
    constructor() {
        this.messagesContainer = document.getElementById('messages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatForm = document.getElementById('chatForm');
        this.notionButton = document.getElementById('notionButton');
        this.notionConnected = false;
        this.tokenModal = document.getElementById('tokenModal');
        this.tokenInput = document.getElementById('tokenInput');
        this.submitTokenButton = document.getElementById('submitToken');
        this.cancelTokenButton = document.getElementById('cancelToken');
        
        this.initializeEventListeners();
        this.addWelcomeMessage();
        this.checkNotionStatus();
    }

    initializeEventListeners() {
        this.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.notionButton.addEventListener('click', () => {
            this.toggleNotionConnection();
        });

        this.submitTokenButton.addEventListener('click', () => {
            this.handleTokenSubmit();
        });

        this.cancelTokenButton.addEventListener('click', () => {
            this.hideTokenModal();
        });

        this.tokenInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleTokenSubmit();
            }
        });
    }

    addWelcomeMessage() {
        this.addMessage('assistant', 'Hello! I\'m connected to Ollama. Ask me anything!');
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message) return;

        this.addMessage('user', message);
        this.messageInput.value = '';
        this.setLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Network response was not ok');
            }

            this.addMessage('assistant', data.response);
        } catch (error) {
            console.error('Error:', error);
            this.addMessage('assistant', `Error: ${error.message}`);
        } finally {
            this.setLoading(false);
        }
    }

    addMessage(sender, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);
        
        this.scrollToBottom();
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.sendButton.disabled = true;
            this.sendButton.textContent = 'Sending...';
            this.messageInput.disabled = true;
            
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'message assistant';
            loadingDiv.id = 'loading-message';
            
            const loadingContent = document.createElement('div');
            loadingContent.className = 'message-content loading';
            loadingContent.innerHTML = '<div class="spinner"></div> Thinking...';
            
            loadingDiv.appendChild(loadingContent);
            this.messagesContainer.appendChild(loadingDiv);
            this.scrollToBottom();
        } else {
            this.sendButton.disabled = false;
            this.sendButton.textContent = 'Send';
            this.messageInput.disabled = false;
            this.messageInput.focus();
            
            const loadingMessage = document.getElementById('loading-message');
            if (loadingMessage) {
                loadingMessage.remove();
            }
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async checkNotionStatus() {
        try {
            const response = await fetch('/api/notion/status');
            const data = await response.json();
            this.updateNotionButton(data.connected);
        } catch (error) {
            console.error('Error checking Notion status:', error);
        }
    }

    async toggleNotionConnection() {
        if (this.notionConnected) {
            await this.disconnectNotion();
        } else {
            this.showTokenModal();
        }
    }

    showTokenModal() {
        this.tokenModal.style.display = 'block';
        this.tokenInput.value = '';
        this.tokenInput.focus();
    }

    hideTokenModal() {
        this.tokenModal.style.display = 'none';
        this.tokenInput.value = '';
    }

    async handleTokenSubmit() {
        const token = this.tokenInput.value.trim();
        
        if (!token) {
            this.addMessage('assistant', 'Please enter a valid authorization token.');
            return;
        }

        this.hideTokenModal();
        await this.connectNotion(token);
    }

    async connectNotion(token) {
        try {
            this.notionButton.disabled = true;
            this.notionButton.textContent = 'Connecting...';

            const response = await fetch('/api/notion/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ apiKey: token })
            });

            const data = await response.json();

            if (data.success) {
                this.updateNotionButton(true);
                this.addMessage('assistant', 'Connected to Notion MCP server! Click the "View Pages" button to see your Notion pages.');
                this.createViewPagesButton();
            } else {
                throw new Error(data.error || 'Failed to connect');
            }
        } catch (error) {
            console.error('Error connecting to Notion:', error);
            this.addMessage('assistant', `Failed to connect to Notion: ${error.message}`);
            this.updateNotionButton(false);
        }
    }

    async disconnectNotion() {
        try {
            const response = await fetch('/api/notion/disconnect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (data.success) {
                this.updateNotionButton(false);
                this.addMessage('assistant', 'Disconnected from Notion MCP server.');
            }
        } catch (error) {
            console.error('Error disconnecting from Notion:', error);
            this.addMessage('assistant', `Failed to disconnect from Notion: ${error.message}`);
        }
    }

    updateNotionButton(connected) {
        this.notionConnected = connected;
        this.notionButton.disabled = false;
        this.notionButton.textContent = connected ? 'Disconnect Notion' : 'Connect to Notion';
        
        // Remove view pages button when disconnected
        if (!connected) {
            const viewPagesButton = document.getElementById('viewPagesButton');
            if (viewPagesButton) {
                viewPagesButton.remove();
            }
        }
    }

    createViewPagesButton() {
        // Remove existing button if it exists
        const existingButton = document.getElementById('viewPagesButton');
        if (existingButton) {
            existingButton.remove();
        }

        // Create new button
        const viewPagesButton = document.createElement('button');
        viewPagesButton.id = 'viewPagesButton';
        viewPagesButton.className = 'notion-button';
        viewPagesButton.textContent = 'View Pages';
        viewPagesButton.onclick = () => this.fetchAndDisplayPages();

        // Add button next to Notion button
        this.notionButton.parentNode.insertBefore(viewPagesButton, this.notionButton.nextSibling);
    }

    async fetchAndDisplayPages() {
        try {
            const viewPagesButton = document.getElementById('viewPagesButton');
            viewPagesButton.disabled = true;
            viewPagesButton.textContent = 'Loading...';

            const response = await fetch('/api/notion/pages');
            const data = await response.json();

            if (response.ok) {
                let message = 'Here are your Notion pages:\n\n';
                data.pages.forEach(page => {
                    const title = page.properties?.title?.title?.[0]?.text?.content || page.properties?.Name?.title?.[0]?.text?.content || 'Untitled';
                    const url = page.url;
                    message += `• [${title}](${url})\n`;
                });

                this.addMessage('assistant', message);
            } else {
                throw new Error(data.error || 'Failed to fetch Notion pages');
            }

            viewPagesButton.disabled = false;
            viewPagesButton.textContent = 'View Pages';
        } catch (error) {
            console.error('Error fetching Notion pages:', error);
            this.addMessage('assistant', `Error: ${error.message}`);
            const viewPagesButton = document.getElementById('viewPagesButton');
            if (viewPagesButton) {
                viewPagesButton.disabled = false;
                viewPagesButton.textContent = 'View Pages';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});