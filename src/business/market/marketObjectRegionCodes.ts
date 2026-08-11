const regionCodeById = {
  "qiqihar-all": "230200",
  "qiqihar-longsha": "230202",
  "qiqihar-jianhua": "230203",
  "qiqihar-tiefeng": "230204",
  "qiqihar-angangxi": "230205",
  "qiqihar-fularji": "230206",
  "qiqihar-nianzishan": "230207",
  "qiqihar-meilisi": "230208",
  "qiqihar-longjiang": "230221",
  "qiqihar-yian": "230223",
  "qiqihar-tailai": "230224",
  "qiqihar-gannan": "230225",
  "qiqihar-fuyu": "230227",
  "qiqihar-keshan": "230229",
  "qiqihar-kedong": "230230",
  "qiqihar-baiquan": "230231",
  "qiqihar-nehe": "230281",
  "heihe-all": "231100",
  "heihe-aihui": "231102",
  "heihe-xunke": "231123",
  "heihe-sunwu": "231124",
  "heihe-beian": "231181",
  "heihe-wudalianchi": "231182",
  "heihe-nenjiang": "231183",
  "hulunbuir-designated": "150700",
  "hulunbuir-arun": "150721",
  "hulunbuir-morin-dawa": "150722",
  "hulunbuir-oroqen": "150723",
  "hulunbuir-zhalantun": "150783",
} as const satisfies Readonly<Record<string, string>>;

const regionIdByCode = Object.fromEntries(
  Object.entries(regionCodeById).map(([id, code]) => [code, id]),
) as Readonly<Record<string, string>>;

export function marketObjectRegionCode(regionId: string): string | undefined {
  if (/^\d{6}$/u.test(regionId)) return regionId;
  return regionCodeById[regionId as keyof typeof regionCodeById];
}

export function marketObjectRegionId(regionCode: string): string | undefined {
  return regionIdByCode[regionCode];
}
