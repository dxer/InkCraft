/**
 * 服务启动钩子：进程内定时选题挖掘（修复「无人打开选题页就不定时挖掘」）。
 * - 每小时检查一次增量挖掘；checkAndMineHourlyTopics 自带周期 gate + DB 并发锁，
 *   与页面懒检查 / 立即挖掘并发调用时也只会跑一轮 LLM、烧一份 Token。
 * - 仅 Node 运行时注册；构建阶段与 Edge 运行时直接跳过。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // 补齐 Node.js 服务端缺少浏览器 DOMMatrix / ImageData / Path2D 全局对象的兼容层（避免 pdfjs-dist / canvas 评估报错）
  if (typeof globalThis.DOMMatrix === "undefined") {
    class DOMMatrixPolyfill {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true;
      isIdentity = true;
      constructor(init?: unknown) {
        if (Array.isArray(init) && init.length >= 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
          this.m11 = this.a; this.m12 = this.b;
          this.m21 = this.c; this.m22 = this.d;
          this.m41 = this.e; this.m42 = this.f;
        }
      }
    }
    // @ts-expect-error polyfill for Node.js runtime
    globalThis.DOMMatrix = DOMMatrixPolyfill;
  }

  if (typeof globalThis.ImageData === "undefined") {
    class ImageDataPolyfill {
      width: number;
      height: number;
      data: Uint8ClampedArray;
      constructor(w = 0, h = 0) {
        this.width = w;
        this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    }
    // @ts-expect-error polyfill for Node.js runtime
    globalThis.ImageData = ImageDataPolyfill;
  }

  if (typeof globalThis.Path2D === "undefined") {
    class Path2DPolyfill {}
    // @ts-expect-error polyfill for Node.js runtime
    globalThis.Path2D = Path2DPolyfill;
  }

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
