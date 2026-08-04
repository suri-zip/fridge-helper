const {
	getStoredProfile,
	saveProfile: persistProfile,
	getCurrentMember,
	familyToLocalProfile,
	getEmptyLocalProfile,
	getFridgeAreas,
	refreshFamilyProfileFromCloud,
	addArea: addAreaToProfile,
	updateArea,
	updateFamilyName,
	updateMember,
	removeArea
} = require("../../../services/fridgeProfile")
const { getInventory } = require("../../../services/inventory")

const LOGIN_STATE_KEY = "TUNTUN_LOGIN_STATE"

Page({
	data: {
		authReady: false,
		hasFamily: false,
		familyName: "",
		inviteCode: "",
		currentMember: null,
		otherMembers: [],
		members: [],
		areas: [],
		activeAreaId: "",
		isAreaSettingsExpanded: false,
		isAutoReplenishExpanded: false,
		autoReplenishSearchQuery: "",
		autoReplenishSearchLoading: false,
		autoReplenishSearchResults: [],
		autoReplenishSelectedItem: null,
		autoReplenishThreshold: "3",
		autoReplenishQuantity: "1",
		editingAutoReplenishRuleId: "",
		autoReplenishRules: [],
		newAreaName: "",
		newAreaTypeIndex: 0,
		editingAreaId: "",
		editingAreaName: "",
		editingAreaTypeIndex: 0,
		isEditingFamilyName: false,
		familyNameDraft: "",
		savingFamilyName: false,
		isEditingProfile: false,
    	savingProfile: false,
		memberName: "",
		memberRoleIndex: 0,
		memberAvatarIndex: 0,
		joinInviteCode: "",
		areaTypes: ["冷藏", "冷冻", "变温", "门架", "抽屉", "自定义"],
		memberRoleOptions: ["户主", "家人", "长辈", "孩子", "访客"],
		memberAvatarOptions: ["👤", "👩", "👨", "🧑", "👵", "🧒", "👶", "🐶", "🐱"]
	},

	onShow() {
		this.loadPageState()
	},

	getLoginState() {
		return wx.getStorageSync(LOGIN_STATE_KEY)
	},

	storeLoginState(loginState) {
		wx.setStorageSync(LOGIN_STATE_KEY, loginState)
	},

	ensureLoginState() {
		return wx.cloud.callFunction({
			name: "login"
		})
	},

	async applyFamilyProfile(family, openid) {
		if (!family) {
			persistProfile(getEmptyLocalProfile())
			wx.hideTabBar()
			this.setData({
				authReady: true,
				hasFamily: false,
				familyName: "",
				inviteCode: "",
				currentMember: null,
				otherMembers: [],
				members: [],
				areas: [],
				activeAreaId: "",
				isAreaSettingsExpanded: false,
				isAutoReplenishExpanded: false,
				autoReplenishSearchQuery: "",
				autoReplenishSearchLoading: false,
				autoReplenishSearchResults: [],
				autoReplenishSelectedItem: null,
				autoReplenishThreshold: "3",
				autoReplenishQuantity: "1",
				editingAutoReplenishRuleId: "",
				autoReplenishRules: [],
				memberName: "",
				memberRoleIndex: 0,
				memberAvatarIndex: 0,
				isEditingFamilyName: false,
				familyNameDraft: "",
				savingFamilyName: false,
			})
			return
		}

		const profile = getStoredProfile()
		const currentMember = getCurrentMember(profile)
		const areas = await getFridgeAreas()
		wx.showTabBar()

		this.setData({
			authReady: true,
			hasFamily: true,
			familyName: profile.familyName,
			inviteCode: profile.inviteCode,
			currentMember,
			otherMembers: profile.members.filter(member => !currentMember || member.id !== currentMember.id),
			members: profile.members,
			areas,
			activeAreaId: profile.activeAreaId || (profile.areas[0] && profile.areas[0].id) || "",
			isAreaSettingsExpanded: false,
			isAutoReplenishExpanded: false,
			autoReplenishSearchQuery: "",
			autoReplenishSearchLoading: false,
			autoReplenishSearchResults: [],
			autoReplenishSelectedItem: null,
			autoReplenishThreshold: "3",
			autoReplenishQuantity: "1",
			editingAutoReplenishRuleId: "",
			autoReplenishRules: [],
			editingAreaId: "",
			editingAreaName: "",
			editingAreaTypeIndex: 0,
			isEditingFamilyName: false,
			familyNameDraft: profile.familyName,
			savingFamilyName: false,
			memberName: currentMember ? currentMember.name : "",
			memberRoleIndex: currentMember ? Math.max(0, this.data.memberRoleOptions.indexOf(currentMember.role)) : 0,
			memberAvatarIndex: currentMember ? Math.max(0, this.data.memberAvatarOptions.indexOf(currentMember.avatar)) : 0,
		})
	},

	async loadPageState() {
		try {
			const result = await refreshFamilyProfileFromCloud()
			this.storeLoginState(result.loginState)
			await this.applyFamilyProfile(result.loginState.family, result.loginState.openid)
		} catch (err) {
			this.storeLoginState({
				ready: true,
				openid: "",
				user: null,
				family: null
			})
			await this.applyFamilyProfile(null)
		}
	},

	syncCurrentMemberEditor(profile) {
		const currentMember = getCurrentMember(profile)
		const roleIndex = currentMember ? this.data.memberRoleOptions.indexOf(currentMember.role) : -1
		const avatarIndex = currentMember ? this.data.memberAvatarOptions.indexOf(currentMember.avatar) : -1

		this.setData({
			currentMember,
			otherMembers: profile.members.filter(member => !currentMember || member.id !== currentMember.id),
			memberName: currentMember ? currentMember.name : "",
			memberRoleIndex: roleIndex >= 0 ? roleIndex : 1,
			memberAvatarIndex: avatarIndex >= 0 ? avatarIndex : 0,
		})
	},

	async saveProfile(nextProfile) {
		persistProfile(nextProfile)
		const areas = await getFridgeAreas()
		this.setData({
			hasFamily: true,
			familyName: nextProfile.familyName,
			inviteCode: nextProfile.inviteCode,
			members: nextProfile.members,
			areas,
			activeAreaId: nextProfile.activeAreaId || (nextProfile.areas[0] && nextProfile.areas[0].id) || "",
			isAreaSettingsExpanded: false,
			isAutoReplenishExpanded: false,
			autoReplenishSearchQuery: "",
			autoReplenishSearchLoading: false,
			autoReplenishSearchResults: [],
			autoReplenishSelectedItem: null,
			autoReplenishThreshold: "3",
			autoReplenishQuantity: "1",
			editingAutoReplenishRuleId: "",
			autoReplenishRules: [],
			editingAreaId: "",
			editingAreaName: "",
			editingAreaTypeIndex: 0,
			isEditingFamilyName: false,
			familyNameDraft: nextProfile.familyName,
			savingFamilyName: false,
			memberName: "",
			memberRoleIndex: 0,
			memberAvatarIndex: 0,
		})

		this.syncCurrentMemberEditor(nextProfile)
	},

	applyLoginState(loginState) {
		this.storeLoginState(loginState)

		if (loginState.family) {
			const localProfile = familyToLocalProfile(loginState.family, loginState.openid)

			if (localProfile) {
				persistProfile(localProfile)
			}
		}

		return this.applyFamilyProfile(loginState.family, loginState.openid)
	},

	async refreshFamilyFromCloud(result) {
		const nextLoginState = {
			ready: true,
			openid: result.openid || "",
			user: result.user || null,
			family: result.family || null
		}

		await this.applyLoginState(nextLoginState)
	},

	copyInviteCode() {
		if (!this.data.hasFamily) {
			return
		}

		wx.setClipboardData({
			data: this.data.inviteCode,
			success: () => {
				wx.showToast({
					title: "邀请码已复制",
					icon: "success"
				})
			}
		})
	},

	startEditFamilyName() {
		if (!this.data.hasFamily) {
			return
		}

		this.setData({
			isEditingFamilyName: true,
			familyNameDraft: this.data.familyName || ""
		})
	},

	onFamilyNameInput(event) {
		this.setData({
			familyNameDraft: event.detail.value
		})
	},

	cancelFamilyNameEdit() {
		if (!this.data.hasFamily) {
			return
		}

		this.setData({
			isEditingFamilyName: false,
			familyNameDraft: this.data.familyName || ""
		})
	},

	async saveFamilyNameEdit() {
		if (!this.data.hasFamily) {
			return
		}

		const nextFamilyName = this.data.familyNameDraft.trim()

		if (!nextFamilyName) {
			wx.showToast({
				title: "请输入家庭名称",
				icon: "none"
			})
			return
		}

		this.setData({
			savingFamilyName: true
		})

		try {
			const nextProfile = await updateFamilyName(nextFamilyName)
			const areas = await getFridgeAreas()

			this.setData({
				familyName: nextProfile.familyName,
				inviteCode: nextProfile.inviteCode,
				members: nextProfile.members,
				areas,
				activeAreaId: nextProfile.activeAreaId || (nextProfile.areas[0] && nextProfile.areas[0].id) || "",
				isEditingFamilyName: false,
				familyNameDraft: nextProfile.familyName
			})

			wx.showToast({
				title: "家庭名称已更新",
				icon: "success"
			})
		} catch (err) {
			wx.showToast({
				title: err.message || "修改失败",
				icon: "none"
			})
		} finally {
			this.setData({
				savingFamilyName: false
			})
		}
	},

	leaveFamily() {
		wx.showModal({
			title: "退出家庭",
			content: "退出后这里会回到未加入家庭的状态。",
			confirmText: "退出",
			confirmColor: "#dc2626",
			success: res => {
				if (!res.confirm) {
					return
				}

				wx.cloud.callFunction({
					name: "leaveFamily"
				}).then(res => {
					const result = res.result || {}
					persistProfile(getEmptyLocalProfile())
					this.applyLoginState({
						ready: true,
						openid: result.openid || "",
						user: result.user || null,
						family: null
					})
					wx.showToast({
						title: "已退出家庭",
						icon: "success"
					})
				}).catch(() => {
					wx.showToast({
						title: "退出失败",
						icon: "none"
					})
				})
			}
		})
	},

	onJoinInviteInput(event) {
		this.setData({
			joinInviteCode: event.detail.value
		})
	},

	createFamily() {
		wx.showLoading({
			title: "创建中"
		})

		wx.cloud.callFunction({
			name: "createFamily"
		}).then(res => {
			wx.hideLoading()
			this.refreshFamilyFromCloud(res.result || {})
			wx.showToast({
				title: "家庭已创建",
				icon: "success"
			})
		}).catch(() => {
			wx.hideLoading()
			wx.showToast({
				title: "创建失败",
				icon: "none"
			})
		})
	},

	joinFamily() {
		const inviteCode = this.data.joinInviteCode.trim()

		if (!inviteCode) {
			wx.showToast({
				title: "请输入邀请码",
				icon: "none"
			})
			return
		}

		wx.showLoading({
			title: "加入中"
		})

		wx.cloud.callFunction({
			name: "joinFamily",
			data: {
				inviteCode
			}
		}).then(res => {
			wx.hideLoading()
			this.refreshFamilyFromCloud(res.result || {})
			this.setData({
				joinInviteCode: ""
			})
			wx.showToast({
				title: "已加入家庭",
				icon: "success"
			})
		}).catch(() => {
			wx.hideLoading()
			wx.showToast({
				title: "邀请码无效",
				icon: "none"
			})
		})
	},

	onAreaNameInput(event) {
		this.setData({
			newAreaName: event.detail.value
		})
	},

	onAreaTypeChange(event) {
		this.setData({
			newAreaTypeIndex: Number(event.detail.value)
		})
	},

	async addArea() {
		if (!this.data.hasFamily) {
			return
		}

		const areaName = this.data.newAreaName.trim()

		if (!areaName) {
			wx.showToast({
				title: "请输入区域名称",
				icon: "none"
			})
			return
		}

		const areaType = this.data.areaTypes[this.data.newAreaTypeIndex] || "自定义"
		const nextProfile = await addAreaToProfile({
			name: areaName,
			type: areaType,
			icon: areaType === "冷冻" ? "❄️" : areaType === "变温" ? "🌡️" : areaType === "门架" ? "🥛" : areaType === "抽屉" ? "🧺" : "🧊"
		})
		const areas = await getFridgeAreas()

		this.setData({
			familyName: nextProfile.familyName,
			inviteCode: nextProfile.inviteCode,
			members: nextProfile.members,
			areas,
			activeAreaId: nextProfile.activeAreaId || (nextProfile.areas[0] && nextProfile.areas[0].id) || ""
		})

		this.setData({
			newAreaName: "",
			newAreaTypeIndex: 0
		})

		wx.showToast({
			title: "区域已添加",
			icon: "success"
		})
	},

	openAreaEditor(event) {
		if (!this.data.hasFamily) {
			return
		}

		const { id } = event.currentTarget.dataset
		const profile = getStoredProfile()
		const targetArea = profile.areas.find(area => area.id === id)

		if (!targetArea) {
			return
		}

		const areaTypeIndex = this.data.areaTypes.indexOf(targetArea.type)

		this.setData({
			editingAreaId: targetArea.id,
			editingAreaName: targetArea.name,
			editingAreaTypeIndex: areaTypeIndex >= 0 ? areaTypeIndex : this.data.areaTypes.length - 1
		})
	},

	resetCurrentMemberEditor() {
		if (!this.data.hasFamily) {
			return
		}
		this.syncCurrentMemberEditor(getStoredProfile())
	},

	toggleAreaSettings() {
		this.setData({
			isAreaSettingsExpanded: !this.data.isAreaSettingsExpanded
		})
	},

	toggleAutoReplenishSettings() {
		const willExpand = !this.data.isAutoReplenishExpanded

		this.setData({
			isAutoReplenishExpanded: willExpand
		})

		if (willExpand && !this.data.autoReplenishRules.length) {
			this.loadAutoReplenishRules()
		}
	},

	async callRestockRule(action, data = {}) {
		try {
			const res = await wx.cloud.callFunction({
				name: "restockRule",
				data: {
					action,
					...data
				}
			})

			const result = res.result || {}

			// 兼容旧返回格式：没有 success 但返回了规则数据。
			if (typeof result.success === "undefined") {
				if (action === "list" && Array.isArray(result.rules)) {
					return {
						success: true,
						...result
					}
				}

				if (action === "upsert" && result.rule) {
					return {
						success: true,
						...result
					}
				}

				if (action === "toggle" && result.rule) {
					return {
						success: true,
						...result
					}
				}

				if (action === "delete" && result.deletedId) {
					return {
						success: true,
						...result
					}
				}
			}

			if (!result.success) {
				throw new Error(result.message || result.code || result.errMsg || "自动补货设置失败")
			}

			return result
		} catch (error) {
			const message = String((error && error.message) || "")

			if (message.includes("restockRule") && (message.includes("not found") || message.includes("FunctionName parameter could not be found"))) {
				throw new Error("请先部署 restockRule 云函数")
			}

			throw error
		}
	},

	normalizeRestockRule(rule) {
		return {
			id: rule._id || rule.id || "",
			foodId: String(rule.foodId || ""),
			foodName: String(rule.itemName || rule.foodName || ""),
			threshold: Number(rule.threshold || 0),
			addQuantity: Number(rule.addQuantity || 0),
			unit: String(rule.unit || "个"),
			enabled: Boolean(rule.enabled)
		}
	},

	async loadAutoReplenishRules() {
		try {
			const result = await this.callRestockRule("list")
			const rules = Array.isArray(result.rules)
				? result.rules.map(rule => this.normalizeRestockRule(rule))
				: []

			this.setData({
				autoReplenishRules: rules
			})
		} catch (error) {
			console.error("读取自动补货规则失败：", error)

			wx.showToast({
				title: error.message || "读取规则失败",
				icon: "none"
			})
		}
	},

	async searchAutoReplenishFoods(query) {
		const keyword = String(query || "").trim().toLowerCase()

		this.setData({
			autoReplenishSearchQuery: query,
			autoReplenishSearchLoading: Boolean(keyword)
		})

		if (!keyword) {
			this.setData({
				autoReplenishSelectedItem: null,
				autoReplenishSearchResults: []
			})
			return
		}

		try {
			const inventory = await getInventory()
			const results = inventory.filter(item => {
				const name = String(item.name || "").toLowerCase()
				const category = String(item.category || "").toLowerCase()

				return name.includes(keyword) || category.includes(keyword)
			}).slice(0, 8)

			this.setData({
				autoReplenishSearchResults: results
			})
		} catch (error) {
			console.error("搜索库存食材失败：", error)

			wx.showToast({
				title: error.message || "搜索失败",
				icon: "none"
			})
		} finally {
			this.setData({
				autoReplenishSearchLoading: false
			})
		}
	},

	onAutoReplenishSearchInput(event) {
		this.searchAutoReplenishFoods(event.detail.value)
	},

	selectAutoReplenishFood(event) {
		const { id } = event.currentTarget.dataset
		const selectedItem = this.data.autoReplenishSearchResults.find(item => String(item.id) === String(id))

		if (!selectedItem) {
			return
		}

		const currentStock = Number(selectedItem.quantity || 0)

		this.setData({
			autoReplenishSelectedItem: selectedItem,
			autoReplenishThreshold: String(Math.max(0, currentStock - 2)),
			autoReplenishQuantity: String(Math.max(1, currentStock || 1))
		})
	},

	onAutoReplenishThresholdInput(event) {
		this.setData({
			autoReplenishThreshold: event.detail.value
		})
	},

	onAutoReplenishQuantityInput(event) {
		this.setData({
			autoReplenishQuantity: event.detail.value
		})
	},

	startEditAutoReplenishRule(event) {
		const { ruleId } = event.currentTarget.dataset
		const rule = this.data.autoReplenishRules.find(item => String(item.id) === String(ruleId))

		if (!rule) {
			return
		}

		this.setData({
			editingAutoReplenishRuleId: String(rule.id),
			autoReplenishSelectedItem: {
				id: String(rule.foodId || ""),
				name: rule.foodName,
				unit: rule.unit || "个",
				quantity: "-"
			},
			autoReplenishThreshold: String(rule.threshold),
			autoReplenishQuantity: String(rule.addQuantity)
		})
	},

	cancelAutoReplenishEdit() {
		this.setData({
			editingAutoReplenishRuleId: "",
			autoReplenishSelectedItem: null,
			autoReplenishThreshold: "3",
			autoReplenishQuantity: "1"
		})
	},

	async addAutoReplenishRule() {
		const selectedItem = this.data.autoReplenishSelectedItem
		const editingRuleId = String(this.data.editingAutoReplenishRuleId || "")
		const threshold = Number(this.data.autoReplenishThreshold)
		const addQuantity = Number(this.data.autoReplenishQuantity)

		if (!selectedItem) {
			wx.showToast({
				title: "请先搜索并选择一个食材",
				icon: "none"
			})
			return
		}

		if (!Number.isFinite(threshold) || threshold < 0) {
			wx.showToast({
				title: "请输入正确阈值",
				icon: "none"
			})
			return
		}

		if (!Number.isFinite(addQuantity) || addQuantity <= 0) {
			wx.showToast({
				title: "请输入正确补货数量",
				icon: "none"
			})
			return
		}

		const editingRule = editingRuleId
			? this.data.autoReplenishRules.find(rule => String(rule.id) === editingRuleId)
			: null

		try {
			await this.callRestockRule("upsert", {
				rule: {
					foodId: String(selectedItem.id || editingRule?.foodId || ""),
					itemName: String(selectedItem.name || "").trim(),
					threshold,
					addQuantity,
					unit: selectedItem.unit || "个",
					enabled: editingRule ? Boolean(editingRule.enabled) : true
				}
			})

			await this.loadAutoReplenishRules()

			this.setData({
				editingAutoReplenishRuleId: "",
				autoReplenishSelectedItem: null,
				autoReplenishSearchQuery: "",
				autoReplenishSearchResults: []
			})

			wx.showToast({
				title: editingRule ? "规则已更新" : "规则已添加",
				icon: "success"
			})
		} catch (error) {
			console.error("保存自动补货规则失败：", error)

			wx.showToast({
				title: error.message || "保存失败",
				icon: "none"
			})
		}
	},

	async onAutoReplenishRuleToggle(event) {
		const { ruleId } = event.currentTarget.dataset
		const enabled = Boolean(event.detail.value)

		try {
			await this.callRestockRule("toggle", {
				ruleId: String(ruleId || ""),
				enabled
			})

			const nextRules = this.data.autoReplenishRules.map(rule => {
				if (String(rule.id) !== String(ruleId)) {
					return rule
				}

				return {
					...rule,
					enabled
				}
			})

			this.setData({
				autoReplenishRules: nextRules
			})
		} catch (error) {
			console.error("更新自动补货开关失败：", error)

			wx.showToast({
				title: error.message || "更新失败",
				icon: "none"
			})

			this.loadAutoReplenishRules()
		}
	},

	async removeAutoReplenishRule(event) {
		const { ruleId } = event.currentTarget.dataset

		if (!ruleId) {
			return
		}

		const modalResult = await new Promise(resolve => {
			wx.showModal({
				title: "删除规则",
				content: "删除后不会再自动补货该食材，确认删除吗？",
				confirmText: "删除",
				confirmColor: "#dc2626",
				success: resolve
			})
		})

		if (!modalResult.confirm) {
			return
		}

		try {
			await this.callRestockRule("delete", {
				ruleId: String(ruleId)
			})

			await this.loadAutoReplenishRules()

			if (String(this.data.editingAutoReplenishRuleId || "") === String(ruleId)) {
				this.cancelAutoReplenishEdit()
			}

			wx.showToast({
				title: "规则已删除",
				icon: "success"
			})
		} catch (error) {
			console.error("删除自动补货规则失败：", error)

			wx.showToast({
				title: error.message || "删除失败",
				icon: "none"
			})
		}
	},

	onMemberNameInput(event) {
		this.setData({
			memberName: event.detail.value
		})
	},

	onMemberRoleChange(event) {
		this.setData({
			memberRoleIndex: Number(event.detail.value)
		})
	},

	onMemberAvatarChange(event) {
		this.setData({
			memberAvatarIndex: Number(event.detail.value)
		})
	},

	startEditProfile() {
  	if (!this.data.currentMember) return

  	this.setData({
    	isEditingProfile: true
  	})
	},

	cancelEditProfile() {
  	if (!this.data.hasFamily) return

  	this.syncCurrentMemberEditor(getStoredProfile())

  	this.setData({
    	isEditingProfile: false
  	})
	},

	async saveMemberEdit() {
		if (!this.data.hasFamily || !this.data.currentMember) {
			return
		}

		const memberName = this.data.memberName.trim()

		if (!memberName) {
			wx.showToast({
				title: "请输入成员名称",
				icon: "none"
			})
			return
		}

		const role =
			this.data.memberRoleOptions[this.data.memberRoleIndex] ||
			"家人"

		const avatar =
			this.data.memberAvatarOptions[this.data.memberAvatarIndex] ||
			"👤"

		this.setData({
			savingProfile: true
		})

		try {
			const res = await wx.cloud.callFunction({
				name: "updateMemberProfile",
				data: {
					name: memberName,
					role,
					avatar
				}
			})

			const result = res.result || {}

			if (!result.success) {
				throw new Error(result.message || "保存失败")
			}

			await refreshFamilyProfileFromCloud()
			await this.applyFamilyProfile(
				result.family,
				this.getLoginState().openid
			)

			this.setData({
				isEditingProfile: false
			})

			wx.showToast({
				title: "资料已更新",
				icon: "success"
			})
		} catch (err) {
			console.error("保存成员资料失败：", err)

			wx.showToast({
				title: err.message || "保存失败",
				icon: "none"
			})
		} finally {
			this.setData({
				savingProfile: false
			})
		}
},

	onEditingAreaNameInput(event) {
		if (!this.data.hasFamily) {
			return
		}

		this.setData({
			editingAreaName: event.detail.value
		})
	},

	onEditingAreaTypeChange(event) {
		if (!this.data.hasFamily) {
			return
		}

		this.setData({
			editingAreaTypeIndex: Number(event.detail.value)
		})
	},

	cancelAreaEdit() {
		if (!this.data.hasFamily) {
			return
		}

		this.setData({
			editingAreaId: "",
			editingAreaName: "",
			editingAreaTypeIndex: 0
		})
	},

	async saveAreaEdit() {
		if (!this.data.hasFamily) {
			return
		}

		const areaName = this.data.editingAreaName.trim()

		if (!this.data.editingAreaId) {
			return
		}

		if (!areaName) {
			wx.showToast({
				title: "请输入区域名称",
				icon: "none"
			})
			return
		}

		const areaType = this.data.areaTypes[this.data.editingAreaTypeIndex] || "自定义"
		const nextProfile = await updateArea(this.data.editingAreaId, {
			name: areaName,
			type: areaType,
			icon: areaType === "冷冻" ? "❄️" : areaType === "变温" ? "🌡️" : areaType === "门架" ? "🥛" : areaType === "抽屉" ? "🧺" : "🧊"
		})
		const areas = await getFridgeAreas()

		this.setData({
			familyName: nextProfile.familyName,
			inviteCode: nextProfile.inviteCode,
			members: nextProfile.members,
			areas,
			activeAreaId: nextProfile.activeAreaId || (nextProfile.areas[0] && nextProfile.areas[0].id) || "",
			editingAreaId: "",
			editingAreaName: "",
			editingAreaTypeIndex: 0
		})

		wx.showToast({
			title: "区域已更新",
			icon: "success"
		})
	},

	async deleteArea(event) {
		if (!this.data.hasFamily) {
			return
		}

		const { id } = event.currentTarget.dataset
		const profile = getStoredProfile()
		const targetArea = profile.areas.find(area => area.id === id)

		if (!targetArea) {
			return
		}

		wx.showModal({
			title: "删除冰箱区域",
			content: `确定删除「${targetArea.name}」吗？该区域里的食材也会一起删除。`,
			confirmText: "删除",
			confirmColor: "#dc2626",
				success: async res => {
				if (!res.confirm) {
					return
				}

					const nextProfile = await removeArea(id)

				if (!nextProfile) {
					wx.showToast({
						title: "至少保留一个区域",
						icon: "none"
					})
					return
				}

					const areas = await getFridgeAreas()

					this.setData({
					familyName: nextProfile.familyName,
					inviteCode: nextProfile.inviteCode,
					members: nextProfile.members,
						areas,
					activeAreaId: nextProfile.activeAreaId || (nextProfile.areas[0] && nextProfile.areas[0].id) || ""
				})

				wx.showToast({
					title: "区域已删除",
					icon: "success"
				})
			}
		})
	},

	
})