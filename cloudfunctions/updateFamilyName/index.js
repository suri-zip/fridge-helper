const cloud = require("wx-server-sdk")

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function getCurrentUser(openid) {
  const usersCollection = db.collection("users")
  const userResult = await usersCollection.where({ openid }).limit(1).get()

  if (userResult.data.length === 0) {
    throw new Error("USER_NOT_FOUND")
  }

  const user = userResult.data[0]

  if (!user.familyId) {
    throw new Error("NO_FAMILY")
  }

  return user
}

exports.main = async (event = {}) => {
  try {
    const nextFamilyName = String(event.familyName || "").trim()

    if (!nextFamilyName) {
      throw new Error("INVALID_FAMILY_NAME")
    }

    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const user = await getCurrentUser(openid)
    const familiesCollection = db.collection("family")
    const familyResult = await familiesCollection.doc(user.familyId).get()
    const family = familyResult.data

    if (!family) {
      throw new Error("FAMILY_NOT_FOUND")
    }

    await familiesCollection.doc(user.familyId).update({
      data: {
        familyName: nextFamilyName,
        updatedAt: new Date()
      }
    })

    const updatedFamily = await familiesCollection.doc(user.familyId).get()

    return {
      success: true,
      family: updatedFamily.data
    }
  } catch (error) {
    console.error("updateFamilyName error:", error)

    const messages = {
      USER_NOT_FOUND: "用户不存在，请重新登录",
      NO_FAMILY: "请先创建或加入家庭",
      INVALID_FAMILY_NAME: "家庭名称不能为空",
      FAMILY_NOT_FOUND: "没有找到家庭信息"
    }

    return {
      success: false,
      code: error.message,
      message: messages[error.message] || "家庭名称更新失败"
    }
  }
}