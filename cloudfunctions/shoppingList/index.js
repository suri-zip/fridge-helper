const cloud = require("wx-server-sdk")

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const command = db.command
const shoppingListCollection = db.collection("shopping_list")
const usersCollection = db.collection("users")

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

function sanitizeItem(item = {}) {
  return {
    name: String(item.name || "").trim(),
    quantity: Number(item.quantity),
    unit: String(item.unit || "个"),
    source: item.source === "auto" ? "auto" : "manual"
  }
}

function validateItem(item) {
  if (!item.name) {
    throw new Error("INVALID_NAME")
  }

  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw new Error("INVALID_QUANTITY")
  }
}

function formatItem(item) {
  return {
    ...item,
    id: item._id,
    quantity: Number(item.quantity || 0),
    bought: Boolean(item.bought),
    unit: item.unit || "个",
    source: item.source === "auto" ? "auto" : "manual"
  }
}

function formatError(error) {
  const messages = {
    USER_NOT_FOUND: "用户不存在，请重新登录",
    NO_FAMILY: "请先创建或加入家庭",
    INVALID_NAME: "物品名称不能为空",
    INVALID_QUANTITY: "物品数量不正确",
    ITEM_NOT_FOUND: "没有找到这条购物记录",
    INVALID_ACTION: "不支持的购物清单操作"
  }

  return {
    success: false,
    code: error.message,
    message: messages[error.message] || "购物清单操作失败"
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
        const result = await shoppingListCollection
          .where({
            familyId
          })
          .orderBy("updatedAt", "desc")
          .get()

        return {
          success: true,
          items: result.data.map(formatItem)
        }
      }

      case "add": {
        const item = sanitizeItem(event.item)
        validateItem(item)

        const now = new Date()

        const result = await shoppingListCollection.add({
          data: {
            ...item,
            familyId,
            bought: false,
            createdBy: openid,
            updatedBy: openid,
            createdAt: now,
            updatedAt: now
          }
        })

        const addedItem = await shoppingListCollection.doc(result._id).get()

        return {
          success: true,
          item: formatItem(addedItem.data)
        }
      }

      case "delete": {
        const itemId = String(event.itemId || "")

        if (!itemId) {
          throw new Error("ITEM_NOT_FOUND")
        }

        const existingResult = await shoppingListCollection
          .where({
            _id: itemId,
            familyId
          })
          .limit(1)
          .get()

        if (existingResult.data.length === 0) {
          throw new Error("ITEM_NOT_FOUND")
        }

        await shoppingListCollection.doc(itemId).remove()

        return {
          success: true,
          deletedId: itemId
        }
      }

      case "markBought": {
        const itemId = String(event.itemId || "")

        if (!itemId) {
          throw new Error("ITEM_NOT_FOUND")
        }

        const existingResult = await shoppingListCollection
          .where({
            _id: itemId,
            familyId
          })
          .limit(1)
          .get()

        if (existingResult.data.length === 0) {
          throw new Error("ITEM_NOT_FOUND")
        }

        await shoppingListCollection.doc(itemId).update({
          data: {
            bought: true,
            boughtAt: new Date(),
            updatedBy: openid,
            updatedAt: new Date()
          }
        })

        const updatedItem = await shoppingListCollection.doc(itemId).get()

        return {
          success: true,
          item: formatItem(updatedItem.data)
        }
      }

      case "markPending": {
        const itemId = String(event.itemId || "")

        if (!itemId) {
          throw new Error("ITEM_NOT_FOUND")
        }

        const existingResult = await shoppingListCollection
          .where({
            _id: itemId,
            familyId,
            bought: true
          })
          .limit(1)
          .get()

        if (existingResult.data.length === 0) {
          throw new Error("ITEM_NOT_FOUND")
        }

        await shoppingListCollection.doc(itemId).update({
          data: {
            bought: false,
            boughtAt: command.remove(),
            updatedBy: openid,
            updatedAt: new Date()
          }
        })

        const updatedItem = await shoppingListCollection.doc(itemId).get()

        return {
          success: true,
          item: formatItem(updatedItem.data)
        }
      }

      default:
        throw new Error("INVALID_ACTION")
    }
  } catch (error) {
    console.error("shoppingList cloud function failed:", error)

    return formatError(error)
  }
}