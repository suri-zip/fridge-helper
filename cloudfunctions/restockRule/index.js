const cloud = require("wx-server-sdk")

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const restockRuleCollection = db.collection("restock_rules")
const usersCollection = db.collection("users")

function getTimeValue(value) {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value || ""))
  return Number.isFinite(timestamp) ? timestamp : 0
}

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

async function getRulesByFamily(familyId) {
  const result = await restockRuleCollection
    .where({
      familyId
    })
    .get()

  return result.data || []
}

function sanitizeRule(rule = {}) {
  return {
    foodId: String(rule.foodId || "").trim(),
    itemName: String(rule.itemName || "").trim(),
    threshold: Number(rule.threshold),
    addQuantity: Number(rule.addQuantity),
    unit: String(rule.unit || "个").trim() || "个",
    enabled: rule.enabled !== false
  }
}

function validateRule(rule) {
  if (!rule.itemName) {
    throw new Error("INVALID_ITEM_NAME")
  }

  if (!Number.isFinite(rule.threshold) || rule.threshold < 0) {
    throw new Error("INVALID_THRESHOLD")
  }

  if (!Number.isFinite(rule.addQuantity) || rule.addQuantity <= 0) {
    throw new Error("INVALID_ADD_QUANTITY")
  }
}

function formatRule(rule) {
  return {
    ...rule,
    id: rule._id,
    threshold: Number(rule.threshold || 0),
    addQuantity: Number(rule.addQuantity || 0),
    enabled: Boolean(rule.enabled),
    unit: rule.unit || "个"
  }
}

function formatError(error) {
	const rawMessage = String((error && error.message) || "")
	const cleanMessage = rawMessage || "UNKNOWN_ERROR"

  const messages = {
    USER_NOT_FOUND: "用户不存在，请重新登录",
    NO_FAMILY: "请先创建或加入家庭",
    INVALID_ITEM_NAME: "食材名称不能为空",
    INVALID_THRESHOLD: "库存阈值不正确",
    INVALID_ADD_QUANTITY: "补货数量不正确",
    RULE_NOT_FOUND: "没有找到这条自动补货规则",
    INVALID_ACTION: "不支持的自动补货操作"
  }

  return {
    success: false,
    code: cleanMessage,
    message: messages[cleanMessage] || `自动补货操作失败：${cleanMessage}`
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
        const allRules = await getRulesByFamily(familyId)

        const rules = allRules
          .slice()
          .sort((left, right) => getTimeValue(right.updatedAt) - getTimeValue(left.updatedAt))

        return {
          success: true,
          rules: rules.map(formatRule)
        }
      }

      case "upsert": {
        const rule = sanitizeRule(event.rule)
        validateRule(rule)

        const now = new Date()

        const query = {
          familyId
        }

        if (rule.foodId) {
          query.foodId = rule.foodId
        } else {
          query.itemName = rule.itemName
        }

        const allRules = await getRulesByFamily(familyId)

        const existing = allRules.find(current => {
          if (query.foodId) {
            return String(current.foodId || "") === String(query.foodId)
          }

          return String(current.itemName || "").trim() === String(query.itemName || "").trim()
        })

        if (existing) {
          await restockRuleCollection.doc(existing._id).update({
            data: {
              ...rule,
              updatedBy: openid,
              updatedAt: now
            }
          })

          const updated = await restockRuleCollection.doc(existing._id).get()

          return {
            success: true,
            rule: formatRule(updated.data)
          }
        }

        const addResult = await restockRuleCollection.add({
          data: {
            ...rule,
            familyId,
            createdBy: openid,
            updatedBy: openid,
            createdAt: now,
            updatedAt: now
          }
        })

        const added = await restockRuleCollection.doc(addResult._id).get()

        return {
          success: true,
          rule: formatRule(added.data)
        }
      }

      case "toggle": {
        const ruleId = String(event.ruleId || "")
        const enabled = Boolean(event.enabled)

        if (!ruleId) {
          throw new Error("RULE_NOT_FOUND")
        }

        const result = await restockRuleCollection
          .where({
            _id: ruleId,
            familyId
          })
          .limit(1)
          .get()

        const existing = result.data && result.data[0]

        if (!existing) {
          throw new Error("RULE_NOT_FOUND")
        }

        await restockRuleCollection.doc(ruleId).update({
          data: {
            enabled,
            updatedBy: openid,
            updatedAt: new Date()
          }
        })

        const updated = await restockRuleCollection.doc(ruleId).get()

        return {
          success: true,
          rule: formatRule(updated.data)
        }
      }

      case "delete": {
        const ruleId = String(event.ruleId || "")

        if (!ruleId) {
          throw new Error("RULE_NOT_FOUND")
        }

        const result = await restockRuleCollection
          .where({
            _id: ruleId,
            familyId
          })
          .limit(1)
          .get()

        const existing = result.data && result.data[0]

        if (!existing) {
          throw new Error("RULE_NOT_FOUND")
        }

        await restockRuleCollection.doc(ruleId).remove()

        return {
          success: true,
          deletedId: ruleId
        }
      }

      default:
        throw new Error("INVALID_ACTION")
    }
  } catch (error) {
    console.error("restockRule cloud function failed:", error)

    return formatError(error)
  }
}
