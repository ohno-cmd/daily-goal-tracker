import { Phase1Home } from "./Phase1Home";

// フェーズ1の仮のトップ。フェーズ2で「今日」画面に置き換える
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-4 text-xl font-bold">日別目標トラッカー</h1>
      <Phase1Home />
    </main>
  );
}
