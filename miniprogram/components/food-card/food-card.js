Component({
  properties: {
    item: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onFoodTap() {
      this.triggerEvent("foodtap", {
        item: this.properties.item
      })
    }
  }
})