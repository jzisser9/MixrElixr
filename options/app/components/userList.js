
function debounce(func, wait, immediate) {
	var timeout;
	
	return function executedFunction() {
		var context = this;
		var args = arguments;
			
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
	
		var callNow = immediate && !timeout;
		
		clearTimeout(timeout);
	
		timeout = setTimeout(later, wait);
		
		if (callNow) func.apply(context, args);
	};
}

Vue.component('user-list', {
	template: `
		<div>
			<multiselect v-model="value" 
				:tag-placeholder="tagPlaceholder" 
				:placeholder="placeholder"
				:multiple="true" 
				:taggable="isEdittable"
				:close-on-select="shouldAutoClose"
				@tag="addEntry"
				@select="addEntry"
				@remove="removeEntry"
				:options-limit="6"
				:block-keys="['Delete']"
				:options="viewers"
				:loading="isLoading"
				:internal-search="false"
				@search-change="findMixerViewers"></multiselect>
		</div>
	`,
	props: ['value', 'edittable', 'autoClose'],
	data: function() {
		return {
			viewers: [],
			isLoading: false,
			tagPlaceholder: 'Press enter to add user',
			placeholder: 'Select or type to add'
		};
	},
	computed: {
		isEdittable: function() {
			return this.edittable == null ? true : this.edittable;
		},
		shouldAutoClose: function() {
			return this.autoClose == null ? false : this.autoClose;
		}
	},
	methods: {
		addEntry: function(entry) {
			if(this.value.includes(entry)) return;
			this.value.push(entry);
			this.modelUpdated();
			this.$emit('add-entry', entry);
		},
		removeEntry: function(entry) {
			this.modelUpdated();
			this.$emit('remove-entry', entry);
		},
		modelUpdated: function() {
			this.$emit('update:value', this.value);
			this.$emit('changed');
		},
		findMixerViewers: debounce(async function(query) {
			var app = this;
			app.isLoading = true;

			let response;
			try {
				response = await app.$http.get(
					`https://mixer.com/api/v1/channels?limit=6&noCount=1&scope=all&q=${query}&search=true&fields=token`, 
					{responseType: 'json'}
				);
			} catch(err) {
				console.log('error searching for mixer viewers', err);
			}

			if(response) {
				let channels = response.data;
				app.viewers = channels.map(c => c.token);
			}	
			
			app.isLoading = false;
		}, 400)
	}
});