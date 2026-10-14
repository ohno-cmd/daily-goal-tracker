// ブラウザ用。ログイン中のユーザーの権限で動くので、RLSにより自分の行しか読み書きできない
import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
