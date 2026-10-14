import { describe, expect, it } from "vitest";
import { splitWins } from "@/app/(app)/wins/WinsView";

describe("できたことの分け方", () => {
  it("1行ずつにして、先頭の記号や番号を外す", () => {
    expect(splitWins("・早起きできた\n- 水を飲んだ\n1. 友達に連絡した\n\n②ご飯がおいしかった")).toEqual(["早起きできた", "水を飲んだ", "友達に連絡した", "ご飯がおいしかった"]);
  });
});
