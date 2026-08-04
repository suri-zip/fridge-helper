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

async function callShoppingList(action, data = {}) {
  const res = await wx.cloud.callFunction({
    name: "shoppingList",
    data: {
      action,
      ...data
    }
  })

  const result = res.result

  if (!result || !result.success) {
    throw new Error(result?.message || "购物清单操作失败")
  }

  return result
}

async function getShoppingList() {
  const result = await callShoppingList("list")

  return result.items.map(formatItem)
}

async function addShoppingListItem(item) {
  const result = await callShoppingList("add", {
    item
  })

  return formatItem(result.item)
}

async function deleteShoppingListItem(itemId) {
  const result = await callShoppingList("delete", {
    itemId
  })

  return result.deletedId
}

async function markShoppingListItemBought(itemId) {
  const result = await callShoppingList("markBought", {
    itemId
  })

  return formatItem(result.item)
}

async function markShoppingListItemPending(itemId) {
  const result = await callShoppingList("markPending", {
    itemId
  })

  return formatItem(result.item)
}

module.exports = {
  addShoppingListItem,
  deleteShoppingListItem,
  getShoppingList,
  markShoppingListItemBought,
  markShoppingListItemPending
}