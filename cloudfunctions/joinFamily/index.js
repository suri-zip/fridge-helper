const cloud = require("wx-server-sdk")

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function ensureUser(openid) {
  const users = db.collection("users")
  const userRes = await users.where({ openid }).get()

  if (userRes.data.length > 0) {
    return userRes.data[0]
  }

  const addRes = await users.add({
    data: {
      openid,
      familyId: "",
      role: "",
      createdAt: new Date()
    }
  })

  return {
    _id: addRes._id,
    openid,
    familyId: "",
    role: ""
  }
}

exports.main = async event => {
  const inviteCode = event && typeof event.inviteCode === "string" ? event.inviteCode.trim() : ""

  if (!inviteCode) {
    throw new Error("请输入邀请码")
  }

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const user = await ensureUser(openid)
  const familyQuery = await db.collection("family").where({ inviteCode }).get()

  if (!familyQuery.data.length) {
    throw new Error("邀请码不存在")
  }

  const family = familyQuery.data[0]
  const members = Array.isArray(family.members) ? family.members.slice() : []
  const currentMemberIndex = members.findIndex(member => member.id === openid || member.openid === openid)
  const currentMember = {
    id: openid,
    openid,
    name: currentMemberIndex >= 0 && members[currentMemberIndex].name ? members[currentMemberIndex].name : "我",
    role: currentMemberIndex >= 0 && members[currentMemberIndex].role ? members[currentMemberIndex].role : "家人",
    avatar: currentMemberIndex >= 0 && members[currentMemberIndex].avatar ? members[currentMemberIndex].avatar : "👤",
  }

  if (currentMemberIndex >= 0) {
    members[currentMemberIndex] = currentMember
  } else {
    members.push(currentMember)
  }

  await db.collection("family").doc(family._id).update({
    data: {
      members,
      updatedAt: new Date()
    }
  })

  await db.collection("users").doc(user._id).update({
    data: {
      familyId: family._id,
      role: currentMember.role
    }
  })

  return {
    openid,
    user: {
      ...user,
      familyId: family._id,
      role: currentMember.role
    },
    family: {
      ...family,
      members
    }
  }
}
