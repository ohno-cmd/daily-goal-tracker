"use client";

import { useEffect } from "react";

/** 本番だけサービスワーカーを登録する(開発中はキャッシュが邪魔になるので登録しない) */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
