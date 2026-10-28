/**
 * L&Qmercatone 意大利运费模板
 * 
 * 区域划分:
 * - 本土 (Italia Continentale): 基础运费
 * - 西西里 (Sicilia): +€2
 * - 撒丁岛 (Sardegna): +€2
 * - 其他岛屿 (Altre Isole): +€3
 */

// 意大利大区映射
const REGION_MAP = {
  // 本土大区
  'lombardia': { zone: 'mainland', name: 'Lombardia', nameZh: '伦巴第' },
  'lazio': { zone: 'mainland', name: 'Lazio', nameZh: '拉齐奥' },
  'campania': { zone: 'mainland', name: 'Campania', nameZh: '坎帕尼亚' },
  'veneto': { zone: 'mainland', name: 'Veneto', nameZh: '威尼托' },
  'piemonte': { zone: 'mainland', name: 'Piemonte', nameZh: '皮埃蒙特' },
  'emilia-romagna': { zone: 'mainland', name: 'Emilia-Romagna', nameZh: '艾米利亚' },
  'toscana': { zone: 'mainland', name: 'Toscana', nameZh: '托斯卡纳' },
  'liguria': { zone: 'mainland', name: 'Liguria', nameZh: '利古里亚' },
  'marche': { zone: 'mainland', name: 'Marche', nameZh: '马尔凯' },
  'umbria': { zone: 'mainland', name: 'Umbria', nameZh: '翁布里亚' },
  'abruzzo': { zone: 'mainland', name: 'Abruzzo', nameZh: '阿布鲁佐' },
  'molise': { zone: 'mainland', name: 'Molise', nameZh: '莫利塞' },
  'basilicata': { zone: 'mainland', name: 'Basilicata', nameZh: '巴西利卡塔' },
  'calabria': { zone: 'mainland', name: 'Calabria', nameZh: '卡拉布里亚' },
  'puglia': { zone: 'mainland', name: 'Puglia', nameZh: '普利亚' },
  'friuli': { zone: 'mainland', name: 'Friuli Venezia Giulia', nameZh: '弗留利' },
  'trentino': { zone: 'mainland', name: 'Trentino-Alto Adige', nameZh: '特伦蒂诺' },
  'valle_aosta': { zone: 'mainland', name: "Valle d'Aosta", nameZh: '瓦莱达奥斯塔' },
  
  // 西西里
  'sicilia': { zone: 'sicily', name: 'Sicilia', nameZh: '西西里' },
  
  // 撒丁岛
  'sardegna': { zone: 'sardinia', name: 'Sardegna', nameZh: '撒丁岛' },
  
  // 其他岛屿
  'sardegna_islands': { zone: 'other_islands', name: 'Isole Minori', nameZh: '其他岛屿' }
};

// 运费模板
const SHIPPING_TEMPLATES = {
  // 普通小件（默认）
  standard: {
    name: '标准运费 Spedizione Standard',
    nameZh: '普通小件',
    basePrice: 4.99,  // 基础运费
    freeThreshold: 99, // 满额免运费
    zones: {
      mainland: { surcharge: 0, name: '本土', deliveryDays: '3-5' },
      sicily: { surcharge: 2.00, name: '西西里', deliveryDays: '5-7' },
      sardinia: { surcharge: 2.00, name: '撒丁岛', deliveryDays: '5-7' },
      other_islands: { surcharge: 3.00, name: '其他岛屿', deliveryDays: '7-10' }
    }
  },
  
  // 大件商品
  large: {
    name: '大件运费 Spedizione Grande',
    nameZh: '大件商品',
    basePrice: 9.99,
    freeThreshold: null, // 不免运费
    zones: {
      mainland: { surcharge: 0, name: '本土', deliveryDays: '5-7' },
      sicily: { surcharge: 5.00, name: '西西里', deliveryDays: '7-10' },
      sardinia: { surcharge: 5.00, name: '撒丁岛', deliveryDays: '7-10' },
      other_islands: { surcharge: 8.00, name: '其他岛屿', deliveryDays: '10-15' }
    }
  },
  
  // 自提
  pickup: {
    name: '到店自提 Ritiro in negozio',
    nameZh: '自提',
    basePrice: 0,
    freeThreshold: 0,
    zones: {}
  }
};

// 计算运费
function calculateShipping(cart, region, template = 'standard') {
  const config = SHIPPING_TEMPLATES[template];
  if (!config) return { price: 0, error: '无效运费模板' };
  
  // 自提免运费
  if (template === 'pickup') {
    return {
      price: 0,
      template: 'pickup',
      message: '到店自提免费 / Ritiro gratuito'
    };
  }
  
  // 获取区域信息
  const regionInfo = REGION_MAP[region.toLowerCase()] || { zone: 'mainland' };
  const zoneConfig = config.zones[regionInfo.zone] || config.zones.mainland;
  
  // 计算基础运费
  let shippingPrice = config.basePrice + zoneConfig.surcharge;
  
  // 检查是否满额免运费
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let freeShipping = false;
  
  if (config.freeThreshold && subtotal >= config.freeThreshold) {
    shippingPrice = 0;
    freeShipping = true;
  }
  
  return {
    price: shippingPrice,
    originalPrice: config.basePrice + zoneConfig.surcharge,
    freeShipping,
    template,
    zone: regionInfo.zone,
    region: regionInfo.name,
    deliveryDays: zoneConfig.deliveryDays,
    message: freeShipping 
      ? `满€${config.freeThreshold}免运费 / Spedizione gratis sopra €${config.freeThreshold}`
      : `运费 €${shippingPrice.toFixed(2)} (${zoneConfig.name} ${zoneConfig.deliveryDays}天)`
  };
}

// 导出
if (typeof module !== 'undefined') {
  module.exports = { REGION_MAP, SHIPPING_TEMPLATES, calculateShipping };
}
