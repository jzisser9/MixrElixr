//on document ready
$(() => {

	// stuff we need to track across pages
	let settings = null;
	let cache = {};
	let initialPageLoad = true;

	const ElementSelector = {
		CHAT_CONTAINER: '[class*=\'ChatMessages\']',
		CHAT_MESSAGE: 'div[class*=\'message_\']'
	};

	// start the process
	log('Starting MixrElixr...');

	function waitForPageLoad() {
		return new Promise((resolve)=>{
			function doPageCheck() {
				var spinner = $('.initial-loading-overlay');
				var spinnerExists = spinner != null && spinner.length > 0;

				if(spinnerExists) {
					//spinner still exists, check again in a bit
					setTimeout(()=> { doPageCheck(); }, 250);
				} else {
					log('Spinner is gone, the page should be loaded.');
					//spinner is gone, lets party
					setTimeout(()=> { resolve(); }, 750);
				}
			}

			doPageCheck();
		});
	}

	function waitForElementAvailablity(selector, checkCount = 40) {
		return new Promise((resolve, reject)=>{
			function doElementCheck(counter = 0) {

				if(counter > checkCount) {
					log(`Couldn't find '${selector}' after ${checkCount} tries!`);
					return reject();
				}
				counter++;

				var element = $(selector);
				var elementExists = element != null && element.length > 0;

				if(!elementExists) {
					//spinner still exists, check again in a bit
					setTimeout(()=> { doElementCheck(counter); }, 250);
				} else {
					log(`Element '${selector}' found!`);
					resolve();
				}
			}

			doElementCheck();
		});
	}

	function runPageLogic() {

		// Channel dectection
		var channelBlock = $('b-channel-page-wrapper');

		// Home detection
		var homeBlock = $('b-homepage');

		// Window location
		var url = window.location.href;

		//check we if we are an embeded chat window
		var embededChatRegex = /^https?:\/\/(www\.)?mixer\.com\/embed\/chat\/(\w+)/;
		var result = embededChatRegex.exec(url);
		if(result != null) {
			log('Detected embeded chat window');
			cache.currentPage = 'embedded-chat';

			var channelIdOrName = result[2];

			let isName = false;
			if(isNaN(channelIdOrName)) {
				isName = true;
			}

			if(isName) {
				cache.currentStreamerName = channelIdOrName;

				waitForElementAvailablity(ElementSelector.CHAT_CONTAINER).then(() => {
					applyChatSettings(channelIdOrName);
				});
				
			} else {
				getChannelNameById(channelIdOrName).then((name) => {
					cache.currentStreamerName = name;

					waitForElementAvailablity(ElementSelector.CHAT_CONTAINER).then(() => {
						applyChatSettings(name);
					});

				});
			}
		}

		//check if we are on a streamer page by looking for the name in the top right corner.
		else if(channelBlock != null  && channelBlock.length > 0) {
			log('detected streamer page...');
			cache.currentPage = 'streamer';

			// get the streamers name, this also waits for the page to load
			getStreamerName().then((name) => {
				log('streamer page loaded...');
				loadStreamerPage(name);
			});
		} else if (homeBlock != null && homeBlock.length > 0){
			log('looks like we are on the main page');
			cache.currentPage = 'homepage';
			loadHomepage();
		} else {
			cache.currentPage = 'other';
			loadOtherPage();
			log('looks like we\'re on some other page');
		}
	}

	function loadHomepage(){
		log('Loading up settings for homepage');

		// If the user desires to have favorites highlighted:
		if(settings.generalOptions.highlightFavorites){
			// clear the loop so were aren't trying to run it constantly!
			if(cache.highlightLoop != null) {
				clearInterval(cache.highlightLoop);
			}

			// Lets keep checking to see if we find any new favorites
			cache.highlightLoop = setInterval(function(){

				// Checking all streamer cards of non-favorites:
				$('.card:not(".favoriteFriend")').each(function() {
					// Which streamer did we find
					var streamer = $(this).find('.titles small').first().text().trim().replace(/ /g, '').replace(/\r?\n|\r/g, '');
					if (streamerIsFavorited(streamer)) {
						// If streamer is a favorite, let's highlight the window
						$(this).find('.titles small').first().addClass('favoriteUsername');
						$(this).addClass('favoriteFriend');
					} else {
						$(this).find('.titles small').first().removeClass('favoriteUsername');
						$(this).removeClass('favoriteFriend');
					}
				});
			}, 500);
		} else {
			log('Highlighting Favorites is off');
			// If highlights are off, then let's remove any active highlights.
			$('.card.favoriteFriend').removeClass('favoriteFriend');

			// clear the loop so were aren't trying to run it constantly!
			if(cache.highlightLoop != null) {
				clearInterval(cache.highlightLoop);
			}
		}

		//handle searchbar 
		const pinSearchBar = settings.homePageOptions.pinSearchToTop == null || settings.homePageOptions.pinSearchToTop === true;
		
		let searchBar = $('b-browse-channels-header')
			.children()
			.find('.control.input');
		let pageHeader = $('b-desktop-header');

		let searchHeader = $('b-browse-framework').children('header');

		let filterButton = $('b-browse-channels-header')
			.children()
			.find('.control.control-filter');

		let filterPanel = $('b-browse-filters');

		// add or remove our css classes
		if(pinSearchBar) {
			//remove button text from language dropdown
			$('.language-button').children('span').text('');
			//remove button text from filter button
			let filterText = $('.control-filter').children('.bui-btn').children('span').contents().filter(function(){ return this.nodeType == 3; }).eq(1);
			filterText.replaceWith('');

			// block click events on filter button, handle show/hide of filter panel on our own
			let filterBtnHandler = () => {
				if(pinSearchBar) {
					let filtersPanel = $('b-browse-filters');
					if(filtersPanel.hasClass('visible')) {
						filtersPanel.removeClass('visible');
					} else {
						filtersPanel.addClass('visible');
					}
					return false;
				} else {
					return true;
				}
			};
			$('.control-filter').children('.bui-btn').off('click');
			$('.control-filter').children('.bui-btn').on('click', filterBtnHandler);
			
			pageHeader.addClass('searchPinned');
			searchHeader.addClass('searchPinned');
			searchBar.addClass('me-pinned-search me-searchbar');
			filterButton.addClass('me-pinned-search me-filterbtn');
			filterPanel.addClass('me-filterspanel');
			
			searchBar.append(`
			<div class="elixr-badge-wrapper">
				<div class="elixr-badge" title="MixrElixr: Pinned search">
					<img style="height: 10px;width: 10px;transform: translate(1px, -1px);"src="https://raw.githubusercontent.com/crowbartools/MixrElixr/master/resources/images/elixr-light-16.png">
				</div>
			</div>`);
		} else {
			$('.me-pinned-search').css('top', '');
			pageHeader.removeClass('searchPinned');
			searchHeader.removeClass('searchPinned');
			searchBar.removeClass('me-pinned-search me-searchbar');
			filterButton.removeClass('me-pinned-search me-filterbtn');
			filterPanel.removeClass('me-filterspanel');
			filterPanel.css('top', '');
			$('.elixr-badge-wrapper').remove();
		}

		// do initial searchbar position check on load
		searchbarPositionCheck();
	
		// do checks when page scrolled
		$(window).scroll(debounce(function(){
			searchbarPositionCheck();
		}, 1));
			
		// do checks when page resized
		$(window).on('resize', debounce(function(){
			searchbarPositionCheck();
		}, 100));
		
		// do checks when a click happens anywhere in main doc
		$(document).click(function(event) {
			searchbarPositionCheck();

			let filtersPanel = $('b-browse-filters');
			if(!filtersPanel[0].contains(event.target)) {
				if(pinSearchBar) {
					if(filtersPanel.hasClass('visible')) {
						filtersPanel.removeClass('visible');
					}
				}
			}
		});

		// Remove featured streams on homepage
		if(settings.homePageOptions && settings.homePageOptions.removeFeatured){
			$('b-delve-featured-carousel, b-delve-games, b-delve-oom-channels').remove();
		} else if ($('b-delve-featured-carousel, b-delve-games, b-delve-oom-channels').length === 0){
			location.reload();
		}

		initialPageLoad = false;
	}

	function getStreamerName() {
		return new Promise((resolve, reject) => {
			log('Looking for streamer name...');
			if(cache.currentStreamerName != null) {
				log('Found it in the cache: ' + cache.currentStreamerName);
				return resolve(cache.currentStreamerName.trim());
			}
			// double check it's still here
			var channelBlock = $('b-channel-profile');
			if(channelBlock != null && channelBlock.length > 0) {
				var name = channelBlock.find('h2').first().text();
				if(name != null && name !== '') {
					cache.currentStreamerName = name.trim();
					log('Found it on the page: ' + cache.currentStreamerName);
					resolve(name.trim());
				} else {
					setTimeout(() => { getStreamerName(); }, 250);
				}
			} else {
				reject();
			}
		});
	}

	function cacheCustomElixrEmotes(channelId){
		return new Promise((resolve, reject) => {
			if(channelId === null || channelId === undefined){
				log('Undefined channel id passed to custom emote cacher.');
				resolve();
				return;
			}

			// Gets user emotes if there are any, and caches the results.
			log('Looking for custom emotes...');
			if(cache.currentStreamerEmotes != null) {
				log('Found cached custom emotes for: ' + cache.currentStreamerName);
				resolve();
				return;
			}
			
			var ts = new Date().getTime();
			var rootUrl = 'https://crowbartools.com/user-content/emotes/'+channelId+'.json?cache='+ts;
			$.getJSON( rootUrl, function(data) {
				log('Custom emotes retrieved for: ' + cache.currentStreamerName);
				cache.currentStreamerEmotes = data;
			})
				.fail(function() {
					log('No custom emotes for: ' + cache.currentStreamerName);
					cache.currentStreamerEmotes = null;
				});

			resolve();
		});
	}

	// Gets channel id by name
	function getChannelId(){
		return getStreamerName().then((name) => {
			return new Promise((resolve) => {
				log(`current id cache: ${cache.currentStreamerId}`);
				if(cache.currentStreamerId != null) {
					resolve(cache.currentStreamerId);
				}
				
				$.get(`https://mixer.com/api/v1/channels/${name}?fields=id`)
					.done((data) => {
						cache.currentStreamerId = data.id;
						log('Got channel id');

						cacheCustomElixrEmotes(data.id);

						resolve(data.id);
					})
					.fail(() => {
						// We reached our target server, but it returned an error
						log('Failed to get channel id');
						resolve(null);
					});
			});
		});		
	}

	// Gets channel id by name
	function userIsModInCurrentChannel(){
		return getChannelId().then(id => {
			return new Promise((resolve) => {

				if(!cache.user || !cache.currentStreamerName) {
					return resolve(false);
				}
	
				let userLowerCase = cache.user.username.toLowerCase();
				log(`${userLowerCase} == ${cache.currentStreamerName.toLowerCase()}`);
				if(userLowerCase === cache.currentStreamerName.toLowerCase()) {
					log('User is streamer so is mod');
					return resolve(true);
				}

				$.get(`https://mixer.com/api/v1/channels/${id}/users/mod?where=username:eq:${userLowerCase}&fields=username`)
					.done((data) => {
						let isMod = data.length > 0;
						log('User is mod');
						resolve(isMod);
					})
					.fail(() => {
						// We reached our target server, but it returned an error
						log('Failed to check mod status');
						resolve(false);
					});
			});
		});
	}

	function getChannelNameById(id) {
		return new Promise((resolve, reject) => {
			var request = new XMLHttpRequest();
			request.open('GET', `https://mixer.com/api/v1/channels/${id}`, true);

			request.onload = function() {
				if (request.status >= 200 && request.status < 400) {
					// Success!
					var data = JSON.parse(request.responseText);
					resolve(data.token);
				} else {
					reject('Error getting channel details');
				}
			};

			request.onerror = function() {
				// There was a connection error of some sort
				reject('Error getting channel details');
			};

			request.send();
		});
	}


	function loadOtherPage() {
		log('Loading up other page settings.');
		// If the user desires to have favorites highlighted:
		if(settings.generalOptions.highlightFavorites){
			// clear the loop so were aren't trying to run it constantly!
			if(cache.highlightLoop != null) {
				clearInterval(cache.highlightLoop);
			}

			// Lets keep checking to see if we find any new favorites
			cache.highlightLoop = setInterval(function(){

				// Checking all streamer cards of non-favorites:
				$('.card:not(".favoriteFriend")').each(function() {
					// Which streamer did we find
					var streamer = $(this).find('.titles small').first().text().trim().replace(/ /g, '').replace(/\r?\n|\r/g, '');
					if (streamerIsFavorited(streamer)) {
						// If streamer is a favorite, let's highlight the window
						$(this).find('.titles small').first().addClass('favoriteUsername');
						$(this).addClass('favoriteFriend');
					} else {
						$(this).find('.titles small').first().removeClass('favoriteUsername');
						$(this).removeClass('favoriteFriend');
					}
				});
			}, 500);
		} else {
			log('Highlighting Favorites is off');
			// If highlights are off, then let's remove any active highlights.
			$('.card.favoriteFriend').removeClass('favoriteFriend');

			// clear the loop so were aren't trying to run it constantly!
			if(cache.highlightLoop != null) {
				clearInterval(cache.highlightLoop);
			}
		}

		initialPageLoad = false;
	}


	function loadStreamerPage(streamerName) {
		log(`Loading streamer page for: ${streamerName}`);

		if(!settings.streamerPageOptions) {
			log('No streamer page settings saved.');
			return;
		}

		var options = settings.streamerPageOptions.global;

		// override the options if there is streamer specific options available
		var overrides = settings.streamerPageOptions.overrides;
		var overrideKeys = Object.keys(overrides);
		for(var i = 0; i < overrideKeys.length; i++) {
			var key = overrideKeys[i];
			if(key.toLowerCase() === streamerName.toLowerCase()) {
				log(`found override options for ${streamerName}`);
				options = overrides[key];
			}
			break;
		}

		// Auto Mute Stream
		if(options.autoMute && initialPageLoad){
			let muteStreamTries = 0;
			let autoMuteInterval = setInterval(function(){
				let volumeOff = $('[icon="volume_off"]');
				let volumeUp = $('[icon="volume_up"]');
				let volumeDown = $('[icon="volume_down"]');

				if(volumeOff.length >= 1) {
					if(!volumeOff.attr('hidden')) {
						log('Stream is already muted. No need to mute again.');
						clearInterval(autoMuteInterval);
					} else if(volumeUp.length >= 1 && !volumeUp.attr('hidden')){
						volumeUp.click();
						log('Auto muted the stream successfully.');
						clearInterval(autoMuteInterval);
					} else if(volumeDown.length >= 1 && !volumeDown.attr('hidden')){
						volumeUp.click();
						log('Auto muted the stream successfully.');
						clearInterval(autoMuteInterval);
					}
					else if (muteStreamTries < 10) {
						muteStreamTries++;
						log('Cant find auto mute button. Trying again.');
					} else {
						clearInterval(autoMuteInterval);
						log('Tried to auto mute for 10 seconds and failed.');
					}

				} else if (muteStreamTries < 10) {
					muteStreamTries++;
					log('Cant find auto mute button. Trying again.');
				} else {
					clearInterval(autoMuteInterval);
					log('Tried to auto mute for 10 seconds and failed.');
				}
			}, 1000);
		}

		if(settings.generalOptions.highlightFavorites){
			// Let's get the Costream ID via API call
			let costreamID = getCostreamID(streamerName);
			costreamID.then((result) => {
				if (result == null) {
					// If result is null, then this is not a costream.
					log(streamerName+' is not costreaming.');

					// Let's if we are following this streamer
					let isFollowed = streamerIsFollowed(streamerName);

					// Once we get some info back from the API
					isFollowed.then((result) => {
						if (result.isFollowed) {
							// Which streamer is this?
							let streamer = result.streamerName;

							// If the streamer is followed,
							// Let's show the favorite button, but it's state is based on whether streamed is faved.
							addFavoriteButton(streamer, streamerIsFavorited(streamer));
						} else {
							// User doesn't follow the streamer.

							// If not followed but is favorited, favorite status should be removed automatically.
							if (streamerIsFavorited(streamerName)) {
								syncFavorites(removeFavorite(streamerName));
							}

							// We should also attach an event to the follow button that will make the favorite button appear when a streamer is followed.
							$('bui-icon[icon="heart-full"]').closest('div.bui-btn-raised').click(function() {
								//log('Now following current streamer!');
								addFavoriteButton(streamerName, streamerIsFavorited(streamerName));

								// Remove the action from the follow button.
								$('bui-icon[icon="heart-full"]').closest('div.bui-btn-raised').off('click');
							});
						}
					});

				} else {
					// If result has value, then this is a co-stream.
					log(streamerName+' is currently costreaming.');

					// Let's see who is part of this co-stream collective.
					let costreamers = getCostreamers(result);
					costreamers.then((result) => {
						log('Costreamers: '+result);
						costreamers = result;
						// Let's check each co-streamer
						$.each(costreamers, function(i) {
							// This is the current co-streamer.
							let currentStreamer = costreamers[i]; 

							// Check to see if this streamer is followed.
							let isFollowed = streamerIsFollowed(currentStreamer);

							isFollowed.then((result) => {
								// Let's see which streamer we checked
								let streamer = result.streamerName;

								if (result.isFollowed) {
									// The streamer is followed, so let's create the favorite button.
									addFavoriteButton(streamer, streamerIsFavorited(streamer), true);
								} else {
									// The current streamer is not followed
									//log("Costreamer '" + streamer+"' is not followed.");

									// If not followed but is favorited, favorite status should be removed automatically.
									if (streamerIsFavorited(streamer)) {
										syncFavorites(removeFavorite(streamer));
									}

									// We need to find the follow button for this streamer.
									let followButtonElement = $('a.avatar-block[href="/'+streamer+'"]').siblings('div.owner-block').find('div.bui-btn');

									// We should also attach an event to the follow button that will make the favorite button appear when a streamer is followed.
									followButtonElement.click(function() {
										// Find out which streamer's follow button we are hitting.
										let thisStreamer = $(this).parents('div.head').find('a.avatar-block').attr('href').substr(1);

										// Add a favorite button for this streamer
										addFavoriteButton(thisStreamer, streamerIsFavorited(thisStreamer), true);

										// remove event from the follow button.
										followButtonElement.off('click');
									});
								}
							});
						});
					});
				}
			});
		} else {
			log('Highlights not active. So we don\'t do this.');
			$('div.owner-block h2:first-of-type').removeClass('favoriteUsername');
			$('#ME_favorite-btn').removeClass('faved');
		}

		// Auto close interactive
		if(options.autoCloseInteractive && initialPageLoad) {

			waitForElementAvailablity('.toggle-interactive')
				.then(() => {
					let minimizeInteractiveBtn = $('.toggle-interactive');
			
					if(minimizeInteractiveBtn != null && minimizeInteractiveBtn.hasClass('open')) {
						let hideInteractiveTries = 0;

						let hideInteractiveInterval = setInterval(function(){

						// click the hide button
							minimizeInteractiveBtn.click();
										
							setTimeout(() => {
							// get a fresh copy of the toggle button, this will reflect any changes in the DOM that 
							// happenedafter we clicked it
								let updatedBtn = $('.toggle-interactive');
					
								// this will be true if there is a costream and multiple streamers in the costream have
								// interactive on 
								if(detectCostreams() && updatedBtn.length === 0){
									log('Pressed the toggle interactive button successfully.');
									clearInterval(hideInteractiveInterval);

									// wait half a sec
									setTimeout(() => {
									//click X close button
										$('[icon="MixerBan"]').click();
										log('Pressed the close interactive button.');
									}, 200);

								} 
								// this will be true if theres no costreamer or only one streamer in costream has interactive on
								else if(updatedBtn.length !== 0 && !updatedBtn.hasClass('open')){
									log('Hid the interactive panel successfully.');
									clearInterval(hideInteractiveInterval);
								} else if (hideInteractiveTries < 10) {
									hideInteractiveTries++;
									log('Cant find interactive hide button. Trying again.');
								} else {
									clearInterval(hideInteractiveInterval);
									log('Tried to hide interactive for 10 seconds and failed.');
								}
							}, 100);
					
						}, 1000);
					}	
				}).catch(() => {
					log('Couldnt find interactive, streamer might not have it running.');
				});		
		}

		// Host Loop
		// This checks every second to see if the channel hosted someone.
		if(options.autoForwardOnHost || options.autoMuteOnHost){

			if(cache.hostLoop != null) {
				clearInterval(cache.hostLoop);
			}

			cache.hostLoop = setInterval(function(){

				var updatedOptions = getStreamerOptionsForStreamer(streamerName);

				let hosting = $('.host-name').is(':visible');
				if(hosting){
					var hostName = $('.hostee span').text().trim();

					// Auto forward the person on host.
					if(updatedOptions.autoForwardOnHost && hostName !== streamerName){
						// Check to make sure we're not trying to forward again accidently (which sometimes occured if interval fired during page load after a redirect)
						log('Redirecting to '+hostName+' because forwarding on host is on.');
						document.location.href = 'https://mixer.com/'+hostName;
					}

					// Auto mute when a stream hosts someone.
					if(updatedOptions.autoMuteOnHost && streamerName !== cache.mutedHost){
						let muteStreamTries = 0;
						let autoMuteInterval = setInterval(function(){
							if( $('.icon-volume_up, .icon-volume_down').length >= 1){
								$('.icon-volume_up, .icon-volume_down').click();
								log('Auto muted the stream successfully.');
								clearInterval(autoMuteInterval);
							} else if ($('.icon-volume_off').length >= 1) {
								clearInterval(autoMuteInterval);
								log('Stream is already muted. No need to mute again.');
							} else if (muteStreamTries < 10) {
								muteStreamTries++;
								log('Cant find auto mute button. Trying again.');
							} else {
								clearInterval(autoMuteInterval);
								log('Tried to auto mute for 10 seconds and failed.');
							}
						}, 1000);
						cache.mutedHost = streamerName;
					}

				}
			}, 1000);
		}

		//add theater mode btn

		//wait for video controls to load
		waitForElementAvailablity('.toolbar').then(() => {

			if($('[theater-mode-btn-container]').length < 1) {

				//copy the fullscreen button so we can make it into the theater btn
				let theaterBtn = $('#fullscreen-button').parent().clone();

				//add an attr for us to check for it later
				theaterBtn.attr('theater-mode-btn-container', '');
				theaterBtn.attr('title', 'MixrElixr: Theater Mode');
		
				theaterBtn.addClass('me-tooltip');
		
				//change the icon
				theaterBtn.find('span.set-material').text('event_seat');
		
				//add click handler
				theaterBtn.on('click', function() {
					toggleTheaterMode();
				});

				theaterBtn.insertBefore($('#fullscreen-button').parent());
			}
		});

		// Auto Close Costreams
		if(options.autoCloseCostreams){
			var costreamPage = detectCostreams();
			if(costreamPage) {
				log('Costream detected. Waiting for profiles to load');
				closeCostreams(streamerName);
			} else {
				log('No costream detected');
			}
		}

		waitForElementAvailablity(ElementSelector.CHAT_CONTAINER).then(() => {
			applyChatSettings(streamerName);
		});
	}

	function toggleTheaterMode() {
		var theaterElements = 
			$('body,b-desktop-header,b-channel-info-bar,.profile-header,.profile-blocks, b-notifications,.channel-page,b-desktop-header,.chat,.stage.aspect-16-9');
		if(theaterElements.hasClass('theaterMode')) {
			theaterElements.removeClass('theaterMode');

			//hacky way to toggle "position: relative" on and off to force the chat element to rerender with proper positioning
			setTimeout(() => {
				$('.chat').addClass('relative');
				setTimeout(() => {
					$('.chat').removeClass('relative');
				}, 25);
			}, 25);

			let stage = $('addedBuiAr');
			if(stage != null && stage.length > 0) {
				stage.removeClass('addedBuiAr');
				stage.removeClass('bui-arContent');
				$('.stage').removeClass('aspect-16-9');
			}
			
		} else {

			let minimizeInteractiveBtn = $('.hide-interactive');
			if(minimizeInteractiveBtn != null) {
				let isHideBtn = $('.icon-indeterminate_check_box');
				if(isHideBtn != null && isHideBtn.length > 0) {
					minimizeInteractiveBtn.click();
				}
			}
			setTimeout(() => {
				theaterElements.addClass('theaterMode');
			}, 1);

			$('b-stage').addClass('bui-arContent addedBuiAr');
			$('.stage').addClass('aspect-16-9 theaterMode');
		}
	}

	function closeCostreams(streamerName) {
		var profile = $('.costream-rollout .profile');
		if(profile.length === 0) {
			// Profile divs have not appeared yet
			setTimeout(closeCostreams, 500, streamerName);
		} else {
			// Profile divs have appeared
			log('Profiles loaded');
			profile.each(function() {
				// Check if profile does NOT contain current streamer's name
				if($(this).is(':not(:contains(' + streamerName.trim() + '))')) {
					var closeBtn = $(this).siblings().eq(0).children()[2];
					if(closeBtn){
						closeBtn.click();
					}
				}
			});
		}
	}

	function detectCostreams() {
		if($('.costream-avatars').length > 0) {
			return true;
		} else {
			return false;
		}
	}

	async function applyChatSettings(streamerName) {

		if(!settings.streamerPageOptions) {
			log('No streamer page settings saved.');
			return;
		}

		var options = getStreamerOptionsForStreamer(streamerName);

		if(options.customEmotes){
			// If custom emotes enabled, go try to get our json.
			cacheCustomElixrEmotes(cache.currentStreamerId);
		}

		try {
			cache.userIsMod = await userIsModInCurrentChannel();
			log(`User is mod: ${cache.userIsMod}`);
		} catch(err) {
			log('Error getting user mod status');
			console.log(err);
		}

		//add custom css class to chat message container so its easier for us to query
		$(ElementSelector.CHAT_CONTAINER)
			.children()
			.addClass('elixr-chat-container');
			
		// Mention BG Color
		if(options.mentionChatBGColor){
			let chatContainer = $('.elixr-chat-container');
			if(chatContainer != null && chatContainer.length > 0) {
				chatContainer.addClass('chat-mention-bg');
			}
		} else if(!options.mentionChatBGColor){
			let chatContainer = $('.elixr-chat-container');
			if(chatContainer != null && chatContainer.length > 0) {
				chatContainer.removeClass('chat-mention-bg');
			}
		}

		// Keyword BG Color
		if(options.keywords.length > 0){
			let chatContainer = $('.elixr-chat-container');
			if(chatContainer != null && chatContainer.length > 0) {
				chatContainer.addClass('chat-keyword-bg');
			}
		} else {
			let chatContainer = $('.elixr-chat-container');
			if(chatContainer != null && chatContainer.length > 0) {
				chatContainer.removeClass('chat-keyword-bg');
			}
		}

		// Remove prev Inline Image Links, they will be readded later if needed
		$('img[elixr-img]').each(function() { $(this).parent().parent().remove();  });
		let chatContainer = $('.elixr-chat-container');
		chatContainer.scrollTop(chatContainer[0].scrollHeight);

		// remove all prev custom timestamps if feature is turned off
		if(!options.timestampAllMessages) {
			$('.elixrTime').remove();
		}

		// get rid of any previous registered callbacks for chat messages
		$.deinitialize(ElementSelector.CHAT_MESSAGE);

		// This will run the callback for every message that already exists as well as any new ones added. 
		// We can use this to do any tweaks and modifications to chat as they come in
		//message__
		$.initialize(ElementSelector.CHAT_MESSAGE, function() {
			var messageContainer = $(this);

			if(options.useCustomFontSize) {
				messageContainer.find('[class*=\'messageContent\']').css('font-size', `${options.textSize}px`);
				messageContainer.find('[class*=\'messageContent\']').css('line-height', `${options.textSize + 9}px`);
			} else {
				messageContainer.find('[class*=\'messageContent\']').css('font-size', '');
				messageContainer.find('[class*=\'messageContent\']').css('line-height', '');
			}

			var alreadyChecked = messageContainer.attr('elixrfied');
			// check to see if we have already looked at this chat messsage.
			if(alreadyChecked == true) { return; }
			messageContainer.attr('elixrfied', 'true');

			// Give chat messages a chat message class for easier targeting.
			messageContainer.addClass('chat-message');

			var messageAuthor = messageContainer.find('[class*=\'username\']')
				.text()
				.trim()
				.split(' ')[0]; // we do this to cut out the progression level

			if(options.ignoredUsers.includes(messageAuthor)) {
				messageContainer.hide();
			} else {
				if(!messageContainer.is(':visible')) {
					messageContainer.show();
				}
			}

			// Give any message with a mention of our user a class.
			var messageText = messageContainer.find('[class*=\'textComponent\']').text().toLowerCase().trim();

			var userTagged = messageContainer.find('.tagComponent').text().toLowerCase().trim().replace('@', '');
			if(cache.user != null) {
				var userLowerCase = cache.user.username.toLowerCase();

				var userRegex = new RegExp(`\\b${escapeRegExp(userLowerCase)}\\b`, 'i');
				if(userRegex.test(messageText) || userRegex.test(userTagged)) {
					messageContainer.addClass('user-mentioned');
				}
			}

			if(options.customEmotes && cache.currentStreamerEmotes != null) {
				var emotes = cache.currentStreamerEmotes[0].emotes;
				for (let emote of emotes) {
					let ename = escapeRegExp(emote.name);
					let eurl = encodeURI(emote.url);
					let keywordRegex = new RegExp(`(^|\s)${ename}(\s|$)`, 'gmi');
					if(keywordRegex.test(messageText)) {
						let textContainer = messageContainer.find($('[class^="textComponent"]'));
						let emoteText = messageText.replace(keywordRegex, '<span class=\'elixr-custom-emote\'><img src=\''+eurl+'\'></span>');
						textContainer.html(emoteText);
						break;
					}
				}
			}
			
			// Replace text with custom emotes.
			if(options.keywords.length > 0) {
				options.keywords.forEach(w => {
					let keywordRegex = new RegExp(`\\b${escapeRegExp(w)}\\b`, 'i');
					if(keywordRegex.test(messageText)) {
						messageContainer.addClass('keyword-mentioned');
					}
				});
			}
			
			if(!cache.userIsMod || options.enableHideKeywordsWhenMod) {

				// Add class on hide keyword mention.
				if(options.hideKeywords != null && options.hideKeywords.length > 0) {

					messageContainer.find('[class*=\'textComponent\']').each(function() {
						let component = $(this);

						let text = component.text();


						function generateReplaceText(count) {
							let buffer = '';

							for(let i = 0; i < count; i++) {
								buffer += '*';
							}

							return buffer;
						}

						options.hideKeywords.forEach(w => {
							let keywordRegex = new RegExp(`\\b${escapeRegExp(w)}\\b`, 'i');

							let hideStyle = options.hideStyle || 'blur';

							if(hideStyle === 'remove') {
								if(keywordRegex.test(messageText)) {
									messageContainer.addClass('hide-word-mentioned hide-remove');
								}
							} else {
								text = text.replace(keywordRegex, match => {
									log('found match: ' + match + ' style: ' + hideStyle);
									let text = null;
									if(hideStyle === 'asterisk') {
										let replaced = generateReplaceText(match.length);
										text =`<span title="${match}">${replaced}</span>`;
									} 
									else if (hideStyle === 'blur') {
										text = `<span class="hide-word-mentioned hide-blur">${match}</span>`;
									}
									return text;
								});

								component.html(text);
							}
						});
					});	 
				}
			}

			// Timestamps on each message
			if(options.timestampAllMessages) {
				var parent = messageContainer;

				//verify there isnt a native timestamp sometime after this message (if so, this is an older message)
				var stampsAfterCurrentMsg = parent.nextAll().find('[class*=\'message\']').length > 0;

				//check that the current message doesnt already have a native or custom timestamp
				var msgAlreadyHasStamp = parent.prev().find('[class*=\'timeStamp\']').length > 0 || parent.find('.elixrTime').length > 0;

				// should we add a timestamp?
				if(!stampsAfterCurrentMsg && !msgAlreadyHasStamp) {

					var timeOptions = {hour12: true, hour: '2-digit', minute: '2-digit'};
					var time = new Date().toLocaleString([], timeOptions);

					var timeStampTemplate = `
						<div class="elixrTime">
								<span>${time}</span>
						</div>
					`;

					parent.append(timeStampTemplate);
				}
			}


			if(options.showImagesInline) {
				
				var userBlacklisted = false;
				if(options.inlineImgBlacklistedUsers != null && options.inlineImgBlacklistedUsers.length > 0) {
					userBlacklisted = options.inlineImgBlacklistedUsers.includes(messageAuthor);
				}

				if(!userBlacklisted) {
					var links = messageContainer.find('a[target=\'_blank\']');

					if(links.length > 0) {
						links.each(function() {
							var link = $(this);
							var url = link.attr('href');

							if(urlIsAnImage(url)) {
								var lowestPermittedRoleRank = getUserRoleRank(options.lowestUserRoleLinks);
								var rolePermitted = false;

								// Get the author roles in an array.
								getUserRoles(cache.currentStreamerId, messageAuthor).then((result) => {
									// Check to make sure the correct role is in the user array.
									result.forEach((r) => {
										var roleRank = getUserRoleRank(r);
										if(roleRank <= lowestPermittedRoleRank) {
											rolePermitted = true;
										}
									});

									var userTrusted = false;
									if(options.inlineImgPermittedUsers != null && 
										options.inlineImgPermittedUsers.length > 0) {
										userTrusted = options.inlineImgPermittedUsers.includes(messageAuthor);
									}

									if(rolePermitted === true || userTrusted){
										var previousImage = messageContainer.find(`img[src='${url}']`);

										//deleted
										var messageIsDeleted = messageContainer.is('[class^="deleted"]');

										if((previousImage == null || previousImage.length < 1) 
											&& (messageIsDeleted == null || 
												messageIsDeleted === false || 
												messageIsDeleted.length < 1)) {

											var inlineImg = 
												$(`<span style="display:block;">
													<span style="position: relative; display: block;">
														<span class="hide-picture-btn" style="position:absolute; left:3px; top:3px;">x</span>
														<img class="elixr-chat-img" src="${url}" style="max-width: 200px; max-height: 125px; object-fit:contain;" 
															onerror="this.onerror=null;this.src='${url.replace('https://', 'http://')}';"
															elixr-img>
													</span>
												</span>`);

											inlineImg.find('img').on('load', function() {
												scrollChatToBottom();
												$(this).off('load', '**');
											});

											inlineImg.insertBefore(link);

											// Note(ebiggz): The above "onerror" js code is a bandaid for a weird issue where an image sometimes wont load. 
											// Switching from https to http seems to work, but I dont like this fix. There must be something else going on.
											// Will need to investigate further.

											//remove previously bound click events
											$('.hide-picture-btn').off('click', '**');

											//add updated click event
											$('.hide-picture-btn').click(function(event) {
												event.stopPropagation();
												$(this).parent().parent().remove();
											});

										}
									} // End role permitted if statement.
								}); // End authorRoles.then statement
							}
						});
					}
				}
			}
		});

		scrollChatToBottom();

		initialPageLoad = false;
	}


	function searchbarPositionCheck() {

		const pinSearchBar = settings.homePageOptions.pinSearchToTop == null || 
			settings.homePageOptions.pinSearchToTop === true;

		if(!pinSearchBar) return;

		//see if the header element has the 'collapsed' class (only has it when page is scrolled down a bit)
		let topNavCollapsed = $('b-desktop-header').hasClass('collapsed'),
			cachedCollapsed = cache.topNavCollapsed || false,
			collapsedChanged = topNavCollapsed !== cachedCollapsed;

		let browserWidth = Math.max(
			document.body.scrollWidth,
			document.documentElement.scrollWidth,
			document.body.offsetWidth,
			document.documentElement.offsetWidth,
			document.documentElement.clientWidth
		);
		
		let browserCompact = browserWidth < 1770,
			cachedCompact = cache.browserCompact || false,
			compactChanged = browserCompact !== cachedCompact;

		// current collapsed and compact state matches current value, nothing new here, return now.
		if(!collapsedChanged && !compactChanged) return;

		// update our caches
		cache.topNavCollapsed = topNavCollapsed;
		cache.browserCompact = browserCompact;

		// find searchbar
		let pinnedItems = $('.me-pinned-search');
		if(pinnedItems) {
			// update searchbar css
			let searchTopAmount = topNavCollapsed ? 4 : 23;
			if(browserCompact) {
				searchTopAmount = searchTopAmount + 60;
			}
			$('.me-searchbar').css('top', searchTopAmount +'px');

			let filterTopAmount = topNavCollapsed ? 12 : 31;
			if(browserCompact) {
				filterTopAmount = filterTopAmount + 60;
			}
			$('.me-filterbtn').css('top', filterTopAmount +'px');

			let filterPanelTopAmount = topNavCollapsed ? 60 : 79;
			if(browserCompact) {
				filterPanelTopAmount = filterPanelTopAmount + 60;
			}
			$('.me-filterspanel').css('top', filterPanelTopAmount +'px');

			/*
			filterButton.addClass('me-pinned-search me-filterbtn');
			filterPanel.addClass('me-filterspanel');*/

			// add or remove box shadow if needed
			if(compactChanged) {
				if(browserCompact) {
					pinnedItems.css('box-shadow', '0px 0px 5px 2px rgba(0,0,0,0.2)');
				} else {
					pinnedItems.css('box-shadow', 'inherit');
				}
			}			
		}
	}

	// This inserts a button that toggles favorite status of the specified streamer.
	// This also modifies the coloration on the user name.
	function addFavoriteButton(streamerName, isFavorited = false, isCostream = false) {

		let favoriteBtnTarget = `.ME_favorite-btn[streamer='${streamerName}']`;

		// Removing the favorite button to avoid any duplication
		// we dont want to filter to the streamer name here so we also remove any 
		// favorite buttons from other streamers pages
		$('.ME_favorite-btn').remove();

		// Before we add any button, we need to find the DOM objects that will be impacted by our insertions.
		let avatarBlock, preceedingElement, userNameTarget;
		if (isCostream) {
			// The avatar block is the key to finding out which co-streamer we are working with
			avatarBlock = $('a.avatar-block[href="/'+streamerName+'"]');
			preceedingElement = avatarBlock.siblings('div.owner-block').find('div.follow-block');
			userNameTarget = avatarBlock.siblings('div.owner-block').find('h2:first-of-type');
		} else {
			preceedingElement = $('div.follow-block');
			userNameTarget = $('div.owner-block h2:first-of-type');
		}

		// Now we need to do the actual button and CSS insertions.
		// This adds the favorite button with either a hollow star (non-favorite), or filled star (favorite).
		// It also marks the streamer's name depending on favorite status.
		preceedingElement.after(`<div streamer="${streamerName}" class="ME_favorite-btn me-tooltip" title="MixrElixr: Favorite"><span>&#9733;</span></div>`);
		if (isFavorited) {
			userNameTarget.addClass('favoriteUsername');
			$(favoriteBtnTarget).addClass('faved');
		} else {
			userNameTarget.removeClass('favoriteUsername');
			$(favoriteBtnTarget).removeClass('faved');
		}

		// We now set some actions to the button we just added.
		// This will toggle the favorite status of the streamer, as well the button's state.
		$(favoriteBtnTarget).click( function() {
			let streamer = $(this).attr('streamer');
			addOrRemoveFavorite(streamer);
			setFavoriteButtonState(streamer, streamerIsFavorited(streamer));
		});
	}

	// This toggles on-screen DOM elements based on the specified streamer's favorite status.
	function setFavoriteButtonState(streamerName, isFavorited = false, isCostream=false) {

		// First, let's find out which streamer we're working on.
		let buttonTarget = $('.ME_favorite-btn[streamer=\''+streamerName+'\']');

		// Now we need to find the user name element so we can modifiy it.
		let userNameTarget;
		if (isCostream) {
			userNameTarget = $('a.avatar-block[href="/'+streamerName+'"').siblings('div.owner-block').find('h2:first-of-type');
		} else {
			userNameTarget = $('div.owner-block h2:first-of-type');
		}

		if (isFavorited) {
			// If streamer is faved: fill in star, change user name to green.
			buttonTarget.html('<span>&#9733;</span>');
			buttonTarget.addClass('faved');
			userNameTarget.addClass('favoriteUsername');
		} else {
			// If streamer is not faved: empty star, change user name to normal.
			buttonTarget.html('<span>&#9734;</span>');
			buttonTarget.removeClass('faved');
			userNameTarget.removeClass('favoriteUsername');
		}
	}

	function scrollChatToBottom() {
		var chatContainer = $('.elixr-chat-container');
		chatContainer.scrollTop(chatContainer[0].scrollHeight);
	}


	function getStreamerOptionsForStreamer(streamerName) {
		if(!settings.streamerPageOptions) {
			log('No streamer page settings saved.');
			return;
		}

		var options = settings.streamerPageOptions.global;

		// override the options if there is streamer specific options available
		var overrides = settings.streamerPageOptions.overrides;
		var overrideKeys = Object.keys(overrides);
		for(var i = 0; i < overrideKeys.length; i++) {
			var key = overrideKeys[i];
			if(key.toLowerCase() === streamerName.toLowerCase()) {
				options = overrides[key];
				break;
			}
		}

		return options;
	}

	function loadSettings() {
		return new Promise((resolve) => {
			getSettings().then((savedSettings) => {
				settings = savedSettings;
				console.log('got settings');
				console.log(settings);
				resolve();
			});
		});
	}

	function getSettings() {
		return new Promise((resolve) => {
			chrome.storage.sync.get({
				'streamerPageOptions': null,
				'homePageOptions': { pinSearchToTop: true },
				'generalOptions': { highlightFavorites: true }
			}, (options) => {
				resolve(options);
			});
		});
	}


	function runUrlWatcher() {
		var interval = null;
		var previousUrl = window.location.href;

		if(interval != null) {
			clearInterval(interval);
		}

		interval = setInterval(() => {
			var currentUrl = window.location.href;
			if(previousUrl !== currentUrl) {

				// fire event
				var detail = { current: currentUrl.toString(), previous: previousUrl.toString() };
				var event = new CustomEvent('url-change', { detail: detail });
				window.dispatchEvent(event);

				previousUrl = currentUrl;
			}
		}, 500);
	}

	/* Helpers */

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

	function escapeRegExp(string) {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function log(message) {
		console.log(`[MixrElixr: ${message}]`);
	}

	function getUserRoleRank(role = '') {
		switch(role) {
		case '':
			return -1;
		case 'Owner':
			return 1;
		case 'ChannelEditor':
		case 'Mod':
			return 2;
		case 'Subscriber':
			return 3;
		case 'Pro':
			return 4;
		case 'User':
			return 5;
		case 'all':
		default:
			return 6;
		}
	}

	var urlIsAnImage = function(uri) {
		//make sure we remove any nasty GET params
		uri = uri.split('?')[0];
		//moving on now
		var parts = uri.split('.');
		var extension = parts[parts.length-1];
		var imageTypes = ['jpg','jpeg','tiff','png','gif','bmp', 'webp'];
		if(imageTypes.indexOf(extension) !== -1) {
			return true;
		}
	};

	// Get user info
	// This gets user info of current logged in person
	function loadUserInfo(){
		return new Promise((resolve) => {
			$.get('https://mixer.com/api/v1/users/current')
				.done((data) => {
					log('Got user settings');
					cache.user = data;
					resolve(data);
				})
				.fail(() => {
				// We reached our target server, but it returned an error
					log('No user logged in.');
					cache.user = null;
					resolve(null);
				});
		});
	}

	// Checks Mixer API to see if streamer is followed.
	// Returns object with following status and streamer name.
	function streamerIsFollowed(streamerName) {
		return new Promise((resolve, reject) => {
			if (cache.user != null) {
				var userId = cache.user.id;

				// Let's create the data we want to return
				var streamerData = {};
				streamerData.streamerName = streamerName;
				streamerData.isFollowed = false;

				// Now check the API to see if this streamer is followed.
				$.getJSON(`https://mixer.com/api/v1/users/${userId}/follows?fields=token&where=token:eq:${streamerName}`, function(data) {
					if (data.length > 0) {
						// Found the streamer in the user's followers.
						streamerData.isFollowed = true;
						resolve(streamerData);
					} else {
						// Did not find the streamer in the user's followers.
						streamerData.isFollowed = false;
						resolve(streamerData);
					}
				});


			} else {
				reject(false);
			}
		});
	}

	// Returns boolean based on whether or not a streamer is favorited.
	function streamerIsFavorited(streamerName) {
		// If general options is null, we need to create the object so we have something to read the data from.
		if (settings.generalOptions == null) {
			settings.generalOptions = {};
			settings.generalOptions.favoriteFriends = Array();
		}

		// Are there any favorites?
		if (settings.generalOptions.favoriteFriends != null) {
			let favoriteFriends = settings.generalOptions.favoriteFriends;

			// Is there data in the friends array?
			if (favoriteFriends != null) {
				// If there is data, is there anything in it?
				if (favoriteFriends.indexOf(streamerName) >= 0) {
					// If streamer is a favorite, then we want.
					return true;
				}
			}
		}

		return false;
	}

	// Adds or Removes a streamer to the favorite list
	function addOrRemoveFavorite(streamerName) {
		//log("addOrRemoveFavorite("+streamerName+")")

		// If general options is null, we need to create the object so we have something to attach the data to.
		if (settings.generalOptions == null) {
			settings.generalOptions = {};
			settings.generalOptions.favoriteFriends = Array();
		}

		let favorites = settings.generalOptions.favoriteFriends;

		if (streamerIsFavorited(streamerName)) {
			favorites = removeFavorite(streamerName);
		} else {
			log('Adding favorite: '+streamerName);
			favorites.push(streamerName);
		}

		syncFavorites(favorites);

	}

	function removeFavorite(streamerName) {
		let favorites = settings.generalOptions.favoriteFriends;
		const index = favorites.indexOf(streamerName);

		if (index !== -1) {
			favorites.splice(index, 1);
		}
		return favorites;
	}

	function syncFavorites(favorites) {
		log('Syncing Favorites list: '+favorites);
		chrome.storage.sync.set({
			'generalOptions': {
				favoriteFriends: favorites
			}
		}, () => {});
	}

	// Checks the Mixer API to find a co-stream id.
	function getCostreamID(streamerName) {
		return new Promise((resolve) => {
			// Check Mixer API to see if active streamer is currently costreaming.
			$.getJSON(`https://mixer.com/api/v1/channels/${streamerName}?fields=costreamId`, function(data) {
				if (data['costreamId'] != null) {
					// If user is co-streaming, resolve with costream id.
					resolve(data.costreamId);
				} else {
					// If user is co-streaming, resolve with null.
					resolve(null);
				}
			});
		});
	}

	// Gets list of costreamers via Mixer API
	function getCostreamers(costreamID) {
		return new Promise((resolve) => {
			// Check Mixer API with co-stream ID to see who is participaiting in the co-stream. 
			$.getJSON(`https://mixer.com/api/v1/costreams/${costreamID}`, function(data) {
				var channels = data['channels'];
				var participants = Array();

				// Check each channel from API data and insert into participants array.
				$.each(channels, function(i) {
					participants.push(channels[i].token);
				});

				// Resolve array of co-stream participants
				resolve(participants);
			});
		});
	}

	// Gets user roles from api.
	function getUserRoles(channelId, username) {
		return new Promise((resolve) => {
			// Check Mixer API with co-stream ID to see who is participaiting in the co-stream. 
			let url = 'https://mixer.com/api/v1/channels/'+channelId+'/users?where=username:eq:'+username+'&fields=id';

			$.getJSON(url, function(data) {
				if(!data || data.length < 1) return resolve([]);
				var groups = data[0].groups;
				var roles = Array();

				// Check each group from API data and insert into roles array.
				$.each(groups, function(i) {
					roles.push(groups[i].name);
				});

				// Resolve array of co-stream participants
				resolve(roles);
			});
		});
	}

	waitForPageLoad().then(() => {

		log('page loaded');

		//Listen for url changes
		window.addEventListener('url-change', function() {
			runPageLogic();
		});

		var userInfoLoad = loadUserInfo();
		var settingsLoad = loadSettings();

		//wait for both user info and settings to load.
		Promise.all([userInfoLoad, settingsLoad]).then(() => {

			// run page logic for the first load
			runPageLogic();

			// then let the url watcher trigger it from then on
			runUrlWatcher();
		});
	});

	// listen for an event from the Options page. This fires everytime the user updates a setting
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if(request.settingsUpdated) {
			loadSettings().then(() => {
				runPageLogic();
			});
		}
		else if(request.query === 'currentStreamerName'){
			if(cache.currentPage === 'streamer') {
				console.log(cache.currentStreamerName);
				sendResponse( { streamerName: cache.currentStreamerName });
			}
		}
	});

	//tooltip listener
	$.initialize('.me-tooltip', function() {
		let meTooltip = $(this);

		meTooltip.tooltipster({
			animation: 'grow',
			delay: 10,
			animationDuration: 150,
			contentAsHTML: true,
			theme: 'tooltipster-borderless'
		});
	});
});
