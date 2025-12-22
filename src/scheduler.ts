// @ts-ignore
import { CronJob } from 'cron';
import logger from './config/logger';
import ScheduledTask from './models/ScheduledTask';
import { getIgClient } from './client/Instagram';
import { IGpassword, IGusername } from './secret';

type JobInfo = {
  taskId: string;
  name: string;
  scheduleType: 'cron' | 'once';
  cronExpression?: string;
  runAt?: string | null;
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

    // One-time schedules should disable after running once.
    if ((task.scheduleType || 'cron') === 'once') {
      try {
        await ScheduledTask.findByIdAndUpdate(task._id, {
          enabled: false,
          nextRun: null,
        });
        logger.info(`${prefix} ⏹️ One-time task disabled after execution`);
      } catch {
        // ignore
      }
    }
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
      const scheduleType: 'cron' | 'once' = (task.scheduleType || 'cron') as any;

      const existing = jobsByTaskId.get(taskId);
      if (existing) {
        // If cron or timezone changed, recreate the job
        const existingCron = (existing as any).cronTime?.source;
        const existingIsDate = !(existing as any).cronTime?.source;
        const shouldRecreate =
          (scheduleType === 'cron' && (existingIsDate || existingCron !== task.cronExpression)) ||
          (scheduleType === 'once' && !existingIsDate);
        if (shouldRecreate) {
          existing.stop();
          jobsByTaskId.delete(taskId);
        } else {
          continue;
        }
      }

      try {
        let job: CronJob;
        if (scheduleType === 'once') {
          const runAt = task.runAt ? new Date(task.runAt) : null;
          if (!runAt || Number.isNaN(runAt.getTime())) {
            logger.error(`⏰ Scheduler: one-time task "${task.name}" missing/invalid runAt`);
            continue;
          }
          if (runAt.getTime() < Date.now() - 5_000) {
            logger.warn(`⏰ Scheduler: one-time task "${task.name}" runAt is in the past; disabling`);
            await ScheduledTask.findByIdAndUpdate(task._id, { enabled: false, nextRun: null });
            continue;
          }
          job = new CronJob(
            runAt,
            () => {
              executeScheduledTask(task);
            },
            null,
            true
          );
          jobsByTaskId.set(taskId, job);
          task.nextRun = runAt;
          await task.save().catch(() => undefined);
          logger.info(`⏰ Scheduler armed (once): "${task.name}" @ ${runAt.toISOString()}`);
        } else {
          job = new CronJob(
            task.cronExpression,
            () => {
              executeScheduledTask(task);
            },
            null,
            true,
            tz
          );
          jobsByTaskId.set(taskId, job);
          // best-effort nextRun persistence for UI
          try {
            const next = (job as any).nextDate?.();
            task.nextRun = next ? new Date(String(next)) : undefined;
            await task.save().catch(() => undefined);
          } catch {
            // ignore
          }
          logger.info(`⏰ Scheduler armed: "${task.name}" @ ${task.cronExpression} (${tz})`);
        }
      } catch (error) {
        logger.error(`⏰ Scheduler: failed to arm task "${task.name}"`, error);
      }
    }

    lastLoadedTasks = enabledTasks.map((t: any) => ({
      taskId: String(t._id),
      name: t.name,
      scheduleType: (t.scheduleType || 'cron'),
      cronExpression: t.cronExpression,
      runAt: t.runAt ? new Date(t.runAt).toISOString() : null,
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

