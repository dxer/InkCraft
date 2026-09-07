/**
 * 服务启动钩子：进程内定时选题挖掘（修复「无人打开选题页就不定时挖掘」）。
 * - 每小时检查一次增量挖掘；checkAndMineHourlyTopics 自带周期 gate + DB 并发锁，
 *   与页面懒检查 / 立即挖掘并发调用时也只会跑一轮 LLM、烧一份 Token。
 * - 仅 Node 运行时注册；构建阶段与 Edge 运行时直接跳过。
 */
export async function register() {
 if (process.env.NEXT_RUNTIME !== "nodejs") return;
 if (process.env.NEXT_PHASE === "phase-production-build") return;

 // SAFETY: 单进程幂等注册标志——我们在本进程 globalThis 上只写这一次，断言只读回自己写的字段
 const g = globalThis as {
  __inkcraftMiningTicker?: ReturnType<typeof setInterval> | null;
 };
 if (g.__inkcraftMiningTicker) return;

 const { checkAndMineHourlyTopics } = await import("./lib/topics");
 const HOUR_MS = 60 * 60 * 1000;

 const tick = () => {
  checkAndMineHourlyTopics({ force: false }).catch((err) =>
   console.error("[instrumentation] hourly topic mining failed:", err),
  );
 };

 // 启动 30s 后先跑一次（周期 gate 会自动跳过未满 1 小时的场景），随后每小时一次
 setTimeout(tick, 30_000);
 g.__inkcraftMiningTicker = setInterval(tick, HOUR_MS);
}
