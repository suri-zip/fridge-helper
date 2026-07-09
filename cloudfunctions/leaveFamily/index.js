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

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const user = await ensureUser(openid)

  await db.collection("users").doc(user._id).update({
    data: {
      familyId: "",
      role: ""
    }
  })

  return {
    openid,
    user: {
      ...user,
      familyId: "",
      role: ""
    },
    family: null
  }
}
