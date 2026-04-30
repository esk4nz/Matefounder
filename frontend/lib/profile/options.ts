export const PROFILE_ROLE_OPTIONS = [
  { value: "seeker", label: "Шукаю де жити" },
  { value: "owner", label: "Шукаю когось до себе" },
  { value: "both", label: "Шукаю де і з ким жити" },
] as const;

export type ProfileRole = (typeof PROFILE_ROLE_OPTIONS)[number]["value"];

export const UKRAINE_REGION_OPTIONS = [
  {
    region: "Вінницька область",
    cities: ["Вінниця", "Жмеринка", "Могилів-Подільський", "Хмільник"],
  },
  {
    region: "Волинська область",
    cities: ["Луцьк", "Ковель", "Володимир", "Нововолинськ"],
  },
  {
    region: "Дніпропетровська область",
    cities: ["Дніпро", "Кривий Ріг", "Кам'янське", "Нікополь"],
  },
  {
    region: "Донецька область",
    cities: ["Краматорськ", "Слов'янськ", "Покровськ", "Бахмут"],
  },
  {
    region: "Житомирська область",
    cities: ["Житомир", "Бердичів", "Коростень", "Звягель"],
  },
  {
    region: "Закарпатська область",
    cities: ["Ужгород", "Мукачево", "Хуст", "Берегове"],
  },
  {
    region: "Запорізька область",
    cities: ["Запоріжжя", "Мелітополь", "Бердянськ", "Енергодар"],
  },
  {
    region: "Івано-Франківська область",
    cities: ["Івано-Франківськ", "Калуш", "Коломия", "Яремче"],
  },
  {
    region: "Київська область",
    cities: ["Біла Церква", "Бровари", "Бориспіль", "Ірпінь", "Буча", "Вишневе"],
  },
  {
    region: "Кіровоградська область",
    cities: ["Кропивницький", "Олександрія", "Світловодськ", "Знам'янка"],
  },
  {
    region: "Луганська область",
    cities: ["Сєвєродонецьк", "Лисичанськ", "Старобільськ", "Рубіжне"],
  },
  {
    region: "Львівська область",
    cities: ["Львів", "Дрогобич", "Стрий", "Червоноград", "Трускавець"],
  },
  {
    region: "Миколаївська область",
    cities: ["Миколаїв", "Первомайськ", "Вознесенськ", "Южноукраїнськ"],
  },
  {
    region: "Одеська область",
    cities: ["Одеса", "Чорноморськ", "Ізмаїл", "Подільськ", "Білгород-Дністровський"],
  },
  {
    region: "Полтавська область",
    cities: ["Полтава", "Кременчук", "Миргород", "Лубни"],
  },
  {
    region: "Рівненська область",
    cities: ["Рівне", "Дубно", "Вараш", "Сарни"],
  },
  {
    region: "Сумська область",
    cities: ["Суми", "Конотоп", "Шостка", "Охтирка"],
  },
  {
    region: "Тернопільська область",
    cities: ["Тернопіль", "Чортків", "Кременець", "Бережани"],
  },
  {
    region: "Харківська область",
    cities: ["Харків", "Лозова", "Ізюм", "Чугуїв"],
  },
  {
    region: "Херсонська область",
    cities: ["Херсон", "Нова Каховка", "Каховка", "Генічеськ"],
  },
  {
    region: "Хмельницька область",
    cities: ["Хмельницький", "Кам'янець-Подільський", "Шепетівка", "Славута"],
  },
  {
    region: "Черкаська область",
    cities: ["Черкаси", "Умань", "Сміла", "Золотоноша"],
  },
  {
    region: "Чернівецька область",
    cities: ["Чернівці", "Хотин", "Новодністровськ", "Сторожинець"],
  },
  {
    region: "Чернігівська область",
    cities: ["Чернігів", "Ніжин", "Прилуки", "Новгород-Сіверський"],
  },
  {
    region: "м. Київ",
    cities: ["Київ"],
  },
] as const;

export const REGION_OPTIONS = UKRAINE_REGION_OPTIONS.map((item) => item.region);

export const CITIES_BY_REGION = Object.fromEntries(
  UKRAINE_REGION_OPTIONS.map((item) => [item.region, [...item.cities]]),
) as Record<string, string[]>;

const REGION_SET = new Set<string>(REGION_OPTIONS);

export function isValidRegion(region: string) {
  return REGION_SET.has(region);
}

export function getCitiesForRegion(region: string) {
  return CITIES_BY_REGION[region] ?? [];
}

export function isValidCityForRegion(region: string, city: string) {
  return getCitiesForRegion(region).includes(city);
}
