const cloud = require("wx-server-sdk")

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const command = db.command

const usersCollection = db.collection("users")
const familiesCollection = db.collection("family")

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

function normalizeAreas(areas = []) {
  if (!Array.isArray(areas)) {
    return []
  }

  return areas
    .map(area => ({
      id: String(area.id || "").trim(),
      name: String(area.name || "").trim(),
      type: String(area.type || "").trim(),
      icon: String(area.icon || "🧊")
    }))
    .filter(area => area.id && area.name)
}

exports.main = async (event = {}) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const areas = normalizeAreas(event.areas)
    const activeAreaId = String(event.activeAreaId || "").trim()

    if (!areas.length) {
      throw new Error("INVALID_AREAS")
    }

    const user = await getCurrentUser(openid)
    const familyId = user.familyId
    const familyResult = await familiesCollection.doc(familyId).get()
    const family = familyResult.data

    if (!family) {
      throw new Error("FAMILY_NOT_FOUND")
    }

    const nextActiveAreaId = areas.find(area => area.id === activeAreaId) ? activeAreaId : (areas[0] && areas[0].id) || ""

    await familiesCollection.doc(familyId).update({
      data: {
        areas,
        activeAreaId: nextActiveAreaId,
        updatedAt: new Date()
      }
    })

    const updatedFamily = await familiesCollection.doc(familyId).get()

    return {
      success: true,
      family: updatedFamily.data
    }
  } catch (error) {
    console.error("updateFamilyAreas error:", error)

    const messages = {
      USER_NOT_FOUND: "用户不存在，请重新登录",
      NO_FAMILY: "请先创建或加入家庭",
      INVALID_AREAS: "冰箱区域不能为空",
      FAMILY_NOT_FOUND: "没有找到家庭信息"
    }

    return {
      success: false,
      code: error.message,
      message: messages[error.message] || "家庭区域更新失败"
    }
  }
}
