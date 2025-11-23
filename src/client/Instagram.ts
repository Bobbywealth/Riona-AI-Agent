import { IgClient } from './IG-bot/IgClient';
import logger from '../config/logger';

let igClient: IgClient | null = null;
let lastCredentials: { username: string, password: string } | null = null;

export const getIgClient = async (username?: string, password?: string): Promise<IgClient> => {
    // If credentials provided and they're different, create new client
    if (username && password && (!lastCredentials || lastCredentials.username !== username || lastCredentials.password !== password)) {
        if (igClient) {
            await closeIgClient(); // Close existing client first
        }
        igClient = new IgClient(username, password);
        lastCredentials = { username: username || '', password: password || '' };
        try {
            await igClient.init();
        } catch (error) {
            logger.error("Failed to initialize Instagram client", error);
            throw error;
        }
    }
    
    // If no existing client, throw error (must login first)
    if (!igClient) {
        throw new Error('No Instagram client initialized. Please login first.');
    }
    
    // If existing client doesn't have browser initialized, reinitialize it
    const browser = (igClient as any).browser;
    const page = (igClient as any).page;
    if (!browser || !page) {
        logger.info('Reinitializing Instagram client (browser/page was closed)');
        try {
            await igClient.init();
        } catch (error) {
            logger.error("Failed to reinitialize Instagram client", error);
            throw error;
        }
    }
    
    return igClient;
};

export const closeIgClient = async () => {
    if (igClient) {
        await igClient.close();
        igClient = null;
    }
};

export { scrapeFollowersHandler } from './IG-bot/IgClient'; 