// @ts-ignore
import { CronJob } from 'cron';
import logger from './config/logger';
import { getIgClient } from './client/Instagram';

let isRunning = false;

export function startScheduler() {
    logger.info('Starting Instagram automation scheduler...');

    // Schedule 1: Morning session - 9 AM every day
    new CronJob('0 9 * * *', async () => {
        if (isRunning) {
            logger.warn('Previous session still running, skipping...');
            return;
        }
        try {
            isRunning = true;
            logger.info('Starting morning Instagram session (9 AM)...');
            const igClient = await getIgClient();
            await igClient.interactWithPosts();
            logger.info('Morning session completed.');
        } catch (error) {
            logger.error('Error in morning session:', error);
        } finally {
            isRunning = false;
        }
    }, null, true, 'America/New_York');

    // Schedule 2: Afternoon session - 2 PM every day
    new CronJob('0 14 * * *', async () => {
        if (isRunning) {
            logger.warn('Previous session still running, skipping...');
            return;
        }
        try {
            isRunning = true;
            logger.info('Starting afternoon Instagram session (2 PM)...');
            const igClient = await getIgClient();
            await igClient.interactWithPosts();
            logger.info('Afternoon session completed.');
        } catch (error) {
            logger.error('Error in afternoon session:', error);
        } finally {
            isRunning = false;
        }
    }, null, true, 'America/New_York');

    // Schedule 3: Evening session - 7 PM every day
    new CronJob('0 19 * * *', async () => {
        if (isRunning) {
            logger.warn('Previous session still running, skipping...');
            return;
        }
        try {
            isRunning = true;
            logger.info('Starting evening Instagram session (7 PM)...');
            const igClient = await getIgClient();
            await igClient.interactWithPosts();
            logger.info('Evening session completed.');
        } catch (error) {
            logger.error('Error in evening session:', error);
        } finally {
            isRunning = false;
        }
    }, null, true, 'America/New_York');

    logger.info('Scheduler initialized: 9 AM, 2 PM, and 7 PM daily');
}

export function getSchedulerStatus() {
    return {
        isRunning,
        schedules: [
            { time: '9:00 AM', timezone: 'America/New_York', description: 'Morning session' },
            { time: '2:00 PM', timezone: 'America/New_York', description: 'Afternoon session' },
            { time: '7:00 PM', timezone: 'America/New_York', description: 'Evening session' }
        ]
    };
}

