const cloud = require("wx-server-sdk")

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async event => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const name = String(event.name || "").trim()
    const role = String(event.role || "家人")
    const avatar = String(event.avatar || "👤")

    if (!name) {
      return {
        success: false,
        message: "昵称不能为空"
      }
    }

    const userResult = await db
      .collection("users")
      .where({ openid })
      .limit(1)
      .get()

    if (userResult.data.length === 0) {
      return {
        success: false,
        message: "用户不存在"
      }
    }

    const user = userResult.data[0]

    if (!user.familyId) {
      return {
        success: false,
        message: "你还没有加入家庭"
      }
    }

    const familyResult = await db
      .collection("family")
      .doc(user.familyId)
      .get()

    const family = familyResult.data
    const members = Array.isArray(family.members)
      ? family.members
      : []

    const nextMembers = members.map(member => {
      const isCurrentMember =
        member.openid === openid ||
        member.id === openid ||
        member.id === user._id

      if (!isCurrentMember) return member

      return {
        ...member,
        name,
        role,
        avatar,
      }
    })

    await db
      .collection("family")
      .doc(user.familyId)
      .update({
        data: {
          members: nextMembers,
          updatedAt: new Date()
        }
      })

    const updatedFamilyResult = await db
      .collection("family")
      .doc(user.familyId)
      .get()

    return {
      success: true,
      family: updatedFamilyResult.data
    }
  } catch (err) {
    console.error("updateMemberProfile error:", err)

    return {
      success: false,
      message: "资料保存失败"
    }
  }
}