/**
 * Metrics Scheduler
 *
 * The metric syncs used to sit behind endpoints nothing called, so the tables
 * stayed empty and the numbers in the product were whatever was typed in. This
 * runs them on a timer, in the same style as the post scheduler: a cheap tick,
 * a durable record of what last succeeded, and no exception that can kill the
 * loop.
 *
 * Cadence is per job and driven by `sync_runs`, not by the process clock, so a
 * restart doesn't re-run everything and a crash doesn't skip a cycle.
 */

const { syncAccountInsights, syncPostInsights, syncAdSpend } = require('./metricsSync');

const TICK_MS = 15 * 60 * 1000;   // how often we ask "is anything due?"
const BOOT_DELAY_MS = 45 * 1000;  // let the app finish starting before the first pull

const hours = (envVar, fallback) => {
  const parsed = parseFloat(process.env[envVar]);
  return (Number.isFinite(parsed) && parsed > 0 ? parsed : fallback) * 3600 * 1000;
};

class MetricsScheduler {
  constructor(pool) {
    this.pool = pool;
    this.intervalId = null;
    this.bootTimer = null;
    this.running = false;

    this.jobs = [
      {
        name: 'meta_accounts',
        every: hours('METRICS_ACCOUNTS_INTERVAL_HOURS', 6),
        run: () => syncAccountInsights(this.pool),
        describe: (r) => `${r.synced}/${r.total} cuentas`,
      },
      {
        name: 'meta_posts',
        every: hours('METRICS_POSTS_INTERVAL_HOURS', 6),
        run: () => syncPostInsights(this.pool, {
          windowDays: parseInt(process.env.METRICS_POST_WINDOW_DAYS, 10) || 30,
          mediaPerAccount: parseInt(process.env.METRICS_MEDIA_PER_ACCOUNT, 10) || 12,
        }),
        describe: (r) => `${r.synced}/${r.total} programadas · ${r.organic} orgánicas`,
      },
      {
        name: 'meta_ads',
        every: hours('METRICS_ADS_INTERVAL_HOURS', 6),
        run: () => syncAdSpend(this.pool, {
          lookbackDays: parseInt(process.env.METRICS_ADS_LOOKBACK_DAYS, 10) || 14,
        }),
        describe: (r) => `${r.synced}/${r.total} cuentas publicitarias (${r.days})`,
      },
    ];
  }

  start() {
    if (this.intervalId) return;
    const summary = this.jobs.map((j) => `${j.name} cada ${Math.round(j.every / 3600000)}h`).join(', ');
    console.log(`📊 Metrics scheduler started — ${summary}`);
    this.bootTimer = setTimeout(() => this.tick(), BOOT_DELAY_MS);
    this.intervalId = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    if (this.bootTimer) clearTimeout(this.bootTimer);
    if (this.intervalId) clearInterval(this.intervalId);
    this.bootTimer = null;
    this.intervalId = null;
    console.log('📊 Metrics scheduler stopped');
  }

  /** Run whatever is due. Overlapping ticks are skipped, never queued. */
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (const job of this.jobs) {
        if (await this.isDue(job)) await this.runJob(job);
      }
    } catch (err) {
      console.error('Metrics tick failed:', err.message);
    } finally {
      this.running = false;
    }
  }

  async isDue(job) {
    try {
      const r = await this.pool.query('SELECT last_success_at FROM sync_runs WHERE job = $1', [job.name]);
      const last = r.rows[0]?.last_success_at;
      return !last || Date.now() - new Date(last).getTime() >= job.every;
    } catch (err) {
      // Can't tell whether it's due — skip this tick rather than risk running
      // every 15 minutes forever. sync_runs is created during schema init, so
      // this only happens if the migration hasn't landed yet.
      console.error(`Could not read sync state for ${job.name}:`, err.message);
      return false;
    }
  }

  /** Run one job and record the outcome, successful or not. */
  async runJob(job) {
    const started = Date.now();
    try {
      const result = await job.run();
      const detail = job.describe(result);
      const failed = (result.errors || []).length;
      console.log(`📊 ${job.name}: ${detail}${failed ? ` · ${failed} con error` : ''} (${Date.now() - started}ms)`);
      if (failed) console.warn(`   ${job.name} errores:`, JSON.stringify(result.errors.slice(0, 5)));
      await this.record(job.name, 'ok', detail + (failed ? ` · ${failed} con error` : ''));
      return result;
    } catch (err) {
      console.error(`📊 ${job.name} failed:`, err.message);
      await this.record(job.name, 'error', err.message, false);
      return null;
    }
  }

  async record(job, status, detail, success = true) {
    try {
      await this.pool.query(`
        INSERT INTO sync_runs (job, last_run_at, last_success_at, last_status, last_detail)
        VALUES ($1, NOW(), ${success ? 'NOW()' : 'NULL'}, $2, $3)
        ON CONFLICT (job) DO UPDATE SET
          last_run_at = NOW(),
          last_success_at = ${success ? 'NOW()' : 'sync_runs.last_success_at'},
          last_status = $2,
          last_detail = $3
      `, [job, status, (detail || '').slice(0, 500)]);
    } catch (err) {
      console.error(`Could not record sync run for ${job}:`, err.message);
    }
  }
}

module.exports = MetricsScheduler;
