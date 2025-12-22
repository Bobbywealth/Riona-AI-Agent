import { IgClient } from './IG-bot/IgClient';
import logger from '../config/logger';
import { Instagram_cookiesExist } from '../utils';

let igClient: IgClient | null = null;
let lastCredentials: { username: string, password: string } | null = null;
let initInFlight: Promise<void> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isAbortError = (err: any) => {
  const msg = String(err?.message || err || '');
  return msg.includes('net::ERR_ABORTED') || msg.toLowerCase().includes('err_aborted');
};

export const getIgClient = async (username?: string, password?: string): Promise<IgClient> => {
    // If credentials provided and they're different, create new client
    if (username && password && (!lastCredentials || lastCredentials.username !== username || lastCredentials.password !== password)) {
        if (igClient) {
            await closeIgClient(); // Close existing client first
        }
        igClient = new IgClient(username, password);
        lastCredentials = { username: username || '', password: password || '' };
        try {
            if (initInFlight) await initInFlight;
            initInFlight = igClient.init().finally(() => { initInFlight = null; });
            await initInFlight;
        } catch (error) {
            logger.error("Failed to initialize Instagram client", error);
            throw error;
        }
    }
    
    // If no existing client, try to bootstrap from cookies (so actions still work after a restart)
    // NOTE: We can init with an empty password because IgClient.init() will use cookies when present.
    if (!igClient) {
        if (!username) {
            throw new Error('No Instagram client initialized. Please login first.');
        }
        const cookiesReady = await Instagram_cookiesExist();
        if (!cookiesReady) {
            throw new Error('No Instagram client initialized. Please login first.');
        }
        igClient = new IgClient(username, password || '');
        lastCredentials = { username, password: password || '' };
        try {
            if (initInFlight) await initInFlight;
            initInFlight = igClient.init().finally(() => { initInFlight = null; });
            await initInFlight;
        } catch (error) {
            logger.error("Failed to initialize Instagram client from cookies", error);
            igClient = null;
            throw error;
        }
    }
    
    // If existing client doesn't have browser initialized, reinitialize it
    const browser = (igClient as any).browser;
    const page = (igClient as any).page;
    if (!browser || !page) {
        logger.info('Reinitializing Instagram client (browser/page was closed)');
        try {
            if (initInFlight) {
                await initInFlight;
            } else {
                initInFlight = igClient.init().finally(() => { initInFlight = null; });
                await initInFlight;
            }
        } catch (error) {
            // A transient ERR_ABORTED is usually caused by a competing navigation; retry once.
            if (isAbortError(error)) {
                logger.warn('Reinit hit ERR_ABORTED; retrying once in 2s...');
                await sleep(2000);
                try {
                    if (initInFlight) await initInFlight;
                    initInFlight = igClient.init().finally(() => { initInFlight = null; });
                    await initInFlight;
                } catch (retryErr) {
                    logger.error("Failed to reinitialize Instagram client (retry)", retryErr);
                    throw retryErr;
                }
            } else {
                logger.error("Failed to reinitialize Instagram client", error);
                throw error;
            }
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