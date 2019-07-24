Vue.component('checkbox-toggle', {
	template: `
	<div>
        <label class="control toggle" :class="{ checked: value }">
            <input type="checkbox"  v-model.lazy="value" @change="valueUpdated">
            <div class="toggler chrome">
                <div></div>
            </div>
            <span class="option-title">
                {{label}} <option-tooltip v-if="tooltip != null" :name="tooltipName" :title="tooltip" :type="tooltipType"></option-tooltip>
            </span>
        </label>
	</div>	
	`,
	props: ['value', 'label', 'tooltip', 'tooltipType'],
	methods: {
		valueUpdated: function() {
			this.$emit('update:value', this.value);
			this.$emit('changed');
		}
	},
	computed: {
		tooltipName: function() {
			return this.label.replace(' ', '-').toLowerCase();
		}
	}
});