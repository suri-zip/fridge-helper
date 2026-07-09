const cloud = require("wx-server-sdk")

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = "HH-"

  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }

  return code
}

async function createUniqueInviteCode() {
  const families = db.collection("family")

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const inviteCode = createInviteCode()
    const familyRes = await families.where({ inviteCode }).get()

    if (!familyRes.data.length) {
      return inviteCode
    }
  }

  return `${createInviteCode()}${Date.now().toString().slice(-2)}`
}

function buildDefaultAreas() {
  return [
    {
      id: "area-1",
      name: "冷藏室",
      type: "冷藏",
      icon: "🧊"
    },
    {
      id: "area-2",
      name: "冷冻室",
      type: "冷冻",
      icon: "❄️"
    },
    {
      id: "area-3",
      name: "门架",
      type: "门架",
      icon: "🥛"
    }
  ]
}

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
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const user = await ensureUser(openid)
  const familyName = event && typeof event.familyName === "string" && event.familyName.trim() ? event.familyName.trim() : "我的家庭"
  const member = {
    id: openid,
    openid,
    name: "我",
    role: "户主",
    avatar: "👤",
    status: "在线"
  }
  const familyDoc = {
    familyName,
    inviteCode: await createUniqueInviteCode(),
    members: [member],
    areas: buildDefaultAreas(),
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const familyAddRes = await db.collection("family").add({
    data: familyDoc
  })

  const family = {
    ...familyDoc,
    _id: familyAddRes._id
  }

  await db.collection("users").doc(user._id).update({
    data: {
      familyId: family._id,
      role: "户主"
    }
  })

  return {
    openid,
    user: {
      ...user,
      familyId: family._id,
      role: "户主"
    },
    family
  }
}
