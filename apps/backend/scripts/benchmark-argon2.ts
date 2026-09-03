/**
 * Argon2id ベンチマーキコキリフコリプト
 *
 * 目的:
 *   自宅サーバーの実CPU性能で、Argon2idの各パラメータ(memoryCost/timeCost/parallelism)
 *   ごとのハッシュ生成時間を実測し、ログイン処理が200〜300ms程度に収まる設定値を決定する。
 *
 * 使い方:
 *   npm install
 *   npm run benchmark:argon2
 *
 * 注意:
 *   このスクリプトは本番の認証ロジッカには使用しない。パラメータ決定専用。
 *   決定した値は .env の ARGON2_MEMORY_COST / ARGON2_TIME_COST / ARGON2_PARALLELISM に設定する。
 */

import argon2 from "argon2";
import os from "os";

interface BenchResult {
  memoryCostKiB: number;
  timeCost: number;
  parallelism: number;
  avgMs: number;
}

const SAMPLE_PASSWORD = "benchmark-sample-password-please-ignore";
const RUNS_PER_COMBO = 5;

// OWASP最低ライン(2026年時点の目安): memoryCost >= 19456 KiB, timeCost >= 2, parallelism >= 1
const MEMORY_COSTS_KIB = [19456, 32768, 65536, 131072, 262144]; // 19MB, 32MB, 64MB, 128MB, 256MB
const TIME_COSTS = [2, 3, 4];
const PARALLELISM_OPTIONS = Array.from(
  new Set([1, 2, Math.max(1, os.cpus().length)])
).sort((a, b) => a - b);

const TARGET_MS_MIN = 200;
const TARGET_MS_MAX = 300;

async function benchmarkOne(
  memoryCostKiB: number,
  timeCost: number,
  parallelism: number
): Promise<number> {
  const durations: number[] = [];
  for (let i = 0; i < RUNS_PER_COMBO; i++) {
    const start = performance.now();
    await argon2.hash(SAMPLE_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: memoryCostKiB,
      timeCost,
      parallelism,
    });
    durations.push(performance.now() - start);
  }
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

async function main() {
  console.log(`CPU: ${os.cpus()[0]?.model ?? "unknown"} x ${os.cpus().length} cores`);
  console.log(`Total memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`);
  console.log(`各パラメータで ${RUNS_PER_COMBO} 回ハッシュ化し、平均時間を計測します。\n`);

  const results: BenchResult[] = [];

  for (const memoryCostKiB of MEMORY_COSTS_KIB) {
    for (const timeCost of TIME_COSTS) {
      for (const parallelism of PARALLELISM_OPTIONS) {
        const avgMs = await benchmarkOne(memoryCostKiB, timeCost, parallelism);
        results.push({ memoryCostKiB, timeCost, parallelism, avgMs });
        console.log(
          `memoryCost=${memoryCostKiB}KiB(${(memoryCostKiB / 1024).toFixed(
            0
          )}MB) timeCost=${timeCost} parallelism=${parallelism} => ${avgMs.toFixed(
            1
          )}ms`
        );
      }
    }
  }

  const inRange = results.filter(
    (r) => r.avgMs >= TARGET_MS_MIN && r.avgMs <= TARGET_MS_MAX
  );

  console.log("\n===== 結果まとめ =====");
  if (inRange.length > 0) {
    // 同じ目標時間带の中では、メモリコストが高いほど耐性が強いため、その中で最大メモリの設定を推奨する
    const best = inRange.sort((a, b) => b.memoryCostKiB - a.memoryCostKiB)[0];
    console.log(
      `目標範囲(${TARGET_MS_MIN}-${TARGET_MS_MAX}ms)に収まる設定が見つかりました。推奨値:`
    );
    console.log(`  ARGON2_MEMORY_COST=${best.memoryCostKiB}`);
    console.log(`  ARGON2_TIME_COST=${best.timeCost}`);
    console.log(`  ARGON2_PARALLELISM=${best.parallelism}`);
    console.log(`  (実測平均: ${best.avgMs.toFixed(1)}ms)`);
  } else {
    console.log(
      "目標範囲(200-300ms)に収まる組み合わせが見つかりませんでした。"
    );
    console.log(
      "全体的に速すぎる場合はメモリコスト/timeCostを上げ、遅すぎる場合は下げて、範囲を調整してください。"
    );
    console.log("\n実測結果一覧(近い順):");
    results
      .sort(
        (a, b) =>
          Math.abs(a.avgMs - 250) - Math.abs(b.avgMs - 250)
      )
      .slice(0, 5)
      .forEach((r) =>
        console.log(
          `  memoryCost=${r.memoryCostKiB} timeCost=${r.timeCost} parallelism=${r.parallelism} => ${r.avgMs.toFixed(1)}ms`
        )
      );
  }
}

main().catch((err) => {
  console.error("ベンチマーキ実行中にエラーが発生しました:", err);
  process.exit(1);
});
