/**
 * Конфігурація динамічних фільтрів для каталогу.
 * Використовується на сторінці catalog через app.js.
 */

/**
 * SUBFILTER_CONFIG - підфільтри на рівні категорій.
 * Формат:
 * {
 *   [category]: {
 *     [filterKey]: { label, htmlName, options, searchFields }
 *   }
 * }
 */
const SUBFILTER_CONFIG = {
  cpu: {
    manufacturer: {
      label: 'Виробник',
      htmlName: 'cpu-manufacturer',
      options: ['Intel', 'AMD'],
      searchFields: ['specs', 'name', 'description']
    },
    cores: {
      label: 'Кількість ядер',
      htmlName: 'cpu-cores',
      options: ['4', '6', '8', '10', '12', '16', '24'],
      searchFields: ['specs', 'name', 'description']
    },
    socket: {
      label: 'Сокет',
      htmlName: 'cpu-socket',
      options: ['LGA1700', 'AM5', 'AM4'],
      searchFields: ['specs', 'name']
    }
  },

  gpu: {
    manufacturer: {
      label: 'Виробник',
      htmlName: 'gpu-manufacturer',
      options: ['NVIDIA', 'AMD'],
      searchFields: ['specs', 'name', 'description']
    },
    memory: {
      label: "Об'єм пам'яті",
      htmlName: 'gpu-memory',
      options: ['8GB', '12GB', '16GB', '24GB'],
      searchFields: ['specs', 'name']
    },
    series: {
      label: 'Серія',
      htmlName: 'gpu-series',
      options: ['RTX 40', 'RTX 30', 'RX 7000', 'RX 6000'],
      searchFields: ['specs', 'name']
    }
  },

  ram: {
    type: {
      label: 'Тип',
      htmlName: 'ram-type',
      options: ['DDR5', 'DDR4'],
      searchFields: ['specs', 'name']
    },
    capacity: {
      label: "Об'єм",
      htmlName: 'ram-capacity',
      options: ['16GB', '32GB', '64GB'],
      searchFields: ['specs', 'name']
    },
    speed: {
      label: 'Швидкість',
      htmlName: 'ram-speed',
      options: ['5600MHz', '6000MHz', '6400MHz'],
      searchFields: ['specs', 'name']
    }
  },

  ssd: {
    interface: {
      label: 'Інтерфейс',
      htmlName: 'ssd-interface',
      options: ['NVMe M.2', 'SATA M.2'],
      searchFields: ['specs', 'name']
    },
    capacity: {
      label: "Об'єм",
      htmlName: 'ssd-capacity',
      options: ['500GB', '1TB', '2TB', '4TB'],
      searchFields: ['specs', 'name']
    }
  },

  hdd: {
    formFactor: {
      label: 'Формат',
      htmlName: 'hdd-formfactor',
      options: ['3.5" HDD', '2.5" HDD'],
      searchFields: ['name', 'specs']
    },
    capacity: {
      label: "Об'єм",
      htmlName: 'hdd-capacity',
      options: ['500GB', '1TB', '2TB', '4TB'],
      searchFields: ['specs', 'name']
    }
  },

  mobo: {
    socket: {
      label: 'Сокет',
      htmlName: 'mobo-socket',
      options: ['LGA1700', 'AM5', 'AM4'],
      searchFields: ['specs', 'name']
    },
    formFactor: {
      label: 'Тип плати',
      htmlName: 'mobo-formfactor',
      options: ['ATX', 'Micro-ATX', 'Mini-ITX'],
      searchFields: ['name', 'specs']
    }
  },

  psu: {
    wattage: {
      label: 'Потужність',
      htmlName: 'psu-wattage',
      options: ['550W', '650W', '750W', '850W', '1000W'],
      searchFields: ['specs', 'name']
    },
    certification: {
      label: 'Сертифікація',
      htmlName: 'psu-certification',
      options: ['80+ Bronze', '80+ Gold', '80+ Platinum'],
      searchFields: ['specs', 'name']
    }
  }
};

/**
 * Мапа назв категорій для відображення у картках.
 */
const CATEGORY_NAME_MAP = {
  cpu: 'Процесори',
  gpu: 'Відеокарти',
  ram: "Пам'ять (RAM)",
  ssd: 'Накопичувачі (SSD)',
  hdd: 'Накопичувачі (HDD)',
  psu: 'Блоки живлення',
  mobo: 'Материнські плати'
};

/**
 * Основні категорії каталогу.
 */
const MAIN_CATEGORIES = [
  { value: 'cpu', label: 'Процесори (CPU)' },
  { value: 'gpu', label: 'Відеокарти (GPU)' },
  { value: 'ram', label: "Пам'ять (RAM)" },
  { value: 'ssd', label: 'SSD накопичувачі' },
  { value: 'hdd', label: 'HDD накопичувачі' },
  { value: 'mobo', label: 'Материнські плати' },
  { value: 'psu', label: 'Блоки живлення' }
];

/**
 * Повертає конфігурацію фільтрів для переданих категорій.
 * @param {string[]} categories
 * @returns {object}
 */
function getFiltersForCategories(categories) {
  const config = {};

  if (!Array.isArray(categories)) {
    return config;
  }

  categories.forEach(category => {
    if (SUBFILTER_CONFIG[category]) {
      config[category] = SUBFILTER_CONFIG[category];
    }
  });

  return config;
}

window.SUBFILTER_CONFIG = SUBFILTER_CONFIG;
window.CATEGORY_NAME_MAP = CATEGORY_NAME_MAP;
window.MAIN_CATEGORIES = MAIN_CATEGORIES;
window.getFiltersForCategories = getFiltersForCategories;
