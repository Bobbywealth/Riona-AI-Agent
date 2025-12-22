// @ts-ignore
import { CronJob } from 'cron';
import logger from './config/logger';
import ScheduledTask from './models/ScheduledTask';
import { getIgClient } from './client/Instagram';
import { IGpassword, IGusername } from './secret';

type JobInfo = {
  taskId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  nextRun: string | null;
};

let isRunning = false;
let refreshInterval: NodeJS.Timeout | null = null;
const jobsByTaskId = new Map<string, CronJob>();
let lastLoadedTasks: JobInfo[] = [];

const makeRunId = () => `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

async function executeScheduledTask(task: any) {
  if (isRunning) {
    logger.warn(`⏰ Scheduler: previous run still active; skipping task "${task?.name || task?._id}"`);
    return;
  }

  const runId = makeRunId();
  const prefix = `[sched:${task._id}] [run:${runId}]`;

  try {
    isRunning = true;
    logger.info(`${prefix} ▶️ Starting scheduled task "${task.name}" (${task.taskType})`);

    // Ensure the IG client exists even if dashboard login hasn't happened.
    const igClient = await getIgClient(IGusername, IGpassword);

    switch (task.taskType) {
      case 'campaign': {
        const cfg = task.config || {};
        await igClient.interactWithPosts(
          cfg.targetUsername,
          cfg.maxPosts ?? 10,
          {
            runId,
            mode: cfg.mode,
            hashtags: cfg.hashtags,
            locationPath: cfg.locationPath,
            englishOnly: cfg.englishOnly,
            sendDMs: cfg.sendDMs,
            maxOutboundDMs: cfg.maxOutboundDMs,
            engagement: {
              minLikes: cfg.minLikes,
              minComments: cfg.minComments,
            },
          }
        );
        break;
      }
      case 'stories': {
        const cfg = task.config || {};
        await igClient.watchStories({
          runId,
          targetUsername: cfg.storyTarget,
          storyCount: cfg.storyCount ?? 10,
          likeProbability: cfg.likeProbability,
          reactionProbability: cfg.reactionProbability,
          aiReply: cfg.aiReplies ? { enabled: true } : undefined,
        });
        break;
      }
      case 'dm_monitor': {
        const cfg = task.config || {};
        await igClient.monitorAndReplyToDMs(cfg.maxConversations ?? 5);
        break;
      }
      case 'profile_scrape': {
        const cfg = task.config || {};
        if (!cfg.scrapeTarget) {
          logger.warn(`${prefix} ⚠️ profile_scrape missing scrapeTarget; skipping.`);
          break;
        }
        const followers = await igClient.scrapeFollowers(cfg.scrapeTarget, cfg.maxFollowers ?? 50);
        logger.info(`${prefix} ✅ Scraped ${followers.length} followers for @${cfg.scrapeTarget}`);
        break;
      }
      default:
        logger.warn(`${prefix} ⚠️ Unsupported taskType "${task.taskType}"`);
    }

    task.lastRun = new Date();
    task.runCount = (task.runCount || 0) + 1;
    await task.save().catch(() => undefined);

    logger.info(`${prefix} ✅ Completed scheduled task "${task.name}"`);
  } catch (error) {
    logger.error(`${prefix} ❌ Scheduled task failed:`, error);
  } finally {
    isRunning = false;
  }
}

async function refreshJobs() {
  try {
    const enabledTasks = await ScheduledTask.find({ enabled: true }).sort({ createdAt: -1 });

    const enabledIds = new Set(enabledTasks.map((t: any) => String(t._id)));

    // Stop jobs for tasks that were disabled/deleted
    for (const [taskId, job] of jobsByTaskId.entries()) {
      if (!enabledIds.has(taskId)) {
        job.stop();
        jobsByTaskId.delete(taskId);
      }
    }

    // Start/refresh enabled tasks
    for (const task of enabledTasks as any[]) {
      const taskId = String(task._id);
      const tz = task.timezone || 'America/New_York';

      const existing = jobsByTaskId.get(taskId);
      if (existing) {
        // If cron or timezone changed, recreate the job
        const existingCron = (existing as any).cronTime?.source;
        if (existingCron !== task.cronExpression) {
          existing.stop();
          jobsByTaskId.delete(taskId);
        } else {
          continue;
        }
      }

      try {
        const job = new CronJob(
          task.cronExpression,
          () => {
            executeScheduledTask(task);
          },
          null,
          true,
          tz
        );
        jobsByTaskId.set(taskId, job);
        logger.info(`⏰ Scheduler armed: "${task.name}" @ ${task.cronExpression} (${tz})`);
      } catch (error) {
        logger.error(`⏰ Scheduler: invalid cron for task "${task.name}": ${task.cronExpression}`, error);
      }
    }

    lastLoadedTasks = enabledTasks.map((t: any) => ({
      taskId: String(t._id),
      name: t.name,
      cronExpression: t.cronExpression,
      timezone: t.timezone || 'America/New_York',
      enabled: !!t.enabled,
      nextRun: (() => {
        try {
          const job = jobsByTaskId.get(String(t._id));
          const next = job ? (job as any).nextDate?.() : null;
          return next ? String(next) : null;
        } catch {
          return null;
        }
      })(),
    }));
  } catch (error) {
    logger.warn('⏰ Scheduler: unable to refresh jobs (DB offline?)');
  }
}

export function startScheduler() {
  logger.info('Starting Instagram automation scheduler (DB-driven)...');
  refreshJobs();

  if (!refreshInterval) {
    refreshInterval = setInterval(refreshJobs, 60_000);
  }

  logger.info('Scheduler initialized (dynamic tasks from DB)');
}

export function getSchedulerStatus() {
  return {
    isRunning,
    schedules: lastLoadedTasks,
    activeJobs: jobsByTaskId.size,
  };
}

