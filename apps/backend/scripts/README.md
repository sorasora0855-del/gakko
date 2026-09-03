# Argon2id ベンチマーキ手順

自宅サーバーの実機で、SchoolLinkの本番運用に使うArgon2idパラメータを決定するための手順。

## 実行方法(自宅サーバー上、Dockerを使う場合)

```bash
cd apps/backend
docker run --rm -it \\
  -v "$(pwd)":/app -w /app \\
  node:20-bullseye bash -c "npm install && npm run benchmark:argon2"
```

## 実行方法(サーバーにNode.jsが直接入っている場合)

```bash
cd apps/backend
npm install
npm run benchmark:argon2
```

## 実行に関する補足

本スクリプトは `node --loader ts-node/esm` を使ってTypeScriptを直接実行します。
もし `ERR_UNKNOWN_FILE_EXTENSION` などのエラーが出る場合は、Node.jsのバージョンや環境によって読み込み方式が異なるため、以下を試してください。

```bash
node --experimental-specifier-resolution=node --loader ts-node/esm scripts/benchmark-argon2.ts
```

## 結果の見方

- スクリプトは memoryCost / timeCost / parallelism の組み合わせごとに5回ハッシュ化し、平均時間(ms)を出力します。
- ログイン処理として実用的な **200〜300ms** の範囲に収まる組み合わせの中から、
  最もメモリコストが高い(=セキュリティ的に強い)設定を推奨値として最後に表示します。
- 表示された推奨値を `.env` の以下3つに設定してください。

```
ARGON2_MEMORY_COST=<推奨値>
ARGON2_TIME_COST=<推奨値>
ARGON2_PARALLELISM=<推奨値>
```

## 注意

- サーバーの負荷が高い時間帯に実行すると結果がぶれるため、他の重い処理が動いていない状態で実行してください。
- 将来サーバーのCPUを変更した場合は、このベンチマーキを再実行してパラメータを見直してください。
- このスクリプト自体は本番の認証処理には使用しません(パラメータ決定専用ツール)。
