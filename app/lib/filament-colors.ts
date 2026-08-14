export type FilamentMaterial = "PLA" | "PETG" | "ASA";

export type ColorFamily = {
  slug: string;
  label: string;
  count: number;
};

export type FilamentColor = {
  slug: string;
  name: string;
  family: string;
  hex: string;
  materials: readonly FilamentMaterial[];
  specialty: boolean;
  finish?: string;
  swatch?: string;
};

type SolidEntry = readonly [name: string, hex: string];
type GradientEntry = readonly [
  name: string,
  finish: string,
  colors: readonly [string, string, ...string[]],
];

const PLA = ["PLA"] as const;
const PLA_PETG = ["PLA", "PETG"] as const;
const ALL_MATERIALS = ["PLA", "PETG", "ASA"] as const;

const CORE_PETG = new Set([
  "White",
  "Cold White",
  "Natural",
  "Light Gray",
  "Silver Gray",
  "Gray",
  "Space Gray",
  "Dark Gray",
  "Black",
  "Jet Black",
  "Red",
  "Fire Engine Red",
  "Orange",
  "Prusa Orange",
  "Yellow",
  "Green",
  "Bambu Green",
  "Grass Green",
  "Mint Green",
  "Emerald Green",
  "Blue",
  "Navy Blue",
  "Cobalt Blue",
  "Royal Blue",
  "Marine Blue",
  "Sky Blue",
  "Light Blue",
  "Teal",
  "Purple",
  "Violet",
  "Brown",
]);

const CORE_ASA = new Set([
  "White",
  "Natural",
  "Light Gray",
  "Gray",
  "Dark Gray",
  "Black",
  "Jet Black",
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Dark Green",
  "Blue",
  "Navy Blue",
]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function coreMaterials(name: string): readonly FilamentMaterial[] {
  if (CORE_ASA.has(name)) return ALL_MATERIALS;
  if (CORE_PETG.has(name)) return PLA_PETG;
  return PLA;
}

function solidColors(
  family: string,
  entries: readonly SolidEntry[],
  options: {
    specialty?: boolean;
    materials?: (name: string) => readonly FilamentMaterial[];
  } = {},
): FilamentColor[] {
  return entries.map(([name, hex]) => ({
    slug: slugify(name),
    name,
    family,
    hex,
    materials: options.materials?.(name) ?? PLA,
    specialty: options.specialty ?? false,
  }));
}

const neutrals = [
  ["White", "#EDEDE8"],
  ["Cold White", "#D9DFE5"],
  ["Jade White", "#F7F7F2"],
  ["Bone White", "#CBC6B8"],
  ["Natural", "#DFDFD3"],
  ["Beige", "#F0E0D6"],
  ["Cream", "#F9DFB9"],
  ["Light Gray", "#C7D4D6"],
  ["Silver Gray", "#A6A9AA"],
  ["Gray", "#8C8F8E"],
  ["Space Gray", "#63646B"],
  ["Dark Gray", "#48494A"],
  ["Anthracite Gray", "#3F4647"],
  ["Blue Gray", "#5B6579"],
  ["Black", "#2B292E"],
  ["Jet Black", "#17161A"],
] as const;

const redsPinks = [
  ["Red", "#C12E1F"],
  ["Fire Engine Red", "#E31A1F"],
  ["Scarlet Red", "#DE4343"],
  ["Cherry Red", "#EA4A5D"],
  ["Lipstick Red", "#D03036"],
  ["Dark Red", "#BB3D43"],
  ["Maroon Red", "#9D2235"],
  ["Wine / Burgundy", "#800020"],
  ["Blood Red", "#990303"],
  ["Brick Red", "#D22D2F"],
  ["Watermelon", "#EE474B"],
  ["Magenta", "#EC008C"],
  ["Hot Pink", "#F5547C"],
  ["Pink", "#F1A1AF"],
  ["Sakura Pink", "#EAB8CA"],
  ["Baby Pink", "#FFE0E1"],
  ["Coral Pink", "#FF8674"],
  ["Rose / Mauve", "#A36D82"],
  ["Lotus Pink", "#DD76C0"],
  ["Plum", "#950051"],
] as const;

const orangesYellows = [
  ["Orange", "#F67405"],
  ["Prusa Orange", "#FE6E31"],
  ["Pumpkin Orange", "#FF9016"],
  ["Mandarin Orange", "#FC9257"],
  ["Coral", "#F09A7E"],
  ["Peach", "#F6BF8B"],
  ["Terracotta", "#B15533"],
  ["Neon Orange", "#FEBD1B"],
  ["Yellow", "#FEC600"],
  ["Lemon Yellow", "#F7D959"],
  ["Sunflower Yellow", "#F5C21B"],
  ["Bright Yellow", "#F4EE2A"],
  ["Butter Yellow", "#FCFAA6"],
  ["Mustard", "#C99A23"],
  ["Neon Yellow", "#EBFF57"],
] as const;

const greens = [
  ["Green", "#2F9E4F"],
  ["Bambu Green", "#00AE42"],
  ["Grass Green", "#61C680"],
  ["Apple Green", "#C2E189"],
  ["Lime Green", "#D5D701"],
  ["Neon Green", "#8FD130"],
  ["Mint Green", "#9AD0C0"],
  ["Seafoam Green", "#7DD4BE"],
  ["Turquoise Green", "#12B39A"],
  ["Emerald Green", "#22624F"],
  ["Forest Green", "#39541A"],
  ["Dark Green", "#223622"],
  ["Army / Olive", "#5E6344"],
  ["Moss Green", "#92864F"],
  ["Sage Green", "#777E71"],
  ["Pistachio Green", "#93A683"],
  ["Opal Green", "#075B49"],
] as const;

const blues = [
  ["Blue", "#2A5CA5"],
  ["Navy Blue", "#042F56"],
  ["Cobalt Blue", "#0056B8"],
  ["Royal Blue", "#04518E"],
  ["Klein Blue", "#1729AB"],
  ["Marine Blue", "#0078BF"],
  ["Azure Blue", "#0066D9"],
  ["Sky Blue", "#56B7E6"],
  ["Light Blue", "#3ABBDE"],
  ["Ice Blue", "#A3D8E1"],
  ["Baby Blue", "#A8C6EE"],
  ["Cyan", "#0086D6"],
  ["Teal", "#4CC0C7"],
  ["Arctic Teal", "#5D989E"],
  ["Ocean Blue", "#1A4C54"],
  ["Slate Blue", "#487BA2"],
  ["Sapphire Blue", "#3B4467"],
  ["Chalky Blue", "#6F9AAA"],
  ["Periwinkle", "#92C4E8"],
] as const;

const purples = [
  ["Purple", "#6C47B2"],
  ["Violet", "#8350A4"],
  ["Lavender Purple", "#9572BF"],
  ["Lilac", "#C8B6D8"],
  ["Light Periwinkle", "#ADB4E6"],
  ["Electric Indigo", "#6858A9"],
  ["Indigo Purple", "#482960"],
  ["Eggplant", "#46394E"],
  ["Muted Purple", "#7C5C78"],
  ["Very Peri", "#6667AB"],
] as const;

const brownsEarth = [
  ["Brown", "#7A5C4B"],
  ["Chocolate Brown", "#55331A"],
  ["Dark Chocolate", "#4D3324"],
  ["Coffee Brown", "#362111"],
  ["Cocoa Brown", "#6F5034"],
  ["Peanut Brown", "#875718"],
  ["Caramel", "#AE835B"],
  ["Latte Brown", "#D3B7A7"],
  ["Desert Tan", "#E8DBB7"],
  ["Khaki / Oak", "#C2B29A"],
  ["Almond", "#F0DDC2"],
  ["Noctua Beige", "#E7CEB4"],
  ["Noctua Brown", "#653525"],
  ["Rust", "#C06443"],
] as const;

const metallicsSilk = [
  ["Silk Pearl", "#E8E9E3"],
  ["Silk Black", "#363538"],
  ["Silk Silver", "#A3A8AA"],
  ["Silk Gold", "#CBA358"],
  ["Silk Copper", "#B57559"],
  ["Silk Bronze", "#908F6D"],
  ["Silk Brass", "#968162"],
  ["Silk Rose Gold", "#C99592"],
  ["Silk Gunmetal", "#676B6A"],
  ["Silk Champagne", "#F3CFB2"],
  ["Silk Red", "#CB555F"],
  ["Silk Blue", "#4C93C5"],
  ["Silk Green", "#82C26E"],
  ["Silk Purple", "#845AA7"],
  ["Silk Pink", "#E99CB7"],
  ["Silk Orange", "#EB6232"],
  ["Silk Mint", "#96DCB9"],
  ["Metallic Gold", "#CD7C13"],
  ["Metallic Silver", "#8A8D95"],
  ["Metallic Bronze", "#AE6840"],
  ["Metallic Blue", "#2D3449"],
  ["Metal-fill Iron", "#565451"],
  ["Brass Composite", "#8C7A4F"],
  ["Copper Composite", "#976D5D"],
] as const;

const matte = [
  ["Matte Ivory", "#E9E8DE"],
  ["Matte Bone White", "#D4D1C3"],
  ["Matte Charcoal", "#3F3F3F"],
  ["Matte Ash Gray", "#8D9499"],
  ["Matte Nardo Gray", "#757575"],
  ["Matte Beige", "#E4D0B0"],
  ["Matte Red", "#8F0F1B"],
  ["Matte Scarlet", "#D34651"],
  ["Matte Sakura Pink", "#EAADBD"],
  ["Matte Orange", "#F88B17"],
  ["Matte Lemon", "#F6CC50"],
  ["Matte Grass Green", "#76B56F"],
  ["Matte Dark Green", "#656A4D"],
  ["Matte Mint", "#D2DEBB"],
  ["Matte Ice Blue", "#9FD7E1"],
  ["Matte Marine Blue", "#287FAC"],
  ["Matte Navy", "#2E4462"],
  ["Matte Lilac", "#9389C2"],
  ["Matte Latte", "#BF9E82"],
  ["Matte Terracotta", "#AF654E"],
  ["Matte Chocolate", "#7C594A"],
] as const;

const translucentClear = [
  ["Clear / Natural", "#E4E7E3"],
  ["Translucent Gray", "#8E8E8E"],
  ["Translucent Red", "#B83C2A"],
  ["Translucent Orange", "#EF8E5B"],
  ["Translucent Yellow", "#F9ED3D"],
  ["Translucent Green", "#3FBF5C"],
  ["Translucent Jade", "#96D8AF"],
  ["Translucent Teal", "#77EDD7"],
  ["Translucent Blue", "#0047BB"],
  ["Translucent Light Blue", "#61B0FF"],
  ["Translucent Purple", "#8344B0"],
  ["Translucent Pink", "#F9C1BD"],
  ["Translucent Amber", "#C08559"],
] as const;

const glowSparkle = [
  ["Glow Green", "#A1FFAC"],
  ["Glow Blue", "#7AC0E9"],
  ["Glow Yellow", "#F8FF80"],
  ["Glow Orange", "#FF9D5B"],
  ["Glow Pink", "#FF9CA1"],
  ["Galaxy Black", "#3D3E3C"],
  ["Galaxy Purple", "#453A71"],
  ["Galaxy Blue", "#012C61"],
  ["Galaxy Green", "#3B665E"],
  ["Galaxy Red", "#8E2231"],
  ["Galaxy Nebulae", "#424379"],
  ["Sparkle Onyx Black", "#2D2B28"],
  ["Sparkle Slate Gray", "#8E9089"],
  ["Sparkle Gold", "#CEA629"],
  ["Sparkle Crimson", "#792B36"],
  ["Sparkle Royal Purple", "#483D8B"],
  ["Sparkle Alpine Green", "#3F5443"],
  ["Starlight Twilight", "#5F6A88"],
  ["Starlight Jupiter", "#926C4E"],
  ["Celestial Blue", "#5BC0C9"],
  ["Celestial Pink", "#DDB6C8"],
] as const;

const composites = [
  ["Wood (natural)", "#9D836A"],
  ["Birch Wood", "#D3BDAA"],
  ["Maple Wood", "#E5BD8E"],
  ["Walnut Wood", "#58473F"],
  ["Rosewood", "#6B504D"],
  ["Ebony Wood", "#53504D"],
  ["Marble White", "#D6D4D9"],
  ["Marble Limestone", "#BEBFB1"],
  ["Marble Brick Red", "#C36851"],
  ["Marble Slate Gray", "#93B8C1"],
  ["Basalt Gray", "#5B5F61"],
  ["Stone Terracotta", "#BD634C"],
  ["Carbon Fiber Black", "#414141"],
  ["CF Lava Gray", "#8B9398"],
  ["CF Blue", "#3D4C59"],
  ["CF Burgundy", "#814348"],
] as const;

const gradients = [
  ["Gilded Rose", "pink → gold", ["#D77C9A", "#CBA358"]],
  ["Midnight Blaze", "blue → red", ["#173A75", "#C12E1F"]],
  ["Neon City", "blue → magenta", ["#1976D2", "#EC008C"]],
  ["Blue Hawaii", "blue → green", ["#2A5CA5", "#2F9E4F"]],
  ["Velvet Eclipse", "black → red", ["#17161A", "#C12E1F"]],
  ["Mystic Magenta", "magenta → green", ["#EC008C", "#2F9E4F"]],
  ["Phantom Blue", "blue → black", ["#2A5CA5", "#17161A"]],
  ["Aurora Purple", "gradient", ["#5B4BBA", "#B56FD3", "#3C8BE8"]],
  ["South Beach", "gradient", ["#20BFC4", "#F4A3B8", "#F5C21B"]],
  ["Dawn Radiance", "4-stop gradient", ["#6A4C93", "#E76F91", "#F4A261", "#F6D365"]],
  ["Crown", "silk gold → silver", ["#CBA358", "#A3A8AA"]],
  ["Sunset", "silk gold → red", ["#CBA358", "#CB555F"]],
  ["Banquet", "silk gold → magenta", ["#CBA358", "#EC008C"]],
  ["Caribbean Sea", "silk blue → green", ["#4C93C5", "#82C26E"]],
  ["Silk Black-Gold", "dual", ["#363538", "#CBA358"]],
  ["Silk Black-Red", "dual", ["#363538", "#CB555F"]],
  ["Shadow Black", "matte white → black", ["#E9E8DE", "#17161A"]],
  ["Flamingo", "matte pink → red", ["#EAADBD", "#8F0F1B"]],
  ["Glacier Blue", "matte ice → blue", ["#9FD7E1", "#287FAC"]],
  ["Camouflage", "matte green → brown", ["#656A4D", "#7C594A"]],
  ["Rainbow (matte)", "gradient", ["#D34651", "#F6CC50", "#76B56F", "#287FAC", "#9389C2"]],
  ["Rainbow (silk)", "gradient", ["#CB555F", "#CBA358", "#82C26E", "#4C93C5", "#845AA7"]],
  ["Fire", "silk gradient", ["#792B36", "#EB6232", "#CBA358"]],
  ["Water", "silk gradient", ["#4C93C5", "#96DCB9", "#845AA7"]],
  ["Cappuccino", "matte gradient", ["#E4D0B0", "#BF9E82", "#7C594A"]],
  ["Sky", "matte gradient", ["#D2DEBB", "#9FD7E1", "#287FAC"]],
  ["Lavender Fizz", "matte gradient", ["#EAADBD", "#9389C2", "#9FD7E1"]],
  ["Mint Splash", "matte gradient", ["#D2DEBB", "#76B56F", "#9FD7E1"]],
  ["Crystal Aquamarine", "translucent gradient", ["#77EDD7", "#61B0FF"]],
  ["Crystal Rose Quartz", "translucent gradient", ["#F9C1BD", "#8344B0"]],
  ["Luminous Rainbow", "glow gradient", ["#A1FFAC", "#F8FF80", "#FF9CA1", "#7AC0E9"]],
  ["Galaxy Black-Blue", "sparkle gradient", ["#2D2B28", "#012C61"]],
] as const satisfies readonly GradientEntry[];

const carbonFiberMaterials = (name: string): readonly FilamentMaterial[] =>
  name.startsWith("CF ") || name === "Carbon Fiber Black" ? ALL_MATERIALS : PLA;

export const FILAMENT_COLORS: readonly FilamentColor[] = [
  ...solidColors("neutrals", neutrals, { materials: coreMaterials }),
  ...solidColors("reds-pinks", redsPinks, { materials: coreMaterials }),
  ...solidColors("oranges-yellows", orangesYellows, { materials: coreMaterials }),
  ...solidColors("greens", greens, { materials: coreMaterials }),
  ...solidColors("blues", blues, { materials: coreMaterials }),
  ...solidColors("purples", purples, { materials: coreMaterials }),
  ...solidColors("browns-earth", brownsEarth, { materials: coreMaterials }),
  ...solidColors("metallics-silk", metallicsSilk, { specialty: true }),
  ...solidColors("matte", matte, { specialty: true }),
  ...solidColors("translucent-clear", translucentClear, {
    specialty: true,
    materials: () => PLA_PETG,
  }),
  ...solidColors("glow-sparkle", glowSparkle, { specialty: true }),
  ...solidColors("composites", composites, {
    specialty: true,
    materials: carbonFiberMaterials,
  }),
  ...gradients.map(([name, finish, colors]) => ({
    slug: slugify(name),
    name,
    family: "multicolor-gradient",
    hex: colors[0],
    materials: PLA,
    specialty: true,
    finish,
    swatch: `linear-gradient(135deg, ${colors.join(", ")})`,
  })),
];

export const COLOR_FAMILIES: readonly ColorFamily[] = [
  { slug: "neutrals", label: "Neutrals", count: 16 },
  { slug: "reds-pinks", label: "Reds & Pinks", count: 20 },
  { slug: "oranges-yellows", label: "Oranges & Yellows", count: 15 },
  { slug: "greens", label: "Greens", count: 17 },
  { slug: "blues", label: "Blues", count: 19 },
  { slug: "purples", label: "Purples", count: 10 },
  { slug: "browns-earth", label: "Browns & Earth", count: 14 },
  { slug: "metallics-silk", label: "Metallics & Silk", count: 24 },
  { slug: "matte", label: "Matte", count: 21 },
  { slug: "translucent-clear", label: "Translucent & Clear", count: 13 },
  { slug: "glow-sparkle", label: "Glow & Sparkle", count: 21 },
  { slug: "composites", label: "Composites", count: 16 },
  { slug: "multicolor-gradient", label: "Multicolor & gradients", count: 32 },
];

if (FILAMENT_COLORS.length !== 238) {
  throw new Error(`Filament catalog must contain 238 colors; found ${FILAMENT_COLORS.length}.`);
}
