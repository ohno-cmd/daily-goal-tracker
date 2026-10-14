"use client";

// 恩返しリスト・アファメーションなど、1つの表を画面で読み書きするためのフック
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "./supabase/client";
import { fetchAll } from "./store";
import { useToast } from "./toast";

type Base = { id: string; sort_order?: number };

export function useRows<T extends Base>(table: string, order: string = "sort_order") {
  const sb = useMemo(() => createClient(), []);
  const toast = useToast();
  const [rows, setRows] = useState<T[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const reload = useCallback(async () => {
    try {
      const data = await fetchAll<T>((f, t) => sb.from(table).select("*").order(order).order("created_at").range(f, t));
      setRows(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [sb, table, order]);

  useEffect(() => {
    // 表示したときに読み込む(state の更新は読み込みが終わってから)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const insert = useCallback(
    async (fields: Partial<T>) => {
      // sort_order で並べる表だけ、末尾に追加する
      const sort = order === "sort_order" ? { sort_order: Math.max(0, ...rows.map((r) => r.sort_order ?? 0)) + 10 } : {};
      const { data, error } = await sb.from(table).insert({ ...sort, ...fields } as Record<string, unknown>).select().single();
      if (error) {
        toast("追加できませんでした。");
        return null;
      }
      setRows((rs) => [...rs, data as T]);
      return data as T;
    },
    [sb, table, rows, toast, order],
  );

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      const { error } = await sb.from(table).update(patch as Record<string, unknown>).eq("id", id);
      if (error) {
        toast("保存できませんでした。");
        return false;
      }
      return true;
    },
    [sb, table, toast],
  );

  /** 一意の列(month など)で追加または更新 */
  const upsert = useCallback(
    async (fields: Partial<T>, onConflict: string) => {
      const { data, error } = await sb.from(table).upsert(fields as Record<string, unknown>, { onConflict }).select().single();
      if (error) {
        toast("保存できませんでした。");
        return null;
      }
      const row = data as T;
      setRows((rs) => (rs.some((r) => r.id === row.id) ? rs.map((r) => (r.id === row.id ? row : r)) : [...rs, row]));
      return row;
    },
    [sb, table, toast],
  );

  const remove = useCallback(
    async (id: string) => {
      const prev = rows;
      setRows((rs) => rs.filter((r) => r.id !== id));
      const { error } = await sb.from(table).delete().eq("id", id);
      if (error) {
        setRows(prev);
        toast("削除できませんでした。");
      }
    },
    [sb, table, rows, toast],
  );

  /** 上下に1つ動かす(sort_order を振り直す) */
  const move = useCallback(
    async (id: string, dir: -1 | 1) => {
      const i = rows.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rows.length) return;
      const next = [...rows];
      [next[i], next[j]] = [next[j], next[i]];
      const renum = next.map((r, k) => ({ ...r, sort_order: (k + 1) * 10 }));
      setRows(renum);
      const results = await Promise.all(
        renum.filter((r, k) => r.sort_order !== rows[k]?.sort_order || r.id !== rows[k]?.id).map((r) => sb.from(table).update({ sort_order: r.sort_order }).eq("id", r.id)),
      );
      if (results.some((r) => r.error)) {
        toast("並べ替えを保存できませんでした。");
        reload();
      }
    },
    [sb, table, rows, toast, reload],
  );

  return { rows, status, reload, insert, update, upsert, remove, move, setRows };
}
