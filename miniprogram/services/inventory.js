const {
  getExpireText,
  getStatus
} = require("../utils/date")


function formatItem(item) {
  const { getStorageLabelByValue } = require("./fridgeProfile")

  return {
    ...item,
    id: item._id,
    expireText: getExpireText(item.expireDate),
    status: getStatus(item.expireDate),
    storageName: getStorageLabelByValue(item.storage) || item.storageName || item.storage
  }
}

async function callInventory(action, data = {}) {
  const res = await wx.cloud.callFunction({
    name: "inventory",
    data: {
      action,
      ...data
    }
  })

  const result = res.result

  if (!result || !result.success) {
    throw new Error(result?.message || "库存操作失败")
  }

  return result
}

async function getInventory() {
  const result = await callInventory("list")

  return result.items
    .filter(item => Number(item.quantity || 0) > 0)
    .map(formatItem)
}

async function addFood(food) {
  const result = await callInventory("add", {
    food
  })

  return formatItem(result.item)
}

async function updateFood(itemId, updates) {
  const result = await callInventory("update", {
    itemId,
    updates
  })

  return formatItem(result.item)
}

async function consumeFood(itemId, amount) {
  const result = await callInventory("consume", {
    itemId,
    amount
  })

  return result.item ? formatItem(result.item) : {
    deletedId: result.deletedId,
    consumedAmount: result.consumedAmount
  }
}

async function deleteFood(itemId) {
  const result = await callInventory("delete", {
    itemId
  })

  return result.deletedId
}

async function removeFoodByStorage(storageValues) {
  const result = await callInventory("deleteByStorage", {
    storageValues: Array.isArray(storageValues) ? storageValues : [storageValues]
  })

  return result.deletedCount || 0
}

async function getFoodById(itemId) {
  const inventory = await getInventory()

  return inventory.find(
    item => String(item._id) === String(itemId)
  )
}

module.exports = {
  getInventory,
  addFood,
  updateFood,
  consumeFood,
  deleteFood,
  getFoodById,
  removeFoodByStorage,
  formatItem
}