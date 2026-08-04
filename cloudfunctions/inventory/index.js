const cloud = require("wx-server-sdk")

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const command = db.command

const usersCollection = db.collection("users")
const itemsCollection = db.collection("items")
const logsCollection = db.collection("activity_logs")
const restockRuleCollection = db.collection("restock_rules")
const shoppingListCollection = db.collection("shopping_list")

/**
 * 根据当前微信用户查找用户记录和家庭 ID。
 */
async function getCurrentUser(openid) {
  const userResult = await usersCollection.where({
    openid
  }).limit(1).get()

  if (userResult.data.length === 0) {
    throw new Error("USER_NOT_FOUND")
  }

  const user = userResult.data[0]

  if (!user.familyId) {
    throw new Error("NO_FAMILY")
  }

  return user
}

/**
 * 只保留允许写入数据库的食材字段。
 * 避免客户端顺手把 _id、familyId 等敏感字段覆盖掉。
 */
function sanitizeFood(food = {}) {
  return {
    name: String(food.name || "").trim(),
    emoji: String(food.emoji || "🍽️"),
    category: String(food.category || "其他"),
    storage: String(food.storage || "冷藏"),
    quantity: Number(food.quantity),
    unit: String(food.unit || "个"),
    purchaseDate: String(food.purchaseDate || ""),
    expireDate: String(food.expireDate || ""),
    note: String(food.note || "")
  }
}

function validateFood(food) {
  if (!food.name) {
    throw new Error("INVALID_NAME")
  }

  if (!Number.isFinite(food.quantity) || food.quantity < 0) {
    throw new Error("INVALID_QUANTITY")
  }
}

function normalizeStorageValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
}

function getStorageName(storageValue, areas = []) {
  const normalizedStorageValue = normalizeStorageValue(storageValue)

  if (!normalizedStorageValue) {
    return ""
  }

  const matchedArea = Array.isArray(areas)
    ? areas.find(area => {
        return normalizedStorageValue === normalizeStorageValue(area.id) ||
          normalizedStorageValue === normalizeStorageValue(area.type) ||
          normalizedStorageValue === normalizeStorageValue(area.name)
      })
    : null

  if (!matchedArea) {
    return normalizedStorageValue
  }

  return `${matchedArea.name}${matchedArea.type && matchedArea.type !== matchedArea.name ? `（${matchedArea.type}）` : ""}`
}

function formatItem(item, areas = []) {
  return {
    ...item,
    storageName: getStorageName(item.storage, areas)
  }
}

async function addActivityLog({
  familyId,
  userName,
  openid,
  action,
  itemId,
  itemName,
  emoji,
  description
}) {
  await logsCollection.add({
    data: {
      familyId,
      openid,
      userName,
      action,
      itemId,
      itemName,
      emoji: emoji || "🍽️",
      description,
      createdAt: new Date()
    }
  })
}

async function tryAutoRestockAfterConsume({
  familyId,
  openid,
  consumedItem,
  nextQuantity
}) {
  const itemName = String(consumedItem.name || "").trim()
  const normalizedItemName = itemName.toLowerCase()
  const foodId = String(consumedItem._id || "")

  const rulesResult = await restockRuleCollection
    .where({
      familyId,
      enabled: true
    })
    .get()

  const matchedRule = (rulesResult.data || []).find(rule => {
    const ruleFoodId = String(rule.foodId || "")
    const ruleItemName = String(rule.itemName || "").trim()
    const normalizedRuleName = ruleItemName.toLowerCase()

    const isFoodIdMatched = Boolean(ruleFoodId && foodId && ruleFoodId === foodId)
    const isNameMatched = Boolean(normalizedRuleName && normalizedRuleName === normalizedItemName)

    return isFoodIdMatched || isNameMatched
  })

  if (!matchedRule) {
    return { triggered: false, reason: "RULE_NOT_FOUND" }
  }

  const threshold = Number(matchedRule.threshold)

  if (!Number.isFinite(threshold) || nextQuantity > threshold) {
    return { triggered: false, reason: "THRESHOLD_NOT_REACHED" }
  }

  const pendingResult = await shoppingListCollection
    .where({
      familyId,
      name: itemName,
      bought: false
    })
    .limit(1)
    .get()

  if (pendingResult.data.length > 0) {
    return {
      triggered: false,
      reason: "PENDING_EXISTS",
      shoppingItemId: pendingResult.data[0]._id
    }
  }

  const quantity = Number(matchedRule.addQuantity)

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { triggered: false, reason: "INVALID_ADD_QUANTITY" }
  }

  const now = new Date()

  const addedResult = await shoppingListCollection.add({
    data: {
      familyId,
      name: itemName,
      quantity,
      unit: String(matchedRule.unit || consumedItem.unit || "个"),
      source: "auto",
      bought: false,
      restockRuleId: matchedRule._id,
      restockTriggerItemId: foodId,
      createdBy: openid,
      updatedBy: openid,
      createdAt: now,
      updatedAt: now
    }
  })

  return {
    triggered: true,
    reason: "ADDED_TO_SHOPPING_LIST",
    shoppingItemId: addedResult._id,
    ruleId: matchedRule._id
  }
}

function formatError(error) {
  const messages = {
    USER_NOT_FOUND: "用户不存在，请重新登录",
    NO_FAMILY: "请先创建或加入家庭",
    INVALID_NAME: "食材名称不能为空",
    INVALID_QUANTITY: "食材数量不正确",
    INVALID_AMOUNT: "消耗数量不正确",
    INSUFFICIENT_QUANTITY: "现有数量不足",
    ITEM_NOT_FOUND: "没有找到这条食材记录",
    INVALID_ACTION: "不支持的库存操作"
  }

  return {
    success: false,
    code: error.message,
    message: messages[error.message] || "库存操作失败"
  }
}

exports.main = async (event = {}) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const action = event.action

    const user = await getCurrentUser(openid)
    const familyId = user.familyId

    const familyResult = await db
      .collection("family")
      .doc(familyId)
  .   get()

    const family = familyResult.data

    const member = family.members.find(
      m => m.openid === openid
    )

    switch (action) {
      case "list": {
        const result = await itemsCollection
          .where({
            familyId
          })
          .orderBy("updatedAt", "desc")
          .get()

        const visibleItems = result.data.filter(item => Number(item.quantity || 0) > 0)

        return {
          success: true,
          items: visibleItems.map(item => formatItem(item, family.areas))
        }
      }

      case "add": {
        const food = sanitizeFood(event.food)
        validateFood(food)

        const now = new Date()

        const result = await itemsCollection.add({
          data: {
            ...food,
            familyId,
            createdBy: openid,
            updatedBy: openid,
            createdAt: now,
            updatedAt: now
          }
        })

        const addedItem = await itemsCollection.doc(result._id).get()
        const item = addedItem.data

        await addActivityLog({
          familyId,
          userName: member.name || "家庭成员",
          openid,
          action: "add",
          itemId: item._id,
          itemName: item.name,
          emoji: item.emoji,
          description: `添加了 ${item.quantity}${item.unit}${item.name}`
        })

        return {
          success: true,
          item: formatItem(item, family.areas)
        }
      }

      case "consume": {
      const itemId = String(event.itemId || "")
      const amount = Number(event.amount)

      if (!itemId) {
        throw new Error("ITEM_NOT_FOUND")
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("INVALID_AMOUNT")
      }

      const existingResult = await itemsCollection
        .where({
          _id: itemId,
          familyId
        })
        .limit(1)
        .get()

      if (existingResult.data.length === 0) {
        throw new Error("ITEM_NOT_FOUND")
      }

      const existingItem = existingResult.data[0]
      const currentQuantity = Number(existingItem.quantity)

      if (amount > currentQuantity) {
        throw new Error("INSUFFICIENT_QUANTITY")
      }

      const nextQuantity = currentQuantity - amount

      if (nextQuantity === 0) {
        await itemsCollection.doc(itemId).remove()
      } else {
        await itemsCollection.doc(itemId).update({
          data: {
            quantity: nextQuantity,
            updatedBy: openid,
            updatedAt: new Date()
          }
        })
      }

      try {
        await addActivityLog({
          familyId,
          userName: member.name || "家庭成员",
          openid,
          action: "consume",
          itemId: existingItem._id,
          itemName: existingItem.name,
          emoji: existingItem.emoji,
          description:
            `消耗了 ${amount}${existingItem.unit}${existingItem.name}`
        })
      } catch (logError) {
        console.error("写入消耗日志失败：", logError)
      }

      let autoRestock = {
        triggered: false,
        reason: "NOT_PROCESSED"
      }

      try {
        autoRestock = await tryAutoRestockAfterConsume({
          familyId,
          openid,
          consumedItem: existingItem,
          nextQuantity
        })
      } catch (restockError) {
        console.error("自动补货检查失败：", restockError)

        autoRestock = {
          triggered: false,
          reason: "AUTO_RESTOCK_ERROR",
          message: restockError.message || "自动补货检查失败"
        }
      }

      return {
        success: true,
        consumedAmount: amount,
        deletedId: nextQuantity === 0 ? itemId : "",
        autoRestock,
        item: nextQuantity === 0 ? null : formatItem({
          ...existingItem,
          quantity: nextQuantity,
          updatedBy: openid,
          updatedAt: new Date()
        }, family.areas)
      }
    }

      case "update": {
        const itemId = String(event.itemId || "")

        if (!itemId) {
          throw new Error("ITEM_NOT_FOUND")
        }

        const existingResult = await itemsCollection
          .where({
            _id: itemId,
            familyId
          })
          .limit(1)
          .get()

        if (existingResult.data.length === 0) {
          throw new Error("ITEM_NOT_FOUND")
        }

        const updates = sanitizeFood(event.updates)
        validateFood(updates)

        await itemsCollection.doc(itemId).update({
          data: {
            ...updates,
            updatedBy: openid,
            updatedAt: new Date()
          }
        })

        const updatedItem = await itemsCollection.doc(itemId).get()
        const item = updatedItem.data

        await addActivityLog({
          familyId,
          userName: member.name || "家庭成员",
          openid,
          action: "update",
          itemId: item._id,
          itemName: item.name,
          emoji: item.emoji,
          description: `修改了${item.name}`
        })

        return {
          success: true,
          item: formatItem(item, family.areas)
        }
      }

      case "delete": {
        const itemId = String(event.itemId || "")

        if (!itemId) {
          throw new Error("ITEM_NOT_FOUND")
        }

        const existingResult = await itemsCollection
          .where({
            _id: itemId,
            familyId
          })
          .limit(1)
          .get()

        if (existingResult.data.length === 0) {
          throw new Error("ITEM_NOT_FOUND")
        }

        const existingItem = existingResult.data[0]

        await itemsCollection.doc(itemId).remove()

        await addActivityLog({
          familyId,
          userName: member.name || "家庭成员",
          openid,
          action: "delete",
          itemId,
          itemName: existingItem.name,
          emoji: existingItem.emoji,
          description: `删除了${existingItem.name}`
        })

        return {
          success: true,
          deletedId: itemId
        }
      }

      case "deleteByStorage": {
        const storageValues = Array.isArray(event.storageValues)
          ? event.storageValues.map(value => String(value || "").trim()).filter(Boolean)
          : []

        if (!storageValues.length) {
          throw new Error("INVALID_ACTION")
        }

        const result = await itemsCollection
          .where({
            familyId,
            storage: command.in(storageValues)
          })
          .remove()

        return {
          success: true,
          deletedCount: result.stats ? result.stats.removed : 0
        }
      }

      case "recentLogs": {
        const limit = Math.min(Number(event.limit) || 5, 20)

        const result = await logsCollection
          .where({
            familyId
          })
          .orderBy("createdAt", "desc")
          .limit(limit)
          .get()

        return {
          success: true,
          logs: result.data
        }
      }

      default:
        throw new Error("INVALID_ACTION")
    }
  } catch (error) {
    console.error("inventory error:", error)

    return formatError(error)
  }
}