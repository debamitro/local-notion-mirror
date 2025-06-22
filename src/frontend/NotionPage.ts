export interface NotionPage {
    id: string;
    url: string;
    properties: {
        title?: {
            title: Array<{
                text: {
                    content: string;
                }
            }>;
        };
        Name?: {
            title: Array<{
                text: {
                    content: string;
                }
            }>;
        };
    };
}
