const STORAGE_KEY = "TUNTUN_INVENTORY"
const { getExpireText, getStatus } = require("../utils/date")

const INVENTORY_CATEGORIES = ["水果", "蔬菜", "肉类", "海鲜", "调料", "饮料", "零食", "其他"]

const defaultInventory = [
  {
    id: "1",
    name: "鸡蛋",
    emoji: "🥚",
    category: "蛋类",
    storage: "冷藏",
    quantity: 12,
    unit: "个",
    purchaseDate: "2026-07-08",
    expireDate: "2026-07-21",
    status: "fresh"
  },
  {
    id: "2",
    name: "牛奶",
    emoji: "🥛",
    category: "饮料",
    storage: "冷藏",
    quantity: 2,
    unit: "盒",
    purchaseDate: "2026-07-08",
    expireDate: "2026-07-09",
    status: "warning"
  },
  {
    id: "3",
    name: "草莓",
    emoji: "🍓",
    category: "水果",
    storage: "冷藏",
    quantity: 1,
    unit: "盒",
    purchaseDate: "2026-07-08",
    expireDate: "2026-07-08",
    status: "danger"
  }
]

function getInventory() {
  const data = wx.getStorageSync(STORAGE_KEY)

  const inventory = data && data.length ? data : defaultInventory

  if (!data || !data.length) {
    wx.setStorageSync(STORAGE_KEY, defaultInventory)
  }

  return inventory.map(item => ({
    ...item,
    expireText: getExpireText(item.expireDate),
    status: getStatus(item.expireDate)
  }))
}

function addFood(food) {
  const inventory = getInventory()

  const newFood = {
    id: Date.now().toString(),
    emoji: food.emoji || "🍽️",
    status: food.status || "fresh",
    ...food
  }

  inventory.unshift(newFood)
  wx.setStorageSync(STORAGE_KEY, inventory)

  return newFood
}
function getFoodById(id) {
  const inventory = getInventory()
  return inventory.find(item => String(item.id) === String(id))
}

function updateFood(id, updates) {
  const rawData = wx.getStorageSync(STORAGE_KEY)
  const inventory = rawData && rawData.length ? rawData : defaultInventory

  const newInventory = inventory.map(item => {
    if (String(item.id) !== String(id)) return item

    return {
      ...item,
      ...updates
    }
  })

  wx.setStorageSync(STORAGE_KEY, newInventory)

  return getFoodById(id)
}

function removeFoodByStorage(storageName) {
  const rawData = wx.getStorageSync(STORAGE_KEY)
  const inventory = rawData && rawData.length ? rawData : defaultInventory
  const nextInventory = inventory.filter(item => item.storage !== storageName)

  wx.setStorageSync(STORAGE_KEY, nextInventory)

  return nextInventory
}

module.exports = {
  getInventory,
  addFood,
  getFoodById,
  updateFood,
  removeFoodByStorage,
  INVENTORY_CATEGORIES
}