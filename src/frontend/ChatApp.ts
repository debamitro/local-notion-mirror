import { NotionPage } from "./NotionPage";

export class ChatApp {
    private messagesContainer: HTMLElement;
    private messageInput: HTMLInputElement;
    private sendButton: HTMLButtonElement;
    private chatForm: HTMLFormElement;
    private notionButton: HTMLButtonElement;
    private notionConnected: boolean;
    private tokenModal: HTMLElement;
    private tokenInput: HTMLInputElement;
    private submitTokenButton: HTMLButtonElement;
    private cancelTokenButton: HTMLButtonElement;

    constructor() {
        this.messagesContainer = document.getElementById('messages') as HTMLElement;
        this.messageInput = document.getElementById('messageInput') as HTMLInputElement;
        this.sendButton = document.getElementById('sendButton') as HTMLButtonElement;
        this.chatForm = document.getElementById('chatForm') as HTMLFormElement;
        this.notionButton = document.getElementById('notionButton') as HTMLButtonElement;
        this.notionConnected = false;
        this.tokenModal = document.getElementById('tokenModal') as HTMLElement;
        this.tokenInput = document.getElementById('tokenInput') as HTMLInputElement;
        this.submitTokenButton = document.getElementById('submitToken') as HTMLButtonElement;
        this.cancelTokenButton = document.getElementById('cancelToken') as HTMLButtonElement;
        
        this.initializeEventListeners();
        this.checkNotionStatus();
    }

    private initializeEventListeners(): void {
        this.chatForm.addEventListener('submit', (e: Event) => {
            e.preventDefault();
            this.sendMessage();
        });

        this.messageInput.addEventListener('keydown', (e: KeyboardEvent) => {
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

        this.tokenInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                this.handleTokenSubmit();
            }
        });
    }

    private async sendMessage(): Promise<void> {
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
            this.addMessage('assistant', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            this.setLoading(false);
        }
    }

    private addMessage(sender: 'user' | 'assistant', content: string): void {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);
        
        this.scrollToBottom();
    }

    private setLoading(isLoading: boolean): void {
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

    private scrollToBottom(): void {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    private async checkNotionStatus(): Promise<void> {
        try {
            const response = await fetch('/api/notion/status');
            const data = await response.json();
            this.updateNotionButton(data.connected);
        } catch (error) {
            console.error('Error checking Notion status:', error);
        }
    }

    private async toggleNotionConnection(): Promise<void> {
        if (this.notionConnected) {
            await this.disconnectNotion();
        } else {
            this.showTokenModal();
        }
    }

    private showTokenModal(): void {
        this.tokenModal.style.display = 'block';
        this.tokenInput.value = '';
        this.tokenInput.focus();
    }

    private hideTokenModal(): void {
        this.tokenModal.style.display = 'none';
        this.tokenInput.value = '';
    }

    private async handleTokenSubmit(): Promise<void> {
        const token = this.tokenInput.value.trim();
        
        if (!token) {
            this.addMessage('assistant', 'Please enter a valid authorization token.');
            return;
        }

        this.hideTokenModal();
        await this.connectNotion(token);
    }

    private async connectNotion(token: string): Promise<void> {
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
                this.addMessage('assistant', 'Connected to Notion! Click the "View Pages" button to see your Notion pages.');
                this.createViewPagesButton();
            } else {
                throw new Error(data.error || 'Failed to connect');
            }
        } catch (error) {
            console.error('Error connecting to Notion:', error);
            this.addMessage('assistant', `Failed to connect to Notion: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.updateNotionButton(false);
        }
    }

    private async disconnectNotion(): Promise<void> {
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
            this.addMessage('assistant', `Failed to disconnect from Notion: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private createCopyToChatButton(pagesContainer: HTMLElement, text: string, content: string): HTMLButtonElement {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-content-button';
        copyButton.textContent = text;
        copyButton.addEventListener('click', async () => {
            const selectedCheckboxes = Array.from(pagesContainer.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'));
            if (selectedCheckboxes.length === 0) {
                this.addMessage('assistant', 'Please select at least one page to copy.');
                return;
            }

            let combinedContent = '';
            for (const checkbox of selectedCheckboxes) {
                const pageContainer = checkbox.closest('.page-container') as HTMLElement;
                const pageButton = pageContainer?.querySelector('.notion-page-button') as HTMLElement;
                const pageId = pageButton.dataset.pageId;

                if (pageId) {
                    try {
                        const response = await fetch(`/api/notion/pages/${pageId}/content`);
                        const data = await response.json();
                        if (response.ok) {
                            combinedContent += content + data.content + '\n\n';
                        }
                    } catch (error: unknown) {
                        console.error('Error fetching page content:', error);
                    }
                }
            }

            if (combinedContent) {
                this.messageInput.value = combinedContent.trim();
                this.messageInput.focus();
                // Uncheck all checkboxes
                selectedCheckboxes.forEach((checkbox) => {
                    checkbox.checked = false;
                });
            }
        });

        return copyButton;
    }
    
    private updateNotionButton(connected: boolean): void {
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

    private createViewPagesButton(): void {
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
        this.notionButton.parentNode?.insertBefore(viewPagesButton, this.notionButton.nextSibling);
    }

    private async fetchAndDisplayPages(): Promise<void> {
        try {
            const viewPagesButton = document.getElementById('viewPagesButton') as HTMLButtonElement;
            viewPagesButton.disabled = true;
            viewPagesButton.textContent = 'Loading...';

            const response = await fetch('/api/notion/pages');
            const data = await response.json();

            if (response.ok) {
                const message = document.createElement('div');
                message.className = 'message assistant';
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                contentDiv.textContent = 'Here are your Notion pages:';
                
                const pagesContainer = document.createElement('div');
                pagesContainer.className = 'notion-pages-container';
                
                (data.pages as NotionPage[]).forEach(page => {
                    const title = page.properties?.title?.title?.[0]?.text?.content || 
                                page.properties?.Name?.title?.[0]?.text?.content || 
                                'Untitled';
                    
                    const pageContainer = document.createElement('div');
                    pageContainer.className = 'page-container';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'page-checkbox';
                    const pageButton = document.createElement('button');
                    pageButton.className = 'notion-page-button';
                    
                    const pageIcon = document.createElement('span');
                    pageIcon.className = 'page-icon';
                    pageIcon.textContent = '📄';
                    
                    const pageTitle = document.createElement('span');
                    pageTitle.className = 'page-title';
                    pageTitle.textContent = title;
                    
                    pageButton.appendChild(pageIcon);
                    pageButton.appendChild(pageTitle);
                    
                    pageButton.dataset.pageId = page.id;
                    pageButton.addEventListener('click', () => {
                        window.open(page.url, '_blank');
                    });
                    
                    pageContainer.appendChild(checkbox);
                    pageContainer.appendChild(pageButton);
                    pagesContainer.appendChild(pageContainer);
                });

                const copyButton1 = this.createCopyToChatButton(pagesContainer, 'Find out monetization opportunities',
                    'read the following journal entries and provide concrete steps for monetization: '
                )
                pagesContainer.appendChild(copyButton1);
                
                const copyButton2 = this.createCopyToChatButton(pagesContainer, 'Find out growth opportunities',
                    'read the following journal entries and provide concrete steps for growth within the organization: '
                )
                pagesContainer.appendChild(copyButton2);
                console.log('added ', copyButton2);

                contentDiv.appendChild(pagesContainer);
                message.appendChild(contentDiv);
                this.messagesContainer.appendChild(message);
                this.scrollToBottom();
            } else {
                throw new Error(data.error || 'Failed to fetch Notion pages');
            }

            viewPagesButton.disabled = false;
            viewPagesButton.textContent = 'View Pages';
        } catch (error) {
            console.error('Error fetching Notion pages:', error);
            this.addMessage('assistant', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            const viewPagesButton = document.getElementById('viewPagesButton') as HTMLButtonElement;
            if (viewPagesButton) {
                viewPagesButton.disabled = false;
                viewPagesButton.textContent = 'View Pages';
            }
        }
    }
}