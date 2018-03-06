// ==UserScript==
// @name         GTA Online remove played
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  removes bookmarked jobs you've been played
// @author       STRIKER_Perm
// @match        https://socialclub.rockstargames.com/games/gtav/pc/jobs*
// @match        https://*.socialclub.rockstargames.com/games/gtav/pc/jobs*
// @require      http://code.jquery.com/jquery.js
// @grant        none
// ==/UserScript==

$(function() {

    console.log('Initializing "remove played" button');

    window.jobsToRemove = [];

    function getLocale() {
        switch(location.host.split('.')[0]) {
            case 'ru': return 'ru';
            default: return 'en';
        }
    }

    function getText(key) {
        var locale = getLocale();

        var translations = {
            'en': {
                'btn': 'Remove played',
                'confirm': 'All bookmarked jobs marked as played will be removed from bookmarks. Are you shure?',
                'failed': 'Failed to done the job',
                'success': 'All played jobs successfuly removed from bookmarks'
            },
            'ru': {
                'btn': 'Удалить сыгранные',
                'confirm': 'Все дела помеченные как сыгранные будут удалены из закладок. Вы уверены?',
                'failed': 'Не удалось завершить работу',
                'success': 'Все сыгранные дела успешно удалены из закладок'
            }
        };

        return translations[locale][key];
    }

    function addButton() {
        if ($('#publisher-dropdown').val() != 'bookmarked') {
            console.log('Not on bookmarks page');
            return;
        }

        var $btnPanel = $('#searchResults-inner .right');

        if (!$btnPanel.length) {
            console.log('Failed to find button panel');
            return;
        }

        var $btnRemovePlayed = $("<button>", {
            'class': 'btn btnGold'
        })
        .text(getText('btn'))
        .css('float', 'left')
        .css('margin', '14px 10px 0 0')
        .click(removePlayed);

        $btnPanel.prepend($btnRemovePlayed);
    }

    function overlay() {
        var svgStyle = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: auto;';
        var svg = '<svg width="200" height="200" style="' + svgStyle + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" class="lds-eclipse"><path stroke="none" d="M10 50A40 40 0 0 0 90 50A40 42 0 0 1 10 50" fill="#ffffff" transform="rotate(81.8182 50 51)"><animateTransform attributeName="transform" type="rotate" calcMode="linear" values="0 50 51;360 50 51" keyTimes="0;1" dur="1.1s" begin="0s" repeatCount="indefinite"></animateTransform></path></svg>';
        var $overlay = $('<div>', {
            id: 'removerOverlay',
            style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,.8); z-index: 99999999999;'
        });

        $overlay.html(svg).appendTo($('body'));
    }

    function done() {
        $('#removerOverlay').remove();
        alert(getText('success'));
        $('#btnSearch').click();
    }

    function failed() {
        $('#removerOverlay').remove();
        alert(getText('failed'));
    }

    function removeJobs(token) {
        var missionId = window.jobsToRemove.pop();
        if (missionId) {
            $.ajax({
                method: 'DELETE',
                url: 'https://' + location.host + '/games/gtav/ajax/bookmark/' + missionId,
                headers: {
                    'RequestVerificationToken': token,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .done(function(){
                removeJobs(token);
            });
        } else {
            done();
        }
    }

    function getJobs(searchRequest, offset, token) {
        searchRequest.offset = offset;

        $.ajax({
            method: 'POST',
            url: 'https://' + location.host + '/games/gtav/ajax/search',
            headers: {
                'RequestVerificationToken': token,
                'X-Requested-With': 'XMLHttpRequest'
            },
			contentType: 'application/json',
			data: JSON.stringify(searchRequest)
        })
        .done(function(data){
            if (data.Count) {
                offset += data.Count;
                for (var key in data.Missions) {
                    var mission = data.Missions[key];
                    if (mission.Players.length) {
                        window.jobsToRemove.push(mission.MissionId);
                    }
                }

                if (offset < data.Total) {
                    getJobs(searchRequest, offset, token);
                } else if (window.jobsToRemove.length) {
                    console.log('Found ' + window.jobsToRemove.length + ' played job(s)');
                    window.jobsToRemove.reverse();
                    removeJobs(token);
                } else {
                    done();
                }
            }
        })
        .fail(function(){
            failed();
            console.log('Failed to search');
        });
    }

    function removePlayed() {
        if (!confirm(getText('confirm'))) {
            return;
        }

        overlay();

        var token = $('[name="__RequestVerificationToken"]').first().val();

        var searchString = $('#tag-input').val();
        var searchDate = $('#date-dropdown').val();
        var locations = $('#location-list').find('input[type=checkbox]:checked').map(function() {
            return $(this).attr('data-value');
        }).get();
        var vehicleClasses = $('#vehicle-classes').find('input[type=checkbox]:checked').map(function() {
            return $(this).attr('data-value');
        }).get();
        var weaponsList = $('#weapons-list').find('input[type=checkbox]:checked').map(function() {
            return $(this).attr('data-value');
        }).get();
        var playersCount = $('#players-dropdown').val();
        var subtype = $('subtype-dropdown').val();

        var searchRequest = {
            "__RequestVerificationToken": token,
            "onlyCount": false,
            "searchParams": {
                "SearchOptSubType": subtype,
                "SearchOptPublisher": "bookmarked",
                "SearchOptDate": searchDate,
                "SearchOptSort": "Liked",
                "SearchOptPlayers": playersCount,
                "SearchText": searchString
            }
        };

        if (locations.length) {
            searchRequest.searchParams.Locations = locations;
        }

        if (vehicleClasses.length) {
            searchRequest.searchParams.VehicleClass = vehicleClasses;
        }

        if (weaponsList.length) {
            searchRequest.searchParams.Weapons = weaponsList;
        }

        if (token) {
            console.log('Token found: ' + token);
        } else {
            console.log('Token not found!');
            failed();
            return;
        }

        getJobs(searchRequest, 0, token);
    }

    var observer = new MutationObserver(function(){
        addButton();
    });

    observer.observe(document.getElementById('searchResultsContainer'), {childList: true});

    addButton();
});