export type PaletteColor = { code: string; name: string; hex: string };
export type Palette = { id: string; name: string; note: string; colors: PaletteColor[] };

const colors = (rows: Array<[string, string, string]>): PaletteColor[] =>
  rows.map(([code, name, hex]) => ({ code, name, hex }));

export const BUILTIN_PALETTES: Palette[] = [
  {
    id: "mard",
    name: "MARD",
    note: "36 色创作色板",
    colors: colors([
      ["A01", "纯白", "#F7F4E9"], ["A02", "奶油白", "#FFF0C9"], ["A03", "柠檬黄", "#FFD84D"], ["A04", "暖黄", "#F6B93B"],
      ["A05", "橘黄", "#F28C38"], ["A06", "珊瑚橙", "#F46C4E"], ["A07", "正红", "#DE3F4E"], ["A08", "酒红", "#8F2E43"],
      ["B01", "浅粉", "#FFD0D8"], ["B02", "樱花粉", "#F795AC"], ["B03", "玫瑰粉", "#E95A83"], ["B04", "莓果紫", "#A64B78"],
      ["B05", "丁香紫", "#C6A3E7"], ["B06", "葡萄紫", "#7753A6"], ["B07", "深紫", "#4A376E"], ["C01", "冰蓝", "#C7EAF1"],
      ["C02", "湖水蓝", "#65C9C6"], ["C03", "天蓝", "#65A9DF"], ["C04", "宝石蓝", "#397AC7"], ["C05", "深海蓝", "#294C7A"],
      ["C06", "藏青", "#202F4B"], ["D01", "薄荷绿", "#BFE5CF"], ["D02", "嫩芽绿", "#8BCB86"], ["D03", "青柠绿", "#A4CD49"],
      ["D04", "草绿", "#4D9B62"], ["D05", "墨绿", "#2E6551"], ["D06", "青绿", "#2C9F9B"], ["E01", "浅肤色", "#F6C9A7"],
      ["E02", "杏色", "#E9A575"], ["E03", "焦糖", "#B96F45"], ["E04", "咖啡", "#734A3C"], ["E05", "深棕", "#463333"],
      ["F01", "浅灰", "#DADADA"], ["F02", "中灰", "#97989D"], ["F03", "炭灰", "#555965"], ["F04", "黑色", "#24242D"],
    ]),
  },
  {
    id: "hama",
    name: "HAMA",
    note: "经典基础色板",
    colors: colors([
      ["01", "White", "#F7F5EC"], ["02", "Cream", "#F3E2B7"], ["03", "Yellow", "#F7D445"], ["04", "Orange", "#ED8A34"],
      ["05", "Red", "#D84943"], ["06", "Pink", "#EE91AD"], ["07", "Purple", "#805895"], ["08", "Blue", "#386EA8"],
      ["09", "Light Blue", "#75B8DB"], ["10", "Green", "#3D8760"], ["11", "Light Green", "#85BB6B"], ["12", "Brown", "#7B4B37"],
      ["17", "Grey", "#92979A"], ["18", "Black", "#25272A"], ["20", "Clear", "#E9EEF0"], ["21", "Flesh", "#F2BF9A"],
      ["22", "Dark Red", "#923944"], ["26", "Beige", "#D7B98F"], ["28", "Dark Green", "#315A4C"], ["29", "Burgundy", "#6D344B"],
      ["30", "Turquoise", "#2EAAA3"], ["31", "Gold", "#C69840"], ["38", "Neon Orange", "#FF7750"], ["43", "Pastel Yellow", "#FFE69B"],
      ["44", "Pastel Red", "#F18C86"], ["45", "Pastel Purple", "#BEA3D7"], ["46", "Pastel Blue", "#A8D6E5"], ["47", "Pastel Green", "#B7D7AC"],
      ["49", "Azure", "#2C8DB5"], ["60", "Teddy Brown", "#A86D4B"], ["70", "Light Grey", "#D4D6D5"], ["71", "Dark Grey", "#5B6268"],
    ]),
  },
  {
    id: "perler",
    name: "Perler",
    note: "高饱和创作色板",
    colors: colors([
      ["P01", "White", "#F8F7EF"], ["P02", "Cream", "#F4E4B9"], ["P03", "Yellow", "#F6D33C"], ["P04", "Cheddar", "#EFA33A"],
      ["P05", "Orange", "#ED7137"], ["P06", "Red", "#D84247"], ["P07", "Hot Coral", "#F05F66"], ["P08", "Bubblegum", "#F09AB4"],
      ["P09", "Pink", "#D95A93"], ["P10", "Plum", "#83446F"], ["P11", "Purple", "#74539C"], ["P12", "Lavender", "#B39AD2"],
      ["P13", "Light Blue", "#81C7DF"], ["P14", "Cyan", "#42A8CC"], ["P15", "Blue", "#3A74B5"], ["P16", "Navy", "#2B426C"],
      ["P17", "Toothpaste", "#64C9B8"], ["P18", "Turquoise", "#2E9D9E"], ["P19", "Light Green", "#96CB79"], ["P20", "Kiwi Lime", "#A9C94A"],
      ["P21", "Green", "#43885A"], ["P22", "Dark Green", "#315B4D"], ["P23", "Tan", "#D5B485"], ["P24", "Sand", "#C99B69"],
      ["P25", "Rust", "#A65A40"], ["P26", "Brown", "#70473B"], ["P27", "Light Grey", "#D2D4D2"], ["P28", "Grey", "#8D9297"],
      ["P29", "Dark Grey", "#525762"], ["P30", "Black", "#24242A"], ["P31", "Blush", "#F2C2AF"], ["P32", "Salmon", "#EA8E77"],
    ]),
  },
];

export function parseCustomPalette(text: string, name: string): Palette {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsed: PaletteColor[] = [];
  for (const row of rows) {
    const [code, colorName, rawHex] = row.split(/[,，;\t]/).map((value) => value.trim());
    const hex = rawHex?.startsWith("#") ? rawHex : `#${rawHex || ""}`;
    if (!code || !colorName || !/^#[0-9a-f]{6}$/i.test(hex)) continue;
    parsed.push({ code: code.slice(0, 12), name: colorName.slice(0, 24), hex: hex.toUpperCase() });
  }
  if (parsed.length < 4) throw new Error("色板至少需要 4 行：色号,名称,#HEX");
  if (parsed.length > 256) throw new Error("一个色板最多支持 256 个颜色");
  return { id: `custom-${Date.now()}`, name: name.slice(0, 16) || "自定义色板", note: `${parsed.length} 个颜色`, colors: parsed };
}
