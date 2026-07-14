const cloud = require("wx-server-sdk")

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const command = db.command

const usersCollection = db.collection("users")
const itemsCollection = db.collection("items")
const logsCollection = db.collection("activity_logs")

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

async function addActivityLog({
  familyId,
  user,
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
      userId: user._id,
      openid,
      userName: user.name || "家庭成员",
      action,
      itemId,
      itemName,
      emoji: emoji || "🍽️",
      description,
      createdAt: new Date()
    }
  })
}

function formatError(error) {
  const messages = {
    USER_NOT_FOUND: "用户不存在，请重新登录",
    NO_FAMILY: "请先创建或加入家庭",
    INVALID_NAME: "食材名称不能为空",
    INVALID_QUANTITY: "食材数量不正确",
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

    switch (action) {
      case "list": {
        const result = await itemsCollection
          .where({
            familyId
          })
          .orderBy("updatedAt", "desc")
          .get()

        return {
          success: true,
          items: result.data
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
          user,
          openid,
          action: "add",
          itemId: item._id,
          itemName: item.name,
          emoji: item.emoji,
          description: `添加了 ${item.quantity}${item.unit}${item.name}`
        })

        return {
          success: true,
          item
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
          user,
          openid,
          action: "update",
          itemId: item._id,
          itemName: item.name,
          emoji: item.emoji,
          description: `修改了${item.name}`
        })

        return {
          success: true,
          item
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
          user,
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